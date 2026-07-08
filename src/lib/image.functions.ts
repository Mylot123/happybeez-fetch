import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const FORMATS = ["1:1", "4:5", "9:16", "16:9"] as const;
type Format = (typeof FORMATS)[number];

const genSchema = z.object({
  prompt: z.string().min(3).max(1500),
  format: z.enum(FORMATS).default("1:1"),
  org_id: z.string().uuid(),
  channel: z.string().max(50).optional(),
  title: z.string().max(200).optional(),
  caption: z.string().max(500).optional(),
  save: z.boolean().default(true),
});

const uploadSchema = z.object({
  org_id: z.string().uuid(),
  filename: z.string().min(1).max(200),
  content_type: z.enum(["image/png", "image/jpeg", "image/webp"]),
  b64: z.string().min(10),
  title: z.string().min(1).max(200),
  caption: z.string().max(500).optional(),
  channel: z.string().max(50).optional(),
  extra_tags: z.array(z.string().max(40)).max(10).optional(),
});

const FALLBACK_STYLE =
  "natuurlijke fotografie, zacht middagzonlicht, ondiep scherptediepte, Nederlandse tuin/natuur, warme aardetinten, authentiek en rustig. Geen tekst, geen logo's, geen watermerk. Wilde/solitaire bijen tonen waar relevant; geen honingbijen-korven of bijenpakken.";

const FORMAT_HINT: Record<Format, string> = {
  "1:1": "vierkante compositie 1:1, geschikt voor Instagram/Facebook feed",
  "4:5": "portret compositie 4:5, geschikt voor Instagram feed portret",
  "9:16": "verticale compositie 9:16, geschikt voor Stories/Reels/TikTok",
  "16:9": "horizontale compositie 16:9, geschikt voor LinkedIn/YouTube/blog",
};

async function loadBrandStyle(supabase: any, orgId: string): Promise<string> {
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
  return parts.join(". ") || FALLBACK_STYLE;
}

/** Extract a base64 image payload from any known AI response shape. */
function extractImageB64(json: any): string | undefined {
  const stripDataUrl = (s: string) =>
    s.startsWith("data:") ? s.split(",")[1] : s;

  // OpenAI /v1/images/generations
  const dataArr = json?.data;
  if (Array.isArray(dataArr) && dataArr.length) {
    const first = dataArr[0];
    if (typeof first?.b64_json === "string") return first.b64_json;
    if (typeof first?.url === "string") return stripDataUrl(first.url);
  }

  const msg = json?.choices?.[0]?.message;

  // OpenAI-compatible chat with images[] (OpenRouter/Gemini)
  const images = msg?.images;
  if (Array.isArray(images) && images.length) {
    const first = images[0];
    const url = first?.image_url?.url ?? first?.url ?? first?.b64_json;
    if (typeof url === "string") return stripDataUrl(url);
  }

  // content as string containing a data URL
  if (typeof msg?.content === "string") {
    const m = msg.content.match(/data:image\/[a-zA-Z]+;base64,([A-Za-z0-9+/=]+)/);
    if (m) return m[1];
  }

  // content parts array
  if (Array.isArray(msg?.content)) {
    for (const p of msg.content) {
      if (p?.type === "image_url" && typeof p?.image_url?.url === "string") {
        return stripDataUrl(p.image_url.url);
      }
      if (typeof p?.image_base64 === "string") return p.image_base64;
      if (p?.inline_data?.data) return p.inline_data.data;
      if (p?.inlineData?.data) return p.inlineData.data;
    }
  }

  // Vertex-shape candidates
  const cand = json?.candidates?.[0]?.content?.parts;
  if (Array.isArray(cand)) {
    for (const p of cand) {
      if (p?.inlineData?.data) return p.inlineData.data;
      if (p?.inline_data?.data) return p.inline_data.data;
      if (typeof p?.text === "string") {
        const m = p.text.match(/data:image\/[a-zA-Z]+;base64,([A-Za-z0-9+/=]+)/);
        if (m) return m[1];
      }
    }
  }

  return undefined;
}

async function assertOrgMember(supabase: any, userId: string, orgId: string) {
  const { data, error } = await supabase
    .from("organization_members")
    .select("org_id")
    .eq("user_id", userId)
    .eq("org_id", orgId)
    .maybeSingle();
  if (error || !data) throw new Error("Geen toegang tot deze organisatie.");
}

