import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY = "https://connector-gateway.lovable.dev/semrush";

function gwHeaders() {
  const lov = process.env.LOVABLE_API_KEY;
  const sem = process.env.SEMRUSH_API_KEY;
  if (!lov) throw new Error("LOVABLE_API_KEY ontbreekt.");
  if (!sem) throw new Error("SEMRUSH_API_KEY ontbreekt — koppel Semrush.");
  return {
    Authorization: `Bearer ${lov}`,
    "X-Connection-Api-Key": sem,
  } as Record<string, string>;
}

type SemRow = { columnNames: string[]; rows: Array<Array<string | number | null>> };

function normalizeDomain(input: string) {
  return input.replace(/^https?:\/\//, "").replace(/\/.*$/, "").toLowerCase();
}

function isSemrushLimitError(e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  return /semrush|limit|limiet|TOTAL LIMIT EXCEEDED|uitgeschakeld/i.test(msg);
}


function fallbackNotice(e: unknown) {
  const msg = e instanceof Error ? e.message : "Semrush is nu niet beschikbaar.";
  return `${msg} Ik heb daarom een alternatief SEO-plan gemaakt zonder Semrush-data.`;
}

function cleanKeyword(value: string) {
  return value.toLowerCase().replace(/[“”"'`]/g, "").replace(/\s+/g, " ").trim();
}

function dedupeIdeas<T extends { keyword: string }>(rows: T[]) {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const key = cleanKeyword(row.keyword);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

type FallbackIdea = {
  keyword: string;
  search_volume: number | null;
  cpc: number | null;
  competition: number | null;
  difficulty: number | null;
  kind: "question" | "related" | "commercial" | "content" | "local";
  source?: "ai" | "fallback";
};

function deterministicKeywordIdeas(seed: string): FallbackIdea[] {
  const base = cleanKeyword(seed);
  const terms = [
    { keyword: base, kind: "related" as const },
    { keyword: `${base} kopen`, kind: "commercial" as const },
    { keyword: `beste ${base}`, kind: "commercial" as const },
    { keyword: `${base} voor wilde bijen`, kind: "content" as const },
    { keyword: `${base} voor metselbijen`, kind: "content" as const },
    { keyword: `${base} in de tuin`, kind: "content" as const },
    { keyword: `waar ${base} plaatsen`, kind: "question" as const },
    { keyword: `wanneer ${base} ophangen`, kind: "question" as const },
    { keyword: `hoe ${base} schoonmaken`, kind: "question" as const },
    { keyword: `${base} onderhoud`, kind: "content" as const },
    { keyword: `${base} bamboe of hout`, kind: "question" as const },
    { keyword: `${base} voor balkon`, kind: "content" as const },
    { keyword: `${base} nederland`, kind: "local" as const },
    { keyword: `bijenhotel plaatsen`, kind: "question" as const },
    { keyword: `wilde bijen helpen`, kind: "content" as const },
    { keyword: `insectenhotel bijen`, kind: "related" as const },
  ];
  return dedupeIdeas(terms).map((t) => ({ ...t, search_volume: null, cpc: null, competition: null, difficulty: null, source: "fallback" }));
}

async function aiKeywordIdeas(seed: string, database: string): Promise<FallbackIdea[]> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) return deterministicKeywordIdeas(seed);
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "openai/gpt-5-mini",
        messages: [
          {
            role: "system",
            content:
              "Je bent een Nederlandse SEO-strateeg voor HappyBeez: bijenhotels, wilde bijen, biodiversiteit, tuinen en educatie. Geef alleen geldige JSON terug.",
          },
          {
            role: "user",
            content: `Maak 24 SEO-keywordideeën voor de ${database.toUpperCase()} markt rond: ${seed}. Mix koopintentie, vragen, educatieve blogtopics en lokale varianten. Vermijd verzonnen zoekvolumes. JSON-array met objecten: keyword, kind. kind is één van question, related, commercial, content, local.`,
          },
        ],
      }),
    });
    if (!res.ok) return deterministicKeywordIdeas(seed);
    const j: { choices?: Array<{ message?: { content?: string } }> } = await res.json();
    const raw = j.choices?.[0]?.message?.content?.trim() ?? "[]";
    const json = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
    const parsed = JSON.parse(json) as Array<{ keyword?: string; kind?: string }>;
    const allowed = new Set(["question", "related", "commercial", "content", "local"]);
    const ideas = parsed
      .filter((x) => x.keyword)
      .map((x) => ({
        keyword: cleanKeyword(String(x.keyword)),
        kind: allowed.has(String(x.kind)) ? (String(x.kind) as FallbackIdea["kind"]) : "related",
        search_volume: null,
        cpc: null,
        competition: null,
        difficulty: null,
        source: "ai" as const,
      }));
    return dedupeIdeas([...ideas, ...deterministicKeywordIdeas(seed)]).slice(0, 30);
  } catch {
    return deterministicKeywordIdeas(seed);
  }
}

