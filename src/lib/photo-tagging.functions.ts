import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CHANNELS = ["instagram", "facebook", "linkedin", "blog"] as const;
const AI_TAG = "ai-getagd";

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["caption", "tags", "channels"],
  properties: {
    caption: { type: "string" },
    tags: { type: "array", items: { type: "string" } },
    channels: { type: "array", items: { type: "string", enum: [...CHANNELS] } },
  },
};

async function describe(apiKey: string, imageUrl: string) {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
    method: "POST",
    headers: {
      "Lovable-API-Key": apiKey,
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model: "openai/gpt-6-astra",
      stream: true,
      store: false,
      reasoning: { effort: "low" },
      instructions:
        "Je beschrijft foto's voor de beeldbank van Happybeez, een maker van handgemaakte bijenhotels uit Boekel (geen honing). Schrijf in het Nederlands, zonder gedachtestreepjes. Schrijf de merknaam als Happybeez.",
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text:
                "Beschrijf deze foto. caption: één feitelijke zin van wat er te zien is (max 160 tekens). tags: 6 tot 10 korte zoekwoorden in kleine letters (onderwerp, insect of bijensoort als herkenbaar, plant, plek, seizoen, sfeer, bv. werkplaats, ambacht, bijenhotel, tuin, balkon, metselbij, lavendel, zomer). Verzin geen bijensoort als je het niet zeker weet. channels: voor welke kanalen de foto geschikt is.",
            },
            { type: "input_image", image_url: imageUrl },
          ],
        },
      ],
      text: { format: { type: "json_schema", name: "fotobeschrijving", strict: true, schema } },
    }),
  });
  if (res.status === 429) throw new Error("AI is druk, probeer het zo opnieuw.");
  if (res.status === 402) throw new Error("AI-tegoed op, voeg credits toe in je werkruimte.");
  if (!res.ok || !res.body) throw new Error(`AI-fout (${res.status})`);
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const d = line.slice(5).trim();
      if (!d || d === "[DONE]") continue;
      try {
        const ev = JSON.parse(d) as { type?: string; delta?: string };
        if (ev.type === "response.output_text.delta" && ev.delta) text += ev.delta;
      } catch {
        /* noop */
      }
    }
  }
  return JSON.parse(text) as { caption: string; tags: string[]; channels: string[] };
}

/** Laat AI de foto's bekijken en vult beschrijving, tags en geschikte kanalen in. */
export const autoTagPhotos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ photo_ids: z.array(z.string().uuid()).min(1).max(10) }).parse(d))
  .handler(async ({ data, context }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY ontbreekt.");
    // RLS: alleen foto's die deze gebruiker mag zien
    const { data: rows, error } = await context.supabase
      .from("library_photos")
      .select("id,caption,tags,storage_path,suggested_channels")
      .in("id", data.photo_ids);
    if (error) throw new Error(error.message);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let done = 0;
    let failed = 0;
    for (const row of rows ?? []) {
      if (!row.storage_path) {
        failed++;
        continue;
      }
      try {
        const { data: signed } = await supabaseAdmin.storage
          .from("library-photos")
          .createSignedUrl(row.storage_path, 600);
        if (!signed?.signedUrl) throw new Error("geen url");
        const r = await describe(apiKey, signed.signedUrl);
        const tags = Array.from(
          new Set([
            ...(row.tags ?? []),
            ...r.tags.map((t) => t.toLowerCase().trim()).filter(Boolean).slice(0, 10),
            AI_TAG,
          ]),
        );
        const channels = Array.from(new Set([...(row.suggested_channels ?? []), ...r.channels]));
        const { error: upErr } = await supabaseAdmin
          .from("library_photos")
          .update({
            caption: row.caption?.trim() ? row.caption : r.caption.replace(/\s[—–-]\s/g, ", ").slice(0, 500),
            tags,
            suggested_channels: channels,
          })
          .eq("id", row.id);
        if (upErr) throw upErr;
        done++;
      } catch (e) {
        if (e instanceof Error && /tegoed|druk/.test(e.message)) throw e;
        failed++;
      }
    }
    return { done, failed };
  });
