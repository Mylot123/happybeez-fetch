import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const S = { type: "string" } as const;
const SA = { type: "array", items: S } as const;
const obj = (props: Record<string, unknown>) => ({
  type: "object",
  properties: props,
  required: Object.keys(props),
  additionalProperties: false,
});
const INTENT_SCHEMA = obj({
  intent_expected: S,
  intent_page: S,
  match: { type: "boolean" },
  uitleg: S,
  snippet_voorstel: S,
  vraagkoppen: { type: "array", items: obj({ vraag: S, antwoord: S }) },
  acties: SA,
});
const BLOG_SCHEMA = obj({
  titel: S,
  meta: S,
  intro: S,
  secties: { type: "array", items: obj({ kop: S, antwoord: S, punten: SA }) },
  ervaring: SA,
  interne_links: SA,
});

async function aiJson(system: string, prompt: string, schema: object): Promise<Record<string, unknown>> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("AI is niet beschikbaar.");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model: "openai/gpt-6-astra",
      stream: true,
      store: false,
      reasoning: { effort: "low" },
      instructions: system + " Schrijf de merknaam als Happybeez. Gebruik geen gedachtestreepjes.",
      input: [{ role: "user", content: prompt }],
      text: { format: { type: "json_schema", name: "result", strict: true, schema } },
    }),
  });
  if (res.status === 429) throw new Error("Even te veel aanvragen, probeer het zo opnieuw.");
  if (res.status === 402) throw new Error("AI-tegoed is op.");
  if (!res.ok || !res.body) throw new Error(`AI-fout (${res.status})`);
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let out = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const l of lines) {
      if (!l.startsWith("data:")) continue;
      const d = l.slice(5).trim();
      if (!d || d === "[DONE]") continue;
      try {
        const ev = JSON.parse(d) as { type?: string; delta?: string };
        if (ev.type === "response.output_text.delta" && ev.delta) out += ev.delta;
      } catch { /* noop */ }
    }
  }
  try {
    return JSON.parse(out);
  } catch {
    const m = out.match(/\{[\s\S]*\}/);
    return m ? JSON.parse(m[0]) : {};
  }
}

const clean = (s: string) =>
  s.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();

function parsePage(html: string) {
  const body = html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ");
  const pick = (re: RegExp) => clean(body.match(re)?.[1] ?? "");
  const title = pick(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const meta =
    body.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)/i)?.[1] ?? "";
  const h1 = pick(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const headings = [...body.matchAll(/<h([23])[^>]*>([\s\S]*?)<\/h\1>/gi)]
    .map((m) => ({ level: Number(m[1]), text: clean(m[2]) }))
    .filter((h) => h.text)
    .slice(0, 40);
  const lists = [...body.matchAll(/<(ul|ol)[^>]*>([\s\S]*?)<\/\1>/gi)].filter(
    (m) => (m[2].match(/<li/gi) ?? []).length >= 3,
  ).length;
  const tables = (body.match(/<table/gi) ?? []).length;
  const schema = [...html.matchAll(/"@type"\s*:\s*"([^"]+)"/g)].map((m) => m[1]);
  const text = clean(body.replace(/<(nav|header|footer)[\s\S]*?<\/\1>/gi, " "));
  return { title, meta: clean(meta), h1, headings, lists, tables, schema: [...new Set(schema)], text };
}

export type IntentCheck = {
  url: string;
  keyword: string;
  score: number;
  intent: { expected: string; page: string; match: boolean; uitleg: string };
  checks: Array<{ label: string; ok: boolean; tip: string }>;
  snippet_voorstel: string;
  vraagkoppen: Array<{ vraag: string; antwoord: string }>;
  acties: string[];
  woorden: number;
};