async function fetchPageText(url: string) {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; HappyBeezSEOBot/1.0)" },
      redirect: "follow",
    });
    if (!res.ok) return "";
    return await res.text();
  } catch {
    return "";
  }
}

function extractReadableText(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractSiteTerms(html: string, domain: string) {
  const ex = extract(html);
  const text = `${ex.title} ${ex.metaDescription} ${ex.h1} ${ex.h2s.join(" ")} ${extractReadableText(html).slice(0, 4000)}`.toLowerCase();
  const baseTerms = [
    "bijenhotel",
    "bijenhotel kopen",
    "wilde bijen",
    "metselbijen",
    "insectenhotel",
    "bestuivers",
    "biodiversiteit tuin",
    "bijvriendelijke tuin",
    "bijenhotel plaatsen",
    "bijenhotel onderhoud",
  ];
  const fromPage = Array.from(new Set(baseTerms.filter((term) => text.includes(term.split(" ")[0]))));
  const keywords = (fromPage.length ? fromPage : baseTerms).map((keyword) => ({
    keyword,
    position: null,
    volume: null,
    cpc: null,
    competition: null,
    traffic_share: null,
    url: `https://${domain}`,
    kd: null,
  }));
  return { extracted: ex, keywords };
}

async function callSemrush(path: string, params: Record<string, string | number | undefined>, limitOffset = false): Promise<SemRow> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") qs.set(k, String(v));
  const url = `${GATEWAY}${path}?${qs.toString()}`;
  const headers = gwHeaders();
  if (limitOffset) headers["Allow-Limit-Offset"] = "true";
  const res = await fetch(url, { headers });
  const text = await res.text();
  if (!res.ok) {
    // Try parse error body
    let msg = text.slice(0, 300);
    try {
      const j = JSON.parse(text);
      if (j?.error) msg = j.error;
    } catch {}
    if (/TOTAL LIMIT EXCEEDED|limit exceeded/i.test(msg)) {
      throw new Error("Semrush dagelijkse limiet bereikt. Upgrade je Semrush-plan of probeer morgen opnieuw.");
    }
    throw new Error(`Semrush fout (${res.status}): ${msg}`);
  }
  let j: { data?: SemRow; error?: string };
  try {
    j = JSON.parse(text);
  } catch {
    throw new Error(`Onleesbare Semrush-response.`);
  }
  if (j.error) throw new Error(`Semrush: ${j.error}`);
  return j.data ?? { columnNames: [], rows: [] };
}

// Semrush returns human column names, not codes. Map both → code.
const COLUMN_ALIASES: Record<string, string> = {
  // codes (identity)
  Ph: "Ph", Po: "Po", Nq: "Nq", Cp: "Cp", Co: "Co", Tr: "Tr", Ur: "Ur", Kd: "Kd",
  Db: "Db", Dn: "Dn", Rk: "Rk", Or: "Or", Ot: "Ot", Oc: "Oc", Ad: "Ad", At: "At", Ac: "Ac",
  Cr: "Cr", Np: "Np",
  // human names → codes
  Keyword: "Ph",
  Position: "Po",
  "Search Volume": "Nq",
  CPC: "Cp",
  Competition: "Co",
  "Traffic (%)": "Tr",
  Traffic: "Tr",
  Url: "Ur",
  URL: "Ur",
  "Keyword Difficulty": "Kd",
  "Keyword Difficulty Index": "Kd",
  Database: "Db",
  Domain: "Dn",
  Rank: "Rk",
  "Organic Keywords": "Or",
  "Organic Traffic": "Ot",
  "Organic Cost": "Oc",
  "Adwords Keywords": "Ad",
  "Adwords Traffic": "At",
  "Adwords Cost": "Ac",
  "Common Keywords": "Cr",
  "SE Keywords": "Or",
};

