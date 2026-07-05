import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const HEX = /#(?:[0-9a-f]{3}|[0-9a-f]{6})\b/gi;
const RGB = /rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/gi;

function rgbToHex(r: number, g: number, b: number) {
  const h = (n: number) => n.toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`.toLowerCase();
}

function extractColors(html: string): string[] {
  const set = new Map<string, number>();
  const bump = (c: string) => set.set(c, (set.get(c) ?? 0) + 1);
  for (const m of html.matchAll(HEX)) {
    let c = m[0].toLowerCase();
    if (c.length === 4) c = `#${c[1]}${c[1]}${c[2]}${c[2]}${c[3]}${c[3]}`;
    bump(c);
  }
  for (const m of html.matchAll(RGB)) {
    bump(rgbToHex(Number(m[1]), Number(m[2]), Number(m[3])));
  }
  // Drop pure white/black/greys — usually generic.
  const generic = new Set([
    "#000000", "#ffffff", "#fefefe", "#fafafa", "#f5f5f5", "#eeeeee",
    "#cccccc", "#999999", "#666666", "#333333", "#222222", "#111111",
  ]);
  return [...set.entries()]
    .filter(([c]) => !generic.has(c))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([c]) => c);
}

function extractFonts(html: string): string[] {
  const fonts = new Set<string>();
  for (const m of html.matchAll(/font-family:\s*([^;"'}]+)/gi)) {
    const first = m[1].split(",")[0].trim().replace(/["']/g, "");
    if (first && first.length < 40 && !/inherit|initial|unset|sans-serif|serif|monospace/i.test(first)) {
      fonts.add(first);
    }
  }
  for (const m of html.matchAll(/fonts\.googleapis\.com\/css2?\?family=([^"&'\s]+)/gi)) {
    const f = decodeURIComponent(m[1]).replace(/\+/g, " ").split(":")[0];
    if (f) fonts.add(f);
  }
  return [...fonts].slice(0, 8);
}

function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractMeta(html: string) {
  const pick = (re: RegExp) => html.match(re)?.[1]?.trim();
  return {
    title: pick(/<title[^>]*>([^<]+)<\/title>/i) ?? "",
    description:
      pick(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)/i) ??
      pick(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)/i) ??
      "",
    ogImage: pick(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)/i) ?? "",
  };
}

type Analysis = {
  summary: string;
  tone_of_voice: string;
  style_keywords: string[];
  visual_direction: string;
  suggested_primary: string;
  suggested_secondary: string;
  palette: string[];
  fonts: string[];
  meta: { title: string; description: string; ogImage: string };
};

async function callAI(prompt: string): Promise<string> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY ontbreekt.");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content:
            "Je bent een merkstrateeg. Antwoord uitsluitend in geldig JSON zonder markdown of uitleg.",
        },
        { role: "user", content: prompt },
      ],
    }),
  });
  if (res.status === 429) throw new Error("Limiet bereikt — probeer het zo nog eens.");
  if (res.status === 402) throw new Error("AI-tegoed op — vul aan in je Lovable-werkruimte.");
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`AI-fout (${res.status}): ${t.slice(0, 200)}`);
  }
  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return json.choices?.[0]?.message?.content?.trim() ?? "";
}

function parseAI(raw: string) {
  let t = raw.trim();
  if (t.startsWith("```")) t = t.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    return JSON.parse(t) as Record<string, unknown>;
  } catch {
    const m = t.match(/\{[\s\S]*\}/);
    if (m) {
      try { return JSON.parse(m[0]) as Record<string, unknown>; } catch { /* noop */ }
    }
    return {};
  }
}

function normalizeUrl(input: string): string {
  let u = input.trim();
  if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
  return u;
}

export const analyzeWebsiteForBrand = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({
      url: z.string().min(3).max(300),
    }).parse(data),
  )
  .handler(async ({ data }): Promise<Analysis> => {
    const url = normalizeUrl(data.url);

    let res: Response;
    try {
      res = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; HappyBeezMerkanalyse/1.0; +https://happybeez.nl)",
          Accept: "text/html,application/xhtml+xml",
        },
        redirect: "follow",
      });
    } catch (e) {
      throw new Error(`Kon website niet ophalen: ${e instanceof Error ? e.message : "onbekend"}`);
    }
    if (!res.ok) throw new Error(`Website gaf status ${res.status} terug.`);
    const html = (await res.text()).slice(0, 400_000);

    const palette = extractColors(html);
    const fonts = extractFonts(html);
    const meta = extractMeta(html);
    const text = stripTags(html).slice(0, 6000);

    const prompt = `Je krijgt informatie over een website. Beschrijf de huisstijl-uitgangspunten in het Nederlands.

Website: ${url}
Titel: ${meta.title}
Meta-beschrijving: ${meta.description}
Kleuren (uit CSS/HTML): ${palette.join(", ") || "onbekend"}
Fonts (uit CSS/HTML): ${fonts.join(", ") || "onbekend"}

Zichtbare tekst (fragment):
${text}

Geef terug in dit JSON-formaat (kleuren als hex met #):
{
  "summary": "1-2 zinnen over waar de site over gaat en welke sfeer wordt uitgestraald",
  "tone_of_voice": "1 zin, bijvoorbeeld: warm, deskundig, natuurgericht",
  "style_keywords": ["max 6 kernwoorden voor de visuele stijl"],
  "visual_direction": "1-2 zinnen: welke stijl past bij dit merk (kleuren, typografie, beeldtaal)",
  "suggested_primary": "#hex — de sterkste merkkleur",
  "suggested_secondary": "#hex — passende tweede kleur"
}`;

    let ai: Record<string, unknown> = {};
    try {
      const raw = await callAI(prompt);
      ai = parseAI(raw);
    } catch (e) {
      // Val terug op basisanalyse zonder AI.
      ai = { summary: e instanceof Error ? e.message : "AI-analyse mislukt." };
    }

    const str = (k: string, fb = "") =>
      typeof ai[k] === "string" ? (ai[k] as string).trim() : fb;
    const arr = (k: string): string[] => {
      const v = ai[k];
      if (!Array.isArray(v)) return [];
      return v.filter((x): x is string => typeof x === "string").slice(0, 8);
    };
    const hex = (k: string, fb: string) => {
      const v = str(k);
      return /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : fb;
    };

    return {
      summary: str("summary", meta.description || meta.title),
      tone_of_voice: str("tone_of_voice"),
      style_keywords: arr("style_keywords"),
      visual_direction: str("visual_direction"),
      suggested_primary: hex("suggested_primary", palette[0] ?? ""),
      suggested_secondary: hex("suggested_secondary", palette[1] ?? ""),
      palette,
      fonts,
      meta,
    };
  });
