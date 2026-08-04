import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ─────────────────────────────────────────────────────────────
// Google Ads copy generator + keyword metrics (DataForSEO).
// ─────────────────────────────────────────────────────────────

const DFS_BASE = "https://api.dataforseo.com/v3";

function dfsAuthHeader(): string | null {
  const login = process.env.DATAFORSEO_LOGIN;
  const password = process.env.DATAFORSEO_PASSWORD;
  if (!login || !password) return null;
  return `Basic ${Buffer.from(`${login}:${password}`).toString("base64")}`;
}

function dbToLocation(code: string): { location_code: number; language_code: string } {
  const map: Record<string, { location_code: number; language_code: string }> = {
    nl: { location_code: 2528, language_code: "nl" },
    be: { location_code: 2056, language_code: "nl" },
    de: { location_code: 2276, language_code: "de" },
    us: { location_code: 2840, language_code: "en" },
    uk: { location_code: 2826, language_code: "en" },
  };
  return map[(code || "nl").toLowerCase()] ?? map.nl;
}

type DfsVolumeItem = {
  keyword?: string;
  search_volume?: number | null;
  cpc?: number | null;
  competition?: number | null;
  competition_index?: number | null;
  low_top_of_page_bid?: number | null;
  high_top_of_page_bid?: number | null;
};

export const getAdsKeywordMetrics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        keywords: z.array(z.string().min(1)).min(1).max(200),
        database: z.string().default("nl"),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const auth = dfsAuthHeader();
    if (!auth) {
      return {
        metrics: [] as Array<{
          keyword: string;
          search_volume: number | null;
          cpc: number | null;
          competition: number | null;
          low_bid: number | null;
          high_bid: number | null;
        }>,
        soft_error: "SEO-databron niet gekoppeld — volumes en CPC zijn niet beschikbaar.",
      };
    }

    const { location_code, language_code } = dbToLocation(data.database);
    const uniq = Array.from(new Set(data.keywords.map((k) => k.toLowerCase().trim()))).slice(0, 200);

    const res = await fetch(`${DFS_BASE}/keywords_data/google_ads/search_volume/live`, {
      method: "POST",
      headers: { Authorization: auth, "Content-Type": "application/json" },
      body: JSON.stringify([{ keywords: uniq, location_code, language_code }]),
    });
    const text = await res.text();
    if (!res.ok) {
      return { metrics: [], soft_error: `SEO-databron fout (${res.status}).` };
    }
    const json = JSON.parse(text) as {
      status_code?: number;
      status_message?: string;
      tasks?: Array<{ result: DfsVolumeItem[] | null }>;
    };
    if (json.status_code && json.status_code >= 40000) {
      return { metrics: [], soft_error: `SEO-databron fout: ${json.status_message ?? "onbekend"}` };
    }

    const items = (json.tasks ?? []).flatMap((t) => t.result ?? []);
    const metrics = items
      .filter((i) => i.keyword)
      .map((i) => ({
        keyword: String(i.keyword).toLowerCase(),
        search_volume: i.search_volume ?? null,
        cpc: i.cpc ?? null,
        competition: i.competition_index ?? (i.competition != null ? i.competition * 100 : null),
        low_bid: i.low_top_of_page_bid ?? null,
        high_bid: i.high_top_of_page_bid ?? null,
      }));

    return { metrics, soft_error: null };
  });

// ── AI copy generation ───────────────────────────────────────

const adSchema = z.object({
  campaign_name: z.string(),
  ad_group_name: z.string(),
  final_url: z.string(),
  path1: z.string(),
  path2: z.string(),
  headlines: z.array(z.string()),
  descriptions: z.array(z.string()),
  callouts: z.array(z.string()),
  sitelinks: z.array(
    z.object({ text: z.string(), desc1: z.string(), desc2: z.string() }),
  ),
  structured_snippet_header: z.string(),
  structured_snippet_values: z.array(z.string()),
  keywords: z.array(z.object({ keyword: z.string(), match: z.string() })),
  negative_keywords: z.array(z.string()),
  notes: z.string().optional().default(""),
});

export type GoogleAd = z.infer<typeof adSchema>;