function rowsToObjects(d: SemRow): Array<Record<string, string>> {
  return d.rows.map((r) => {
    const o: Record<string, string> = {};
    d.columnNames.forEach((c, i) => {
      const val = String(r[i] ?? "");
      o[c] = val;
      const code = COLUMN_ALIASES[c];
      if (code) o[code] = val;
    });
    return o;
  });
}

// ──────────────────────────────────────────────────────────────────
// Domain overview: rank + top organic keywords + competitors + quick wins
// ──────────────────────────────────────────────────────────────────
export const analyzeDomain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        domain: z.string().min(3).max(200),
        database: z.string().default("nl"),
        skip_semrush: z.boolean().optional().default(false),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const domain = normalizeDomain(data.domain);
    const db = data.database;




    try {
      if (data.skip_semrush) {
        throw new Error("Semrush is uitgeschakeld — alternatief SEO-plan gemaakt.");
      }

      const ranks = rowsToObjects(
        await callSemrush("/domains/domain_ranks", {
          domain,
          database: db,
          export_columns: "Db,Dn,Rk,Or,Ot,Oc,Ad,At,Ac",
        }),
      )[0];

      // 2 Top 25 organic keywords (position, volume, traffic share, URL, KD)
      const organic = rowsToObjects(
        await callSemrush(
          "/domains/domain_organic",
          {
            domain,
            database: db,
            export_columns: "Ph,Po,Nq,Cp,Co,Tr,Ur,Kd",
            display_limit: 25,
          },
          true,
        ),
      );


    // 3 Top 10 organic competitors
    const compsRaw = rowsToObjects(
      await callSemrush(
        "/domains/domain_organic_organic",
        {
          domain,
          database: db,
          export_columns: "Dn,Cr,Np,Or,Ot",
          display_limit: 10,
        },
        true,
      ),
    ).filter((c) => (c.Dn ?? "").toLowerCase() !== domain);


    const topKeywords = organic.map((r) => ({
      keyword: r.Ph,
      position: Number(r.Po) || null,
      volume: Number(r.Nq) || null,
      cpc: Number(r.Cp) || null,
      competition: Number(r.Co) || null,
      traffic_share: Number(r.Tr) || null,
      url: r.Ur,
      kd: Number(r.Kd) || null,
    }));

    const quickWins = topKeywords
      .filter((k) => k.position && k.position >= 4 && k.position <= 20 && (k.volume ?? 0) >= 30)
      .sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0))
      .slice(0, 15);

    const competitors = compsRaw.map((r) => ({
      domain: r.Dn,
      common_keywords: Number(r.Cr) || null,
      organic_keywords: Number(r.Or) || null,
      organic_traffic: Number(r.Ot) || null,
    }));

    const snapshot = {
      domain,
      database_code: db,
      rank_global: Number(ranks?.Rk) || null,
      organic_keywords: Number(ranks?.["Organic Keywords"] ?? ranks?.Or) || null,
      organic_traffic: Number(ranks?.["Organic Traffic"] ?? ranks?.Ot) || null,
      organic_cost: Number(ranks?.["Organic Cost"] ?? ranks?.Oc) || null,
      top_keywords: topKeywords,
      competitors,
      quick_wins: quickWins,
    };

    // Persist snapshot
    const { supabase, userId } = context;
    const { data: inserted, error } = await supabase
      .from("seo_domain_snapshots")
      .insert({ user_id: userId, ...snapshot })
      .select("id, created_at")
      .single();
    if (error) throw new Error(error.message);

    return { id: inserted.id, created_at: inserted.created_at, ...snapshot, soft_error: null as string | null };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Onbekende fout";
      if (!isSemrushLimitError(e)) {
        return {
          id: null, created_at: null, domain, database_code: db,
          rank_global: null, organic_keywords: null, organic_traffic: null, organic_cost: null,
          top_keywords: [] as never[], competitors: [] as never[], quick_wins: [] as never[],
          soft_error: msg,
        };
      }

      const html = await fetchPageText(`https://${domain}`);
      const ex = html ? extract(html) : null;
      const site = html ? extractSiteTerms(html, domain) : { keywords: deterministicKeywordIdeas("bijenhotel").slice(0, 10).map((idea) => ({
        keyword: idea.keyword,
        position: null,
        volume: null,
        cpc: null,
        competition: null,
        traffic_share: null,
        url: `https://${domain}`,
        kd: null,
      })) };
      const topKeywords = site.keywords;
      const quickWins = topKeywords.slice(0, 6);
      const competitors = [
        { domain: "bestuivers.nl", common_keywords: null, organic_keywords: null, organic_traffic: null },
        { domain: "vivara.nl", common_keywords: null, organic_keywords: null, organic_traffic: null },
        { domain: "natuurmonumenten.nl", common_keywords: null, organic_keywords: null, organic_traffic: null },
        { domain: "bol.com", common_keywords: null, organic_keywords: null, organic_traffic: null },
      ];

      // On-page snapshot + concrete issues
      const pageIssues: string[] = [];
      if (ex) {
        if (!ex.title) pageIssues.push("Geen <title> op homepage");
        else if (ex.title.length < 30 || ex.title.length > 65) pageIssues.push(`Title ${ex.title.length} tekens (ideaal 50–60)`);
        if (!ex.metaDescription) pageIssues.push("Geen meta description");
        else if (ex.metaDescription.length < 110 || ex.metaDescription.length > 170) pageIssues.push(`Meta description ${ex.metaDescription.length} tekens (ideaal 140–160)`);
        if (!ex.h1) pageIssues.push("Geen H1");
        if (ex.h2s.length < 2) pageIssues.push("Minder dan 2 H2's");
        if (ex.wordCount < 300) pageIssues.push(`Weinig tekst (${ex.wordCount} woorden)`);
        if (!ex.canonical) pageIssues.push("Geen canonical tag");
        if (!ex.ogTitle || !ex.ogImage) pageIssues.push("Open Graph onvolledig");
        if (ex.imagesTotal > 0 && ex.imagesWithAlt / ex.imagesTotal < 0.8) pageIssues.push(`${ex.imagesWithAlt}/${ex.imagesTotal} afbeeldingen met alt-tekst`);
        if (!ex.jsonLd) pageIssues.push("Geen JSON-LD schema");
      }
      const page_audit = ex ? {
        title: ex.title || null,
        meta_description: ex.metaDescription || null,
        h1: ex.h1 || null,
        h2s: ex.h2s,
        word_count: ex.wordCount,
        issues: pageIssues,
      } : null;

      // AI: prioritized action plan + content gaps
      type Action = { priority: "hoog" | "midden" | "laag"; action: string; why: string; where: string };
      let ai_actions: Action[] = [];
      let content_gaps: string[] = [];
      try {
        const apiKey = process.env.LOVABLE_API_KEY;
        if (apiKey) {
          const ai = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "openai/gpt-5-mini",
              messages: [
                { role: "system", content: "Je bent SEO-strateeg voor HappyBeez (bijenhotels, wilde bijen, biodiversiteit). Antwoord uitsluitend met geldige JSON." },
                { role: "user", content: `Domein: ${domain}\nTitle: ${ex?.title ?? "—"}\nMeta: ${ex?.metaDescription ?? "—"}\nH1: ${ex?.h1 ?? "—"}\nH2: ${ex?.h2s.join(" | ") ?? "—"}\nWoorden: ${ex?.wordCount ?? 0}\nProblemen: ${pageIssues.join("; ") || "—"}\nKeywords waar we op willen ranken: ${topKeywords.map(k => k.keyword).join(", ")}\n\nGeef JSON: { "actions": [{"priority":"hoog|midden|laag","action":"...","why":"...","where":"homepage|productpagina|blog|technisch"}], "content_gaps": ["...blogonderwerp 1...", "..."] }. Geef 5–7 concrete acties en 6 blogonderwerpen die HappyBeez nog mist en die wel zoekvolume genereren.` },
              ],
            }),
          });
          if (ai.ok) {
            const j: { choices?: Array<{ message?: { content?: string } }> } = await ai.json();
            const raw = (j.choices?.[0]?.message?.content ?? "").trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
            const parsed = JSON.parse(raw) as { actions?: Action[]; content_gaps?: string[] };
            ai_actions = (parsed.actions ?? []).slice(0, 8);
            content_gaps = (parsed.content_gaps ?? []).slice(0, 8);
          }
        }
      } catch {
        // best effort
      }

      const snapshot = {
        domain,
        database_code: db,
        rank_global: null,
        organic_keywords: topKeywords.length,
        organic_traffic: null,
        organic_cost: null,
        top_keywords: topKeywords,
        competitors,
        quick_wins: quickWins,
      };
      const { supabase, userId } = context;
      const { data: inserted } = await supabase
        .from("seo_domain_snapshots")
        .insert({ user_id: userId, ...snapshot })
        .select("id, created_at")
        .single();
      return { id: inserted?.id ?? null, created_at: inserted?.created_at ?? null, ...snapshot, page_audit, ai_actions, content_gaps, soft_error: fallbackNotice(e) };
    }
  });


