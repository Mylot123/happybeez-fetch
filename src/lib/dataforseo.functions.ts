import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ─────────────────────────────────────────────────────────────
// DataForSEO integration — geleend van SEO Tracker NL.
// Gebruikt DATAFORSEO_LOGIN + DATAFORSEO_PASSWORD (Basic Auth).
// Wanneer keys ontbreken, geven de fns een duidelijke "soft_error" terug
// zodat de UI blijft werken en kan schakelen naar de bestaande Semrush/scrape-flow.
// ─────────────────────────────────────────────────────────────

const DFS_BASE = "https://api.dataforseo.com/v3";

function dfsAuthHeader(): string | null {
  const login = process.env.DATAFORSEO_LOGIN;
  const password = process.env.DATAFORSEO_PASSWORD;
  if (!login || !password) return null;
  const token = Buffer.from(`${login}:${password}`).toString("base64");
  return `Basic ${token}`;
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

function normalizeDomain(input: string): string {
  return input.replace(/^https?:\/\//, "").replace(/\/.*$/, "").toLowerCase();
}

type DfsTask<T> = { status_code: number; status_message: string; result: T[] | null };
type DfsResponse<T> = { status_code: number; status_message: string; tasks?: Array<DfsTask<T>> };

async function dfsPost<TResult>(path: string, body: unknown[]): Promise<TResult[]> {
  const auth = dfsAuthHeader();
  if (!auth) throw new Error("DATAFORSEO_LOGIN of DATAFORSEO_PASSWORD ontbreekt.");
  const res = await fetch(`${DFS_BASE}${path}`, {
    method: "POST",
    headers: { Authorization: auth, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`DataForSEO ${res.status}: ${text.slice(0, 300)}`);
  const json = JSON.parse(text) as DfsResponse<TResult>;
  if (json.status_code && json.status_code >= 40000) {
    throw new Error(`DataForSEO fout ${json.status_code}: ${json.status_message}`);
  }
  const out: TResult[] = [];
  for (const t of json.tasks ?? []) {
    if (t.result) out.push(...t.result);
  }
  return out;
}

// ─────────────────────────────────────────────────────────────
// SERP live: haal top 100 op voor een keyword, extract rank voor
// je eigen domein + elke competitor die je bijhoudt.
// ─────────────────────────────────────────────────────────────

type SerpItem = {
  type: string;
  rank_absolute?: number;
  rank_group?: number;
  domain?: string;
  url?: string;
  title?: string;
};

type SerpLiveResult = {
  keyword: string;
  items?: SerpItem[];
  item_types?: string[];
  se_domain?: string;
};

function rankForDomain(items: SerpItem[], domain: string): { rank: number | null; url: string | null } {
  const target = normalizeDomain(domain);
  const organic = items.filter((it) => it.type === "organic");
  const found = organic.find((it) => (it.domain ?? "").toLowerCase().endsWith(target));
  if (!found) return { rank: null, url: null };
  return { rank: found.rank_group ?? found.rank_absolute ?? null, url: found.url ?? null };
}

// ─────────────────────────────────────────────────────────────
// Competitor CRUD
// ─────────────────────────────────────────────────────────────

export const listSeoCompetitors = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ own_domain: z.string().min(3), database: z.string().default("nl") }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("seo_competitors")
      .select("*")
      .eq("own_domain", normalizeDomain(data.own_domain))
      .eq("database_code", data.database)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const addSeoCompetitor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        own_domain: z.string().min(3),
        competitor_domain: z.string().min(3),
        label: z.string().optional(),
        database: z.string().default("nl"),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: orgRow } = await context.supabase.from("organization_members").select("org_id").eq("user_id", context.userId).limit(1).single();
    const orgId = orgRow?.org_id;
    if (!orgId) throw new Error("Geen organisatie gekoppeld.");
    const own = normalizeDomain(data.own_domain);
    const comp = normalizeDomain(data.competitor_domain);
    if (own === comp) throw new Error("Concurrent kan niet je eigen domein zijn.");
    const { data: row, error } = await context.supabase
      .from("seo_competitors")
      .insert({
        org_id: orgId,
        user_id: context.userId,
        own_domain: own,
        competitor_domain: comp,
        label: data.label ?? null,
        database_code: data.database,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const removeSeoCompetitor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("seo_competitors").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ─────────────────────────────────────────────────────────────
// Bulk refresh: voor elke tracked keyword, doe 1 SERP live call,
// lees eigen rank + rank van elke tracked competitor.
// ─────────────────────────────────────────────────────────────

export const refreshDfsRankings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        own_domain: z.string().min(3),
        database: z.string().default("nl"),
        keywords: z.array(z.string().min(1)).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const auth = dfsAuthHeader();
    if (!auth) {
      return {
        soft_error: "DataForSEO niet gekoppeld — voeg DATAFORSEO_LOGIN en DATAFORSEO_PASSWORD toe om rankings dagelijks te verversen.",
        checked: 0,
        keywords: 0,
      };
    }

    const own = normalizeDomain(data.own_domain);
    const { location_code, language_code } = dbToLocation(data.database);

    // Kies keywords: opgegeven lijst, anders alle tracked keywords voor dit domein.
    let keywords = (data.keywords ?? []).map((k) => k.trim()).filter(Boolean);
    if (keywords.length === 0) {
      const { data: kws } = await context.supabase
        .from("seo_keywords")
        .select("keyword")
        .eq("domain", own)
        .eq("database_code", data.database);
      keywords = Array.from(new Set((kws ?? []).map((r) => r.keyword)));
    }
    if (keywords.length === 0) {
      return { soft_error: "Geen tracked keywords voor dit domein.", checked: 0, keywords: 0 };
    }

    // Haal orgId + tracked competitors op.
    const { data: orgRow } = await context.supabase
      .from("organization_members")
      .select("org_id")
      .eq("user_id", context.userId)
      .limit(1)
      .single();
    const orgId = orgRow?.org_id;
    if (!orgId) throw new Error("Geen organisatie gekoppeld.");

    const { data: comps } = await context.supabase
      .from("seo_competitors")
      .select("competitor_domain")
      .eq("own_domain", own)
      .eq("database_code", data.database);
    const competitorDomains = (comps ?? []).map((c) => c.competitor_domain);

    // Bouw batch (max 100 per call, DataForSEO limiet).
    const batch = keywords.slice(0, 100).map((k) => ({
      keyword: k,
      location_code,
      language_code,
      depth: 100,
      device: "desktop",
    }));

    const results = await dfsPost<SerpLiveResult>("/serp/google/organic/live/advanced", batch);

    const nowIso = new Date().toISOString();
    let ownFound = 0;

    for (const r of results) {
      const items = r.items ?? [];
      const serpFeatures = Array.from(new Set(items.filter((it) => it.type !== "organic").map((it) => it.type)));

      // Own rank
      const own_hit = rankForDomain(items, own);
      if (own_hit.rank != null) ownFound += 1;

      await context.supabase.from("seo_keyword_history").insert({
        org_id: orgId,
        user_id: context.userId,
        keyword: r.keyword,
        domain: own,
        database_code: data.database,
        rank: own_hit.rank,
        position_url: own_hit.url,
        serp_features: serpFeatures,
        checked_at: nowIso,
      });

      // Update seo_keywords.current_rank als het bestaat.
      await context.supabase
        .from("seo_keywords")
        .update({
          current_rank: own_hit.rank,
          position_url: own_hit.url,
          last_checked_at: nowIso,
        })
        .eq("keyword", r.keyword)
        .eq("domain", own)
        .eq("database_code", data.database);

      // Competitor ranks
      for (const cd of competitorDomains) {
        const hit = rankForDomain(items, cd);
        await context.supabase.from("seo_competitor_history").insert({
          org_id: orgId,
          user_id: context.userId,
          keyword: r.keyword,
          competitor_domain: cd,
          database_code: data.database,
          rank: hit.rank,
          position_url: hit.url,
          checked_at: nowIso,
        });
      }
    }

    return {
      checked: results.length,
      keywords: keywords.length,
      own_found: ownFound,
      competitors: competitorDomains.length,
      soft_error: null,
    };
  });

// ─────────────────────────────────────────────────────────────
// Related keywords research (DataForSEO Labs)
// Verrijkt seo_keyword_ideas met echte volume / cpc / competition / intent.
// ─────────────────────────────────────────────────────────────

type DfsRelatedItem = {
  keyword_data?: {
    keyword?: string;
    keyword_info?: {
      search_volume?: number | null;
      cpc?: number | null;
      competition?: number | null;
      competition_level?: string | null;
    };
    search_intent_info?: { main_intent?: string | null };
  };
};

export const researchDfsKeywords = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        seed: z.string().min(2),
        database: z.string().default("nl"),
        limit: z.number().min(1).max(100).default(30),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const auth = dfsAuthHeader();
    if (!auth) {
      return {
        ideas: [],
        soft_error: "DataForSEO niet gekoppeld — koppel het om echte volumes/CPC te tonen.",
      };
    }

    const { location_code, language_code } = dbToLocation(data.database);
    const results = await dfsPost<{ items?: DfsRelatedItem[] }>("/dataforseo_labs/google/related_keywords/live", [
      {
        keyword: data.seed,
        location_code,
        language_code,
        depth: 2,
        limit: data.limit,
        include_seed_keyword: true,
        include_serp_info: false,
      },
    ]);

    const items = results.flatMap((r) => r.items ?? []);
    const ideas = items
      .map((it) => {
        const kd = it.keyword_data;
        const kw = kd?.keyword?.toLowerCase().trim();
        if (!kw) return null;
        const intent = kd?.search_intent_info?.main_intent ?? null;
        const kind: "question" | "commercial" | "content" | "related" | "local" =
          intent === "transactional" || intent === "commercial"
            ? "commercial"
            : intent === "informational"
              ? "content"
              : /^(hoe|wat|waar|wanneer|waarom)\b/.test(kw)
                ? "question"
                : "related";
        return {
          keyword: kw,
          search_volume: kd?.keyword_info?.search_volume ?? null,
          cpc: kd?.keyword_info?.cpc ?? null,
          competition: kd?.keyword_info?.competition ?? null,
          difficulty: null as number | null,
          intent,
          kind,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    // Persisteer in seo_keyword_ideas.
    const { data: orgRow } = await context.supabase
      .from("organization_members")
      .select("org_id")
      .eq("user_id", context.userId)
      .limit(1)
      .single();
    const orgId = orgRow?.org_id;
    if (orgId && ideas.length) {
      await context.supabase.from("seo_keyword_ideas").insert(
        ideas.map((i) => ({
          org_id: orgId,
          user_id: context.userId,
          seed: data.seed,
          keyword: i.keyword,
          search_volume: i.search_volume,
          cpc: i.cpc,
          competition: i.competition,
          difficulty: i.difficulty,
          kind: i.kind,
          database_code: data.database,
        })),
      );
    }

    return { ideas, soft_error: null };
  });

// ─────────────────────────────────────────────────────────────
// Bulk keywords: add + enrich (volume/CPC/intent) via DataForSEO Labs.
// ─────────────────────────────────────────────────────────────

export const bulkAddSeoKeywords = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        keywords: z.array(z.string().min(1)).min(1),
        domain: z.string().min(3),
        database: z.string().default("nl"),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: orgRow } = await context.supabase
      .from("organization_members")
      .select("org_id")
      .eq("user_id", context.userId)
      .limit(1)
      .single();
    const orgId = orgRow?.org_id;
    if (!orgId) throw new Error("Geen organisatie gekoppeld.");

    const domain = normalizeDomain(data.domain);
    const clean = Array.from(
      new Set(data.keywords.map((k) => k.trim().toLowerCase()).filter((k) => k.length >= 2)),
    );
    if (!clean.length) return { added: 0, skipped: 0 };

    // Skip existing
    const { data: existing } = await context.supabase
      .from("seo_keywords")
      .select("keyword")
      .eq("org_id", orgId)
      .eq("domain", domain)
      .eq("database_code", data.database)
      .in("keyword", clean);
    const have = new Set((existing ?? []).map((r) => r.keyword));
    const rows = clean
      .filter((k) => !have.has(k))
      .map((keyword) => ({
        org_id: orgId,
        user_id: context.userId,
        keyword,
        domain,
        database_code: data.database,
        is_active: true,
      }));
    if (rows.length) {
      const { error } = await context.supabase.from("seo_keywords").insert(rows);
      if (error) throw new Error(error.message);
    }
    return { added: rows.length, skipped: clean.length - rows.length };
  });