export const generateGoogleAd = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        product: z.string().min(2).max(500),
        landing_url: z.string().min(3).max(300),
        audience: z.string().max(500).default(""),
        usps: z.string().max(1000).default(""),
        cta: z.string().max(100).default(""),
        tone: z.string().max(60).default("warm & deskundig"),
        seed_keywords: z.string().max(1000).default(""),
        brand: z.string().max(200).default(""),
        language: z.string().max(30).default("Nederlands"),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI is niet beschikbaar.");

    const system = [
      "Je bent een senior Google Ads-specialist en SEA-copywriter.",
      `Je schrijft in het ${data.language}.`,
      "Je levert responsive search ads (RSA) die voldoen aan ALLE Google Ads limieten.",
      "HARDE LIMIETEN (nooit overschrijden, tel karakters exact, spaties tellen mee):",
      "- 15 headlines, elk MAXIMAAL 30 tekens (streef naar 26-30).",
      "- 4 descriptions, elk MAXIMAAL 90 tekens (streef naar 84-90).",
      "- path1 en path2: max 15 tekens, geen spaties, alleen woorden of streepjes.",
      "- 8 callout extensies: max 25 tekens per stuk.",
      "- 4 sitelinks: linktekst max 25 tekens, desc1 en desc2 elk max 35 tekens.",
      "- structured snippet header (bv. Types, Merken, Diensten) + 5 waarden van max 25 tekens.",
      "Kwaliteitseisen:",
      "- Zet het belangrijkste zoekwoord letterlijk in minstens 4 headlines (exacte match voor relevantie/kwaliteitsscore).",
      "- Varieer: keyword-headlines, USP-headlines, prijs/aanbod, sociale bewijskracht, CTA-headlines.",
      "- Geen ALLE-HOOFDLETTERS, geen dubbele leestekens, max 1 uitroepteken per description, geen misleidende claims.",
      "- Elke description eindigt met of bevat een duidelijke call-to-action.",
      "- Keywords: 12-18 stuks met match type (exact / phrase / broad), gebaseerd op echte zoekintentie.",
      "- Negatieve zoekwoorden: 8-12 stuks die verkeerde intentie uitsluiten (gratis, vacature, tweedehands, etc. waar relevant).",
      "Antwoord UITSLUITEND met geldige JSON, zonder codeblok, exact volgens dit schema:",
      `{"campaign_name":"","ad_group_name":"","final_url":"","path1":"","path2":"","headlines":["x15"],"descriptions":["x4"],"callouts":["x8"],"sitelinks":[{"text":"","desc1":"","desc2":""}],"structured_snippet_header":"","structured_snippet_values":["x5"],"keywords":[{"keyword":"","match":"exact"}],"negative_keywords":[""],"notes":""}`,
    ].join("\n");

    const prompt = [
      `Product/dienst: ${data.product}`,
      `Landingspagina (final URL): ${data.landing_url}`,
      data.brand ? `Merk: ${data.brand}` : "",
      data.audience ? `Doelgroep: ${data.audience}` : "",
      data.usps ? `USP's: ${data.usps}` : "",
      data.cta ? `Gewenste call-to-action: ${data.cta}` : "",
      data.seed_keywords ? `Belangrijkste zoekwoorden: ${data.seed_keywords}` : "",
      `Tone of voice: ${data.tone}`,
      "",
      "Schrijf nu de complete responsive search ad. Controleer elke tekst op karakterlengte vóór je antwoordt.",
    ]
      .filter(Boolean)
      .join("\n");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3.6-flash",
        messages: [
          { role: "system", content: system },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (res.status === 429) throw new Error("Limiet bereikt — probeer het zo nog eens.");
    if (res.status === 402) throw new Error("AI-tegoed op — voeg credits toe in je werkruimte.");
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`AI fout (${res.status}): ${txt.slice(0, 200)}`);
    }

    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const raw = json.choices?.[0]?.message?.content?.trim() ?? "";
    if (!raw) throw new Error("Lege response van AI.");
    const cleaned = raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      const start = cleaned.indexOf("{");
      const end = cleaned.lastIndexOf("}");
      if (start === -1 || end === -1) throw new Error("AI gaf geen geldige advertentie terug.");
      parsed = JSON.parse(cleaned.slice(start, end + 1));
    }

    const ad = adSchema.parse(parsed);
    return { ad };
  });