// ──────────────────────────────────────────────────────────────────
// Keyword research: related + question phrases for a seed
// ──────────────────────────────────────────────────────────────────
export const researchKeyword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        seed: z.string().min(2).max(150),
        database: z.string().default("nl"),
        limit: z.number().int().min(5).max(25).default(20),
        skip_semrush: z.boolean().optional().default(false),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    let all: FallbackIdea[] = [];
    let soft_error: string | null = null;

    try {
      if (data.skip_semrush) throw new Error("Semrush uitgeschakeld.");

      const related = rowsToObjects(
        await callSemrush(
          "/keywords/phrase_related",
          {
            phrase: data.seed,
            database: data.database,
            export_columns: "Ph,Nq,Cp,Co,Kd",
            display_limit: data.limit,
          },
          true,
        ),
      );
      const questions = rowsToObjects(
        await callSemrush(
          "/keywords/phrase_questions",
          {
            phrase: data.seed,
            database: data.database,
            export_columns: "Ph,Nq,Cp,Co,Kd",
            display_limit: data.limit,
          },
          true,
        ),
      );

      const norm = (kind: "related" | "question") => (r: Record<string, string>): FallbackIdea => ({
        keyword: r.Ph,
        search_volume: Number(r.Nq) || null,
        cpc: Number(r.Cp) || null,
        competition: Number(r.Co) || null,
        difficulty: Number(r.Kd) || null,
        kind,
      });

      all = [...related.map(norm("related")), ...questions.map(norm("question"))];
    } catch (e) {
      soft_error = fallbackNotice(e);
      all = await aiKeywordIdeas(data.seed, data.database);
    }

    const { supabase, userId } = context;
    // Cache (best effort)
    if (all.length) {
      await supabase.from("seo_keyword_ideas").insert(
        all.map((a) => ({
          user_id: userId,
          seed: data.seed,
          database_code: data.database,
          keyword: a.keyword,
          kind: a.kind,
          search_volume: a.search_volume,
          cpc: a.cpc,
          competition: a.competition,
          difficulty: a.difficulty,
        })),
      );
    }

    return { seed: data.seed, database: data.database, ideas: all, soft_error };
  });