export const generatePostImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => genSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertOrgMember(context.supabase, context.userId, data.org_id);

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

    if (res.status === 429)
      throw new Error("AI is druk — probeer het over een minuut opnieuw.");
    if (res.status === 402)
      throw new Error("AI-tegoed op — voeg credits toe in je werkruimte.");
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(
        `Beeldgeneratie mislukt (${res.status}). Probeer opnieuw. ${txt.slice(0, 160)}`,
      );
    }

    let json: any;
    try {
      json = await res.json();
    } catch {
      throw new Error("Onverwacht antwoord van de AI. Probeer opnieuw.");
    }

    const b64Raw = extractImageB64(json);
    if (!b64Raw) {
      console.error(
        "Beeld-respons zonder afbeelding:",
        JSON.stringify(json).slice(0, 800),
      );
      throw new Error("De AI stuurde geen bruikbaar beeld terug. Probeer opnieuw.");
    }
    const b64 = b64Raw.replace(/^data:image\/[a-zA-Z]+;base64,/, "");

    if (!data.save) return { b64, format: data.format, photo: null as null };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let bytes: Uint8Array;
    try {
      bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    } catch {
      throw new Error("AI-beeld kon niet gedecodeerd worden. Probeer opnieuw.");
    }

    const filename = `generated/${data.org_id}/${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}.png`;

    const { error: upErr } = await supabaseAdmin.storage
      .from("library-photos")
      .upload(filename, bytes, { contentType: "image/png", upsert: false });
    if (upErr) throw new Error(`Uploaden mislukt: ${upErr.message}`);

    const title = (data.title || "AI-beeld").slice(0, 120);
    const tags = ["ai-gegenereerd", ...(data.channel ? [data.channel] : [])];
    const suggested = data.channel ? [data.channel] : [];

    const { data: row, error: insErr } = await supabaseAdmin
      .from("library_photos")
      .insert({
        org_id: data.org_id,
        title,
        caption: data.caption ?? null,
        tags,
        suggested_channels: suggested,
        storage_path: filename,
        image_url: filename,
      })
      .select("id,title,caption,tags,storage_path,image_url")
      .single();
    if (insErr) throw new Error(`Opslaan in bibliotheek mislukt: ${insErr.message}`);

    const { data: signed } = await supabaseAdmin.storage
      .from("library-photos")
      .createSignedUrl(filename, 60 * 60 * 8);

    return {
      b64,
      format: data.format,
      photo: { ...row, image_url: signed?.signedUrl ?? row.image_url },
    };
  });

export const uploadUserPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => uploadSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertOrgMember(context.supabase, context.userId, data.org_id);

    const cleanB64 = data.b64.replace(/^data:[^;]+;base64,/, "");
    let bytes: Uint8Array;
    try {
      bytes = Uint8Array.from(atob(cleanB64), (c) => c.charCodeAt(0));
    } catch {
      throw new Error("Bestand kon niet gelezen worden.");
    }
    if (bytes.byteLength === 0) throw new Error("Bestand is leeg.");
    if (bytes.byteLength > 10 * 1024 * 1024)
      throw new Error("Bestand is te groot (max 10 MB).");

    const ext =
      data.content_type === "image/png"
        ? "png"
        : data.content_type === "image/webp"
          ? "webp"
          : "jpg";
    const safeBase = data.filename
      .replace(/\.[^.]+$/, "")
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .slice(0, 60);
    const path = `uploads/${data.org_id}/${Date.now()}-${safeBase || "foto"}.${ext}`;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: upErr } = await supabaseAdmin.storage
      .from("library-photos")
      .upload(path, bytes, { contentType: data.content_type, upsert: false });
    if (upErr) throw new Error(`Uploaden mislukt: ${upErr.message}`);

    const { data: row, error: insErr } = await supabaseAdmin
      .from("library_photos")
      .insert({
        org_id: data.org_id,
        title: data.title.slice(0, 120),
        caption: data.caption ?? null,
        tags: ["upload", ...(data.channel ? [data.channel] : [])],
        suggested_channels: data.channel ? [data.channel] : [],
        storage_path: path,
        image_url: path,
      })
      .select("id,title,caption,tags,storage_path,image_url")
      .single();
    if (insErr) throw new Error(`Opslaan mislukt: ${insErr.message}`);

    const { data: signed } = await supabaseAdmin.storage
      .from("library-photos")
      .createSignedUrl(path, 60 * 60 * 8);

    return { ...row, image_url: signed?.signedUrl ?? row.image_url };
  });
