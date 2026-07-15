import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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

const schema = z
  .object({
    filename: z.string().max(200).default("upload"),
    text: z.string().max(60_000).optional(),
    imageB64: z.string().max(15_000_000).optional(),
    contentType: z
      .enum(["image/png", "image/jpeg", "image/webp"])
      .optional(),
  })
  .refine((d) => (d.text && d.text.trim().length > 20) || (d.imageB64 && d.contentType), {
    message: "Geef tekst of een afbeelding mee.",
  });

const SYSTEM =
  "Je bent een merkstrateeg. Antwoord uitsluitend in geldig JSON zonder markdown of uitleg.";

const PROMPT_TAIL = `Geef terug in dit JSON-formaat (kleuren als hex met #, alles Nederlands):
{
  "summary": "1-2 zinnen over waar het merk over gaat en welke sfeer wordt uitgestraald",
  "tone_of_voice": "1 zin, bijv.: warm, deskundig, natuurgericht",
  "style_keywords": ["max 6 kernwoorden voor de visuele stijl"],
  "visual_direction": "1-2 zinnen: welke stijl past bij dit merk (kleuren, typografie, beeldtaal)",
  "suggested_primary": "#hex — de sterkste merkkleur",
  "suggested_secondary": "#hex — passende tweede kleur",
  "palette": ["max 8 hex kleuren uit het document"],
  "fonts": ["max 4 lettertypen uit het document, indien te zien"]
}`;

function parseAI(raw: string) {
  let t = raw.trim();
  if (t.startsWith("```")) t = t.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    return JSON.parse(t) as Record<string, unknown>;
  } catch {
    const m = t.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]) as Record<string, unknown>;
      } catch {
        /* noop */
      }
    }
    return {};
  }
}

export const analyzeBrandDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => schema.parse(data))
  .handler(async ({ data }): Promise<Analysis> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY ontbreekt.");

    const isImage = !!data.imageB64 && !!data.contentType;
    const userContent: unknown = isImage
      ? [
          {
            type: "text",
            text: `Analyseer dit merkdocument/afbeelding (bestand: ${data.filename}). ${PROMPT_TAIL}`,
          },
          {
            type: "image_url",
            image_url: {
              url: `data:${data.contentType};base64,${data.imageB64!.replace(/^data:[^;]+;base64,/, "")}`,
            },
          },
        ]
      : `Analyseer dit merkdocument (bestand: ${data.filename}).\n\nTekstfragment:\n${data.text}\n\n${PROMPT_TAIL}`;

    const model = isImage ? "google/gemini-2.5-flash" : "google/gemini-2.5-flash";

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: userContent },
        ],
      }),
    });

    if (res.status === 429) throw new Error("Limiet bereikt — probeer het zo nog eens.");
    if (res.status === 402) throw new Error("AI-tegoed op — vul aan in je Lovable-werkruimte.");
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`AI-fout (${res.status}): ${t.slice(0, 200)}`);
    }
    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const raw = json.choices?.[0]?.message?.content?.trim() ?? "";
    const ai = parseAI(raw);

    const str = (k: string, fb = "") =>
      typeof ai[k] === "string" ? (ai[k] as string).trim() : fb;
    const arr = (k: string): string[] => {
      const v = ai[k];
      if (!Array.isArray(v)) return [];
      return v
        .filter((x): x is string => typeof x === "string")
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 8);
    };
    const hex = (k: string, fb = "") => {
      const v = str(k);
      return /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : fb;
    };
    const palette = arr("palette")
      .map((c) => c.toLowerCase())
      .filter((c) => /^#[0-9a-f]{6}$/i.test(c));

    return {
      summary: str("summary"),
      tone_of_voice: str("tone_of_voice"),
      style_keywords: arr("style_keywords"),
      visual_direction: str("visual_direction"),
      suggested_primary: hex("suggested_primary", palette[0] ?? ""),
      suggested_secondary: hex("suggested_secondary", palette[1] ?? ""),
      palette,
      fonts: arr("fonts"),
      meta: { title: data.filename, description: "", ogImage: "" },
    };
  });
