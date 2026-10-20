import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import type { SupabaseClient } from "@supabase/supabase-js";

type SB = SupabaseClient<Database>;

const CHANNEL_TIME: Record<string, string> = {
  instagram: "13:00",
  facebook: "19:00",
  linkedin: "08:30",
};

const MONTHS = [
  "januari", "februari", "maart", "april", "mei", "juni",
  "juli", "augustus", "september", "oktober", "november", "december",
];

const SYSTEM = `Je schrijft social posts voor Happybeez: handgemaakte, natuurvriendelijke bijenhotels uit Boekel.
Regels:
- Schrijf de merknaam altijd als "Happybeez".
- Happybeez verkoopt GEEN honing; noem nooit honing als product.
- Focus op wilde en solitaire bijen, biodiversiteit en ambacht.
- Verzin geen prijzen, voorraad, levertijden, cijfers of feiten.
- Gebruik nooit gedachtestreepjes of koppelstreepjes tussen zinsdelen (geen —, – of " - ").
- Sterke hook in de eerste regel, menselijke concrete toon, geen AI-clichés.
- Instagram: 80 tot 160 woorden, 3 tot 5 hashtags onderaan, 1 CTA (opslaan/delen).
- Facebook: kort (40 tot 90 woorden), deelbaar, hooguit 2 hashtags, geen engagement-bait.
- LinkedIn: 120 tot 220 woorden, eerste twee regels samen onder 210 tekens, vakmanschap en ondernemerschap, hooguit 3 hashtags.
Alles in het Nederlands.`;

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["posts"],
  properties: {
    posts: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["channel", "title", "text", "photo_keywords"],
        properties: {
          channel: { type: "string", enum: ["instagram", "facebook", "linkedin"] },
          title: { type: "string" },
          text: { type: "string" },
          photo_keywords: { type: "array", items: { type: "string" } },
        },
      },
    },
  },
};

function stripDashes(s: string) {
  return s.replace(/\s[—–-]\s/g, ", ").replace(/[—–]/g, ",");
}

function tokens(words: string[]) {
  return Array.from(
    new Set(
      words
        .flatMap((w) => w.toLowerCase().split(/[^a-zà-ÿ0-9]+/))
        .filter((w) => w.length >= 4),
    ),
  ).slice(0, 10);
}

async function findPhotos(supabase: SB, keywords: string[], exclude: string[] = []) {
  const toks = tokens(keywords);
  let q = supabase
    .from("library_photos")
    .select("id,title,tags,storage_path,image_url")
    .order("created_at", { ascending: false })
    .limit(40);
  if (toks.length) {
    q = q.or([`tags.ov.{${toks.join(",")}}`, ...toks.map((t) => `title.ilike.*${t}*`)].join(","));
  }
  const { data } = await q;
  const rows = (data ?? []).filter((r) => !exclude.includes(r.storage_path ?? r.image_url));
  const scored = rows
    .map((r) => {
      const hay = `${r.title} ${(r.tags ?? []).join(" ")}`.toLowerCase();
      return { r, s: toks.reduce((n, t) => n + (hay.includes(t) ? 1 : 0), 0) };
    })
    .sort((a, b) => b.s - a.s);
  return scored.map((x) => x.r);
}

async function photoFields(supabase: SB, photo: { storage_path: string | null; image_url: string } | undefined) {
  if (!photo) return { image_url: null, image_storage_path: null };
  let url = photo.image_url;
  if (photo.storage_path) {
    const { data } = await supabase.storage
      .from("library-photos")
      .createSignedUrl(photo.storage_path, 60 * 60 * 24 * 7);
    if (data?.signedUrl) url = data.signedUrl;
  }
  return { image_url: url, image_storage_path: photo.storage_path };
}

