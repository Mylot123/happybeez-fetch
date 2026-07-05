import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const FORMATS = ["1:1", "4:5", "9:16", "16:9"] as const;
type Format = (typeof FORMATS)[number];

const inputSchema = z.object({
  prompt: z.string().min(3).max(1500),
  format: z.enum(FORMATS).default("1:1"),
  org_id: z.string().uuid().optional(),
});

const FALLBACK_STYLE =
  "natuurlijke fotografie, zacht middagzonlicht, ondiep scherptediepte, Nederlandse tuin/natuur, warme aardetinten, authentiek en rustig. Geen tekst, geen logo's, geen watermerk. Wilde/solitaire bijen tonen waar relevant; geen honingbijen-korven of bijenpakken.";

const FORMAT_HINT: Record<Format, string> = {
  "1:1": "vierkante compositie, geschikt voor Instagram feed",
  "4:5": "portret compositie 4:5, geschikt voor Instagram feed portret",
  "9:16": "verticale compositie 9:16, geschikt voor Stories/Reels/TikTok",
  "16:9": "horizontale compositie 16:9, geschikt voor LinkedIn/YouTube",
};

async function loadBrandStyle(supabase: any, orgId?: string): Promise<string> {
  if (!orgId) return FALLBACK_STYLE;
  const { data } = await supabase
    .from("brand_profiles")
    .select("industry, audience, tone, pillars, visual_style, brand_colors")
    .eq("org_id", orgId)
    .maybeSingle();
  if (!data) return FALLBACK_STYLE;
  const parts: string[] = [];
  if (data.visual_style) parts.push(`visuele stijl: ${data.visual_style}`);
  if (data.tone) parts.push(`toon: ${data.tone}`);
  if (Array.isArray(data.brand_colors) && data.brand_colors.length)
    parts.push(`merkkleuren ${data.brand_colors.join(", ")}`);
  if (data.industry) parts.push(`branche: ${data.industry}`);
  if (Array.isArray(data.pillars) && data.pillars.length)
    parts.push(`content-pijlers: ${data.pillars.slice(0, 3).join(", ")}`);
  parts.push("geen tekst, geen logo's, geen watermerk, natuurlijk licht");
  return parts.join(". ");
}

export const generatePostImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => inputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY ontbreekt.");

    const brandStyle = await loadBrandStyle(context.supabase, data.org_id);
    const styledPrompt = `${data.prompt}\n\nStijl: ${brandStyle}. ${FORMAT_HINT[data.format]}.`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [{ role: "user", content: styledPrompt }],
        modalities: ["image", "text"],
      }),
    });

    if (res.status === 429) throw new Error("Limiet bereikt — probeer het zo nog eens.");
    if (res.status === 402) throw new Error("AI-tegoed op — voeg credits toe in je Lovable-werkruimte.");
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`Beeldgeneratie mislukt (${res.status}): ${txt.slice(0, 200)}`);
    }

    const json: any = await res.json();
    let b64: string | undefined = json?.data?.[0]?.b64_json;
    if (!b64) {
      const images = json?.choices?.[0]?.message?.images;
      const url: string | undefined = images?.[0]?.image_url?.url ?? images?.[0]?.url;
      if (url?.startsWith("data:")) b64 = url.split(",")[1];
      else if (url) b64 = url;
    }
    if (!b64) {
      console.error("Beeldgeneratie respons zonder afbeelding:", JSON.stringify(json).slice(0, 500));
      throw new Error("Geen afbeelding ontvangen.");
    }
    return { b64, format: data.format };
  });
