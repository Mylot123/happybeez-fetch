// Server-only helper: draait een DataForSEO SERP live batch en persisteert
// eigen + concurrent-rankings. Gebruikt door de cron-route.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const DFS_BASE = "https://api.dataforseo.com/v3";

function dfsAuthHeader(): string {
  const login = process.env.DATAFORSEO_LOGIN!;
  const password = process.env.DATAFORSEO_PASSWORD!;
  return "Basic " + Buffer.from(`${login}:${password}`).toString("base64");
}

function dbToLocation(code: string): { location_code: number; language_code: string } {
  const c = (code || "nl").toLowerCase();
  const map: Record<string, { location_code: number; language_code: string }> = {
    nl: { location_code: 2528, language_code: "nl" },
    be: { location_code: 2056, language_code: "nl" },
    de: { location_code: 2276, language_code: "de" },
    us: { location_code: 2840, language_code: "en" },
    uk: { location_code: 2826, language_code: "en" },
  };
  return map[c] ?? map.nl;
}

type SerpItem = { type: string; rank_group?: number; rank_absolute?: number; domain?: string; url?: string };
type SerpLive = { keyword: string; items?: SerpItem[] };

function rankFor(items: SerpItem[], domain: string) {
  const t = domain.toLowerCase();
  const hit = items.filter((i) => i.type === "organic").find((i) => (i.domain ?? "").toLowerCase().endsWith(t));
  return { rank: hit?.rank_group ?? hit?.rank_absolute ?? null, url: hit?.url ?? null };
}

export async function runDfsGroupRefresh(group: {
  org_id: string;
  user_id: string;
  domain: string;
  database_code: string;
  keywords: string[];
}) {
  const { location_code, language_code } = dbToLocation(group.database_code);

  const { data: comps } = await supabaseAdmin
    .from("seo_competitors")
    .select("competitor_domain")
    .eq("own_domain", group.domain)
    .eq("database_code", group.database_code)
    .eq("org_id", group.org_id);
  const competitorDomains = (comps ?? []).map((c) => c.competitor_domain);

  const uniq = Array.from(new Set(group.keywords)).slice(0, 100);
  const batch = uniq.map((keyword) => ({ keyword, location_code, language_code, depth: 100, device: "desktop" }));

  const res = await fetch(`${DFS_BASE}/serp/google/organic/live/advanced`, {
    method: "POST",
    headers: { Authorization: dfsAuthHeader(), "Content-Type": "application/json" },
    body: JSON.stringify(batch),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`DataForSEO ${res.status}: ${text.slice(0, 200)}`);
  const json = JSON.parse(text) as { tasks?: Array<{ result?: SerpLive[] | null }> };
  const results = (json.tasks ?? []).flatMap((t) => t.result ?? []);

  const now = new Date().toISOString();
  for (const r of results) {
    const items = r.items ?? [];
    const features = Array.from(new Set(items.filter((i) => i.type !== "organic").map((i) => i.type)));
    const own = rankFor(items, group.domain);

    await supabaseAdmin.from("seo_keyword_history").insert({
      org_id: group.org_id,
      user_id: group.user_id,
      keyword: r.keyword,
      domain: group.domain,
      database_code: group.database_code,
      rank: own.rank,
      position_url: own.url,
      serp_features: features,
      checked_at: now,
    });

    await supabaseAdmin
      .from("seo_keywords")
      .update({ current_rank: own.rank, position_url: own.url, last_checked_at: now })
      .eq("org_id", group.org_id)
      .eq("keyword", r.keyword)
      .eq("domain", group.domain)
      .eq("database_code", group.database_code);

    for (const cd of competitorDomains) {
      const hit = rankFor(items, cd);
      await supabaseAdmin.from("seo_competitor_history").insert({
        org_id: group.org_id,
        user_id: group.user_id,
        keyword: r.keyword,
        competitor_domain: cd,
        database_code: group.database_code,
        rank: hit.rank,
        position_url: hit.url,
        checked_at: now,
      });
    }
  }
  return { checked: results.length };
}