// ──────────────────────────────────────────────────────────────────
// Track keyword: get SERP and find user's domain rank
// ──────────────────────────────────────────────────────────────────
export const trackKeyword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        keyword: z.string().min(2).max(150),
        domain: z.string().min(3).max(200),
        database: z.string().default("nl"),
        skip_semrush: z.boolean().optional().default(false),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const domain = normalizeDomain(data.domain);
    let metrics: Record<string, string> | undefined;
    let serpRows: Array<Record<string, string>> = [];
    let soft_error: string | null = null;

    try {
      if (data.skip_semrush) throw new Error("Semrush uitgeschakeld.");

      // Metrics for the keyword
      const metricsRows = rowsToObjects(
        await callSemrush("/keywords/phrase_this", {
          phrase: data.keyword,
          database: data.database,
          export_columns: "Ph,Nq,Cp,Co,Kd",
        }),
      );
      metrics = metricsRows[0];

      // SERP — top 20 domains
      serpRows = rowsToObjects(
        await callSemrush(
          "/keywords/phrase_organic",
          {
            phrase: data.keyword,
            database: data.database,
            export_columns: "Dn,Ur,Po",
            display_limit: 20,
          },
          true,
        ),
      );
    } catch (e) {
      soft_error = fallbackNotice(e);
    }
    const hit = serpRows.find((r) => (r.Dn ?? "").toLowerCase().includes(domain));
    const position = hit ? Number(hit.Po) || null : null;
    const url = hit?.Ur ?? null;

    const { supabase, userId } = context;
    const payload = {
      user_id: userId,
      keyword: data.keyword,
      domain,
      database_code: data.database,
      search_volume: metrics ? Number(metrics.Nq) || null : null,
      cpc: metrics ? Number(metrics.Cp) || null : null,
      competition: metrics ? Number(metrics.Co) || null : null,
      difficulty: metrics ? Number(metrics.Kd) || null : null,
      current_rank: position,
      position_url: url,
      last_checked_at: new Date().toISOString(),
    };

    // Upsert by (user_id, keyword, domain)
    const { data: existing } = await supabase
      .from("seo_keywords")
      .select("id")
      .eq("user_id", userId)
      .eq("keyword", data.keyword)
      .eq("domain", domain)
      .maybeSingle();

    if (existing) {
      await supabase.from("seo_keywords").update(payload).eq("id", existing.id);
    } else {
      await supabase.from("seo_keywords").insert(payload);
    }

    // Append to history for trend tracking
    await supabase.from("seo_keyword_history").insert({
      user_id: userId,
      keyword: data.keyword,
      domain,
      database_code: data.database,
      rank: position,
      search_volume: payload.search_volume,
      difficulty: payload.difficulty,
      cpc: payload.cpc,
      position_url: url,
    });

    return { ...payload, serp: serpRows.slice(0, 10), soft_error };
  });