export const generateWeekProposals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ orgId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as SB;
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI is niet geconfigureerd.");

    const now = new Date();
    const month = MONTHS[now.getMonth()];
    const prompt = `Het is ${month}. Maak precies 3 posts voor deze week: 1 Instagram, 1 Facebook, 1 LinkedIn.
Kies seizoensgebonden onderwerpen die passen bij ${month} (wat doen wilde bijen nu, wat kun je in de tuin doen, bijenhotel onderhouden of ophangen, het ambacht in de werkplaats in Boekel).
Drie verschillende onderwerpen. Geef per post 3 tot 6 Nederlandse zoekwoorden om een passende foto te vinden (bijv. bijensoort, bijenhotel, werkplaats, tuin, bloem).`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        reasoning: { effort: "low" },
        instructions: SYSTEM,
        input: prompt,
        text: { format: { type: "json_schema", name: "week_posts", strict: true, schema } },
      }),
    });
    if (res.status === 429) throw new Error("Even te druk, probeer het over een minuut opnieuw.");
    if (res.status === 402) throw new Error("Het AI-tegoed is op. Vul het tegoed aan en probeer opnieuw.");
    if (!res.ok) throw new Error(`Het maken van voorstellen lukte niet (${res.status}).`);
    const json = (await res.json()) as {
      output_text?: string;
      output?: Array<{ content?: Array<{ type: string; text?: string }> }>;
    };
    const raw =
      json.output_text ??
      json.output?.flatMap((o) => o.content ?? []).find((c) => c.type === "output_text")?.text ??
      "";
    if (!raw) throw new Error("De AI gaf geen antwoord.");
    const parsed = JSON.parse(raw) as {
      posts: Array<{ channel: string; title: string; text: string; photo_keywords: string[] }>;
    };

    const used: string[] = [];
    let created = 0;
    for (const [i, p] of parsed.posts.slice(0, 3).entries()) {
      const photos = await findPhotos(supabase, [...p.photo_keywords, p.title], used);
      const pick = photos[0];
      if (pick) used.push(pick.storage_path ?? pick.image_url);
      const day = new Date(now);
      day.setDate(now.getDate() + 1 + i * 2);
      const publish_date = day.toISOString().slice(0, 10);
      const { error } = await supabase.from("content_calendar_items").insert({
        user_id: context.userId,
        org_id: data.orgId,
        title: stripDashes(p.title),
        channel: p.channel,
        content_type: "post",
        status: "review",
        source_type: "autopilot",
        publish_date,
        content_text: stripDashes(p.text),
        notes: p.photo_keywords.join(", "),
        ...(await photoFields(supabase, pick)),
      });
      if (error) throw new Error(error.message);
      created++;
    }
    return { created };
  });

export const swapPostPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as SB;
    const { data: post, error } = await supabase
      .from("content_calendar_items")
      .select("title,notes,image_storage_path,image_url")
      .eq("id", data.id)
      .single();
    if (error || !post) throw new Error("Post niet gevonden.");
    const current = post.image_storage_path ?? post.image_url ?? "";
    const photos = await findPhotos(supabase, [post.notes ?? "", post.title], [current]);
    const top = photos.slice(0, 12);
    const pick = top[Math.floor(Math.random() * top.length)];
    if (!pick) throw new Error("Geen andere passende foto gevonden.");
    const fields = await photoFields(supabase, pick);
    const { error: upErr } = await supabase.from("content_calendar_items").update(fields).eq("id", data.id);
    if (upErr) throw new Error(upErr.message);
    return fields;
  });

export const approveAndSchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as SB;
    const { data: post } = await supabase
      .from("content_calendar_items")
      .select("channel,publish_date")
      .eq("id", data.id)
      .single();
    if (!post) throw new Error("Post niet gevonden.");
    const date = post.publish_date ?? new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const time = CHANNEL_TIME[post.channel] ?? "12:00";
    // Nederlandse tijd (CET/CEST) benaderd met +01:00/+02:00 via Date-parsing van lokale offset is niet betrouwbaar op de server; gebruik vaste Europe/Amsterdam offset.
    const probe = new Date(`${date}T12:00:00Z`);
    const offsetHours =
      Number(
        new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Amsterdam", hour: "2-digit", hour12: false }).format(probe),
      ) - 12;
    const scheduled = new Date(`${date}T${time}:00Z`);
    scheduled.setUTCHours(scheduled.getUTCHours() - offsetHours);
    if (scheduled.getTime() < Date.now()) scheduled.setTime(Date.now() + 15 * 60000);
    const { error } = await supabase
      .from("content_calendar_items")
      .update({ status: "scheduled", scheduled_at: scheduled.toISOString(), review_notes: null })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { scheduled_at: scheduled.toISOString() };
  });
