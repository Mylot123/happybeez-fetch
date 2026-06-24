import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const inputSchema = z.object({
  prompt: z.string().min(3).max(1500),
});

type ImageResponse = {
  data?: Array<{ b64_json?: string }>;
};

export const generatePostImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => inputSchema.parse(data))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY ontbreekt.");

    const styledPrompt = `${data.prompt}

Stijl: natuurlijke fotografie, zacht middagzonlicht, ondiep scherptediepte, Nederlandse tuin/natuur, warme aardetinten (mosgroen, honinggeel, hout), authentiek en rustig. Geen tekst, geen logo's, geen watermerk. Vierkant compositie geschikt voor Instagram.
BELANGRIJK over bijen: toon WILDE/SOLITAIRE bijen waar mogelijk (metselbijen, behangersbijen). Geen honingbijen-korven. Geen mensen met bijenpakken. Een bijenhotel mag zichtbaar zijn als handgemaakt houten blok met diepe gladde nestgangen.`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
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
    return { b64 };
  });