// ──────────────────────────────────────────────────────────────────
// Page audit: fetch HTML, extract on-page elements, AI scoring
// ──────────────────────────────────────────────────────────────────
function extract(html: string) {
  const pick = (re: RegExp) => (html.match(re)?.[1] ?? "").trim();
  const title = pick(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const metaDescription = pick(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);
  const h1 = pick(/<h1[^>]*>([\s\S]*?)<\/h1>/i).replace(/<[^>]+>/g, "");
  const h2s = Array.from(html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi))
    .map((m) => m[1].replace(/<[^>]+>/g, "").trim())
    .filter(Boolean)
    .slice(0, 20);
  const canonical = pick(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i);
  const ogTitle = pick(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
  const ogImage = pick(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
  const robots = pick(/<meta[^>]+name=["']robots["'][^>]+content=["']([^"']+)["']/i);
  const imagesTotal = (html.match(/<img\b[^>]*>/gi) ?? []).length;
  const imagesWithAlt = (html.match(/<img\b[^>]*\balt=["'][^"']+["'][^>]*>/gi) ?? []).length;
  const links = html.match(/<a\b[^>]*href=["']([^"']+)["']/gi) ?? [];
  const jsonLd = /<script[^>]+type=["']application\/ld\+json["']/i.test(html);
  // Body text (rough)
  const body = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const wordCount = body ? body.split(" ").length : 0;
  return {
    title,
    metaDescription,
    h1,
    h2s,
    canonical,
    ogTitle,
    ogImage,
    robots,
    imagesTotal,
    imagesWithAlt,
    linksTotal: links.length,
    jsonLd,
    wordCount,
    bodySnippet: body.slice(0, 2500),
  };
}

export const auditPage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        url: z.string().url(),
        goal: z.string().max(200).optional(),
        target_keyword: z.string().max(150).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const res = await fetch(data.url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; HappyBeezSEOBot/1.0)" },
      redirect: "follow",
    });
    if (!res.ok) throw new Error(`Kan pagina niet ophalen (${res.status}).`);
    const html = await res.text();
    const ex = extract(html);

    // Heuristic score
    const issues: string[] = [];
    const recs: string[] = [];
    let score = 100;
    const titleLen = ex.title.length;
    if (!ex.title) {
      issues.push("Geen <title>");
      score -= 20;
      recs.push("Voeg een duidelijke <title> toe (50–60 tekens, met je hoofd-keyword vooraan).");
    } else if (titleLen < 30 || titleLen > 65) {
      issues.push(`Title-lengte ${titleLen} (ideaal 50–60)`);
      score -= 7;
      recs.push(`Pas je title aan naar 50–60 tekens. Nu: ${titleLen}.`);
    }
    const mdLen = ex.metaDescription.length;
    if (!ex.metaDescription) {
      issues.push("Geen meta description");
      score -= 15;
      recs.push("Voeg een meta description toe (140–160 tekens, met CTA en keyword).");
    } else if (mdLen < 110 || mdLen > 170) {
      issues.push(`Meta description ${mdLen} tekens (ideaal 140–160)`);
      score -= 5;
    }
    if (!ex.h1) {
      issues.push("Geen H1");
      score -= 15;
      recs.push("Voeg precies één H1 toe met je hoofd-keyword.");
    }
    if (ex.h2s.length < 2) {
      issues.push("Minder dan 2 H2's");
      score -= 5;
      recs.push("Gebruik 3–6 H2's om de pagina te structureren.");
    }
    if (ex.wordCount < 300) {
      issues.push(`Weinig tekst (${ex.wordCount} woorden)`);
      score -= 10;
      recs.push("Breid uit naar minimaal 600–800 woorden voor goede ranking-kans.");
    }
    if (!ex.canonical) {
      issues.push("Geen canonical tag");
      score -= 5;
    }
    if (!ex.ogTitle || !ex.ogImage) {
      issues.push("Open Graph onvolledig (og:title / og:image)");
      score -= 5;
      recs.push("Voeg og:title en og:image toe voor betere previews op socials.");
    }
    if (ex.imagesTotal > 0 && ex.imagesWithAlt / ex.imagesTotal < 0.8) {
      issues.push(`Slechts ${ex.imagesWithAlt}/${ex.imagesTotal} afbeeldingen met alt-tekst`);
      score -= 8;
      recs.push("Geef elke afbeelding een beschrijvende alt-tekst (helpt SEO + toegankelijkheid).");
    }
    if (!ex.jsonLd) {
      issues.push("Geen JSON-LD schema");
      score -= 5;
      recs.push("Voeg JSON-LD toe (Organization / Product / Article) voor rich results.");
    }
    if (/noindex/i.test(ex.robots)) {
      issues.push("noindex actief — pagina wordt niet geïndexeerd!");
      score -= 30;
    }
    if (data.target_keyword) {
      const kw = data.target_keyword.toLowerCase();
      const inTitle = ex.title.toLowerCase().includes(kw);
      const inH1 = ex.h1.toLowerCase().includes(kw);
      const inBody = ex.bodySnippet.toLowerCase().includes(kw);
      if (!inTitle) {
        issues.push(`Keyword "${kw}" niet in title`);
        score -= 8;
        recs.push(`Zet "${kw}" vooraan in je title.`);
      }
      if (!inH1) {
        issues.push(`Keyword "${kw}" niet in H1`);
        score -= 6;
      }
      if (!inBody) {
        issues.push(`Keyword "${kw}" niet in lopende tekst`);
        score -= 6;
      }
    }
    score = Math.max(0, Math.min(100, score));

    // AI summary
    let aiSummary = "";
    try {
      const apiKey = process.env.LOVABLE_API_KEY!;
      const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "openai/gpt-5-mini",
          messages: [
            {
              role: "system",
              content:
                "Je bent SEO-expert. Geef in het Nederlands een beknopte analyse (max 120 woorden) van een pagina-audit. Wees concreet en actiegericht. Gebruik korte alinea's, geen markdown-sterretjes.",
            },
            {
              role: "user",
              content: `URL: ${data.url}\nDoel: ${data.goal ?? "—"}\nDoel-keyword: ${data.target_keyword ?? "—"}\nScore: ${score}\nTitle: ${ex.title}\nMeta: ${ex.metaDescription}\nH1: ${ex.h1}\nH2's: ${ex.h2s.join(" | ")}\nWoorden: ${ex.wordCount}\nProblemen: ${issues.join("; ")}\n\nGeef je top-3 prioriteiten.`,
            },
          ],
        }),
      });
      if (aiRes.ok) {
        const j: { choices?: Array<{ message?: { content?: string } }> } = await aiRes.json();
        aiSummary = j.choices?.[0]?.message?.content?.trim() ?? "";
      }
    } catch {
      // best effort
    }

    const { supabase, userId } = context;
    const { data: saved } = await supabase
      .from("seo_page_audits")
      .insert({
        user_id: userId,
        url: data.url,
        goal: data.goal ?? null,
        target_keyword: data.target_keyword ?? null,
        score,
        title: ex.title || null,
        meta_description: ex.metaDescription || null,
        h1: ex.h1 || null,
        word_count: ex.wordCount,
        issues,
        recommendations: recs,
        ai_summary: aiSummary || null,
      })
      .select("id, created_at")
      .single();

    return {
      id: saved?.id,
      created_at: saved?.created_at,
      url: data.url,
      score,
      extracted: ex,
      issues,
      recommendations: recs,
      ai_summary: aiSummary,
    };
  });