type DfsOverviewItem = {
  keyword_data?: {
    keyword?: string;
    keyword_info?: { search_volume?: number | null; cpc?: number | null; competition?: number | null };
    search_intent_info?: { main_intent?: string | null };
  };
};

export const enrichSeoKeywords = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        keywords: z.array(z.string().min(1)).optional(),
        domain: z.string().min(3),
        database: z.string().default("nl"),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const auth = dfsAuthHeader();
    if (!auth) return { enriched: 0, soft_error: "DataForSEO niet gekoppeld." };
    const domain = normalizeDomain(data.domain);
    const { location_code, language_code } = dbToLocation(data.database);

    let keywords = (data.keywords ?? []).map((k) => k.trim().toLowerCase()).filter(Boolean);
    if (!keywords.length) {
      const { data: kws } = await context.supabase
        .from("seo_keywords")
        .select("keyword")
        .eq("domain", domain)
        .eq("database_code", data.database);
      keywords = Array.from(new Set((kws ?? []).map((r) => r.keyword.toLowerCase())));
    }
    if (!keywords.length) return { enriched: 0, soft_error: "Geen keywords om te verrijken." };

    const batch = keywords.slice(0, 700);
    const results = await dfsPost<{ items?: DfsOverviewItem[] }>(
      "/dataforseo_labs/google/keyword_overview/live",
      [{ keywords: batch, location_code, language_code }],
    );
    const items = results.flatMap((r) => r.items ?? []);
    let enriched = 0;
    for (const it of items) {
      const kd = it.keyword_data;
      const kw = kd?.keyword?.toLowerCase();
      if (!kw) continue;
      const intent = kd?.search_intent_info?.main_intent ?? null;
      const { error } = await context.supabase
        .from("seo_keywords")
        .update({
          search_volume: kd?.keyword_info?.search_volume ?? null,
          cpc: kd?.keyword_info?.cpc ?? null,
          competition: kd?.keyword_info?.competition ?? null,
          intent,
        })
        .eq("keyword", kw)
        .eq("domain", domain)
        .eq("database_code", data.database);
      if (!error) enriched += 1;
    }
    return { enriched, soft_error: null };
  });

export const toggleSeoKeyword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), is_active: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("seo_keywords")
      .update({ is_active: data.is_active })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteSeoKeywords = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ ids: z.array(z.string().uuid()).min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("seo_keywords").delete().in("id", data.ids);
    if (error) throw new Error(error.message);
    return { deleted: data.ids.length };
  });