export const checkIntentSnippet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ url: z.string().min(3).max(400), keyword: z.string().min(2).max(120) }).parse(d))
  .handler(async ({ data }): Promise<IntentCheck> => {
    const url = /^https?:\/\//i.test(data.url) ? data.url : `https://${data.url}`;
    const kw = data.keyword.toLowerCase().trim();
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; HappybeezSEO/1.0)", Accept: "text/html" },
      redirect: "follow",
    }).catch(() => null);
    if (!res || !res.ok) throw new Error(`Kon de pagina niet ophalen${res ? ` (status ${res.status})` : ""}.`);
    const p = parsePage((await res.text()).slice(0, 500_000));
    const words = p.text.split(/\s+/).filter(Boolean);
    const first100 = words.slice(0, 100).join(" ").toLowerCase();
    const kwParts = kw.split(/\s+/).filter((w) => w.length > 2);
    const has = (s: string) => kwParts.length > 0 && kwParts.every((w) => s.toLowerCase().includes(w));
    const questionHeads = p.headings.filter((h) => /\?$|^(hoe|wat|waar|wanneer|waarom|welke|welk|kan|moet)\b/i.test(h.text));

    const checks = [
      { label: "Zoekwoord in paginatitel", ok: has(p.title), tip: "Zet het zoekwoord vooraan in de paginatitel." },
      { label: "Zoekwoord in hoofdkop (H1)", ok: has(p.h1), tip: "Gebruik het zoekwoord in de grote kop bovenaan." },
      { label: "Zoekwoord in eerste 100 woorden", ok: has(first100), tip: "Noem het zoekwoord in de eerste alinea." },
      { label: "Pakkende metabeschrijving", ok: p.meta.length >= 70 && p.meta.length <= 160, tip: "Schrijf een beschrijving van 70 tot 160 tekens." },
      { label: "Koppen als vraag (voor 'Mensen vragen ook')", ok: questionHeads.length >= 2, tip: "Maak minstens 2 tussenkoppen in vraagvorm." },
      { label: "Opsomming of tabel (voor uitgelicht antwoord)", ok: p.lists + p.tables > 0, tip: "Voeg een stappenlijst of vergelijkingstabel toe." },
      { label: "Genoeg inhoud", ok: words.length >= 300, tip: "Breid de tekst uit tot minstens 300 tot 800 woorden." },
      { label: "Gestructureerde gegevens (schema)", ok: p.schema.length > 0, tip: "Laat de webbouwer Product- of Article-schema toevoegen." },
    ];

    const ai = await aiJson(
      "Je bent een nuchtere SEO-specialist voor Happybeez, maker van handgemaakte bijenhotels uit Boekel (geen honing).",
      `Zoekwoord: "${data.keyword}"
Pagina: ${url}
Titel: ${p.title}
H1: ${p.h1}
Meta: ${p.meta}
Koppen: ${p.headings.map((h) => h.text).join(" | ")}
Tekst (begin): ${words.slice(0, 700).join(" ")}

Geef JSON:
{
 "intent_expected": "informatief|commercieel|transactioneel|navigatie (wat de zoeker wil)",
 "intent_page": "informatief|commercieel|transactioneel|navigatie (wat de pagina biedt)",
 "match": true/false,
 "uitleg": "1 tot 2 zinnen in gewone taal waarom het wel of niet past",
 "snippet_voorstel": "Een direct antwoord van 40 tot 55 woorden dat bovenaan de pagina kan staan en Google letterlijk kan overnemen",
 "vraagkoppen": [{"vraag":"vraag die zoekers stellen","antwoord":"antwoord van 30 tot 50 woorden"}] (3 stuks),
 "acties": ["max 5 concrete verbeterpunten, belangrijkste eerst"]
}
Verzin geen prijzen, cijfers of levertijden.`,
      INTENT_SCHEMA,
    );

    const okCount = checks.filter((c) => c.ok).length;
    const match = ai.match === true;
    const score = Math.round((okCount / checks.length) * 70 + (match ? 30 : 0));
    const str = (v: unknown) => (typeof v === "string" ? v : "");
    return {
      url,
      keyword: data.keyword,
      score,
      intent: { expected: str(ai.intent_expected), page: str(ai.intent_page), match, uitleg: str(ai.uitleg) },
      checks,
      snippet_voorstel: str(ai.snippet_voorstel),
      vraagkoppen: Array.isArray(ai.vraagkoppen)
        ? (ai.vraagkoppen as Array<{ vraag?: string; antwoord?: string }>).slice(0, 5).map((v) => ({ vraag: str(v.vraag), antwoord: str(v.antwoord) }))
        : [],
      acties: Array.isArray(ai.acties) ? (ai.acties as unknown[]).map(str).filter(Boolean).slice(0, 6) : [],
      woorden: words.length,
    };
  });

export type BlogConcept = {
  titel: string;
  meta: string;
  intro: string;
  secties: Array<{ kop: string; antwoord: string; punten: string[] }>;
  ervaring: string[];
  interne_links: string[];
};

export const generateBlogConcept = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ keyword: z.string().min(2).max(120) }).parse(d))
  .handler(async ({ data }): Promise<BlogConcept> => {
    const ai = await aiJson(
      "Je schrijft blogstructuren voor happybeez.nl. Happybeez maakt handgemaakte bijenhotels in Boekel voor wilde en solitaire bijen, geen honing. Toon: vakman, nuchter, concreet.",
      `Maak een blogconcept voor het zoekwoord "${data.keyword}" dat kans maakt op een uitgelicht antwoord en 'Mensen vragen ook'.
JSON:
{
 "titel": "SEO-titel max 60 tekens, zoekwoord vooraan",
 "meta": "metabeschrijving 120 tot 155 tekens",
 "intro": "eerste alinea van 40 tot 55 woorden die de vraag direct beantwoordt en het zoekwoord bevat",
 "secties": [{"kop":"tussenkop als vraag","antwoord":"direct antwoord 30 tot 50 woorden","punten":["optionele opsomming"]}] (4 tot 6 secties),
 "ervaring": ["3 ideeën om eigen ervaring uit de werkplaats te tonen, bijvoorbeeld een foto of observatie"],
 "interne_links": ["2 tot 3 suggesties voor links naar productpagina's van Happybeez"]
}
Verzin geen cijfers, onderzoeken of klanten.`,
      BLOG_SCHEMA,
    );
    const str = (v: unknown) => (typeof v === "string" ? v : "");
    const arr = (v: unknown) => (Array.isArray(v) ? v.map(str).filter(Boolean) : []);
    return {
      titel: str(ai.titel),
      meta: str(ai.meta),
      intro: str(ai.intro),
      secties: Array.isArray(ai.secties)
        ? (ai.secties as Array<Record<string, unknown>>).map((s) => ({ kop: str(s.kop), antwoord: str(s.antwoord), punten: arr(s.punten) }))
        : [],
      ervaring: arr(ai.ervaring),
      interne_links: arr(ai.interne_links),
    };
  });
