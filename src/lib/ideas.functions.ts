import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const schema = z.object({
  org_id: z.string().uuid(),
  date: z.string().min(4), // YYYY-MM-DD
  channel: z.string().min(2).max(30),
  content_type: z.string().min(2).max(40),
  tone: z.string().max(60).optional(),
  extraContext: z.string().max(1000).optional(),
});

type Idea = { title: string; hook: string; angle?: string };

const MONTHS_NL = [
  "januari", "februari", "maart", "april", "mei", "juni",
  "juli", "augustus", "september", "oktober", "november", "december",
];

export const generateContentIdeas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => schema.parse(d))
  .handler(async ({ data, context }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY is niet beschikbaar.");

    const [yearStr, monthStr, dayStr] = data.date.split("-");
    const year = Number(yearStr);
    const month = Number(monthStr);
    const day = Number(dayStr);

    const { data: brand } = await context.supabase
      .from("brand_profiles")
      .select("industry, audience, tone, pillars, usps")
      .eq("org_id", data.org_id)
      .maybeSingle();

    const { data: plan } = await context.supabase
      .from("campaign_plans")
      .select("id, theme, goal, summary")
      .eq("org_id", data.org_id)
      .eq("year", year)
      .eq("month", month)
      .maybeSingle();

    let blocks: Array<{ name: string; pillar: string | null; week: number | null; hook: string | null; platforms: string[] | null; notes: string | null }> = [];
    if (plan?.id) {
      const { data: bl } = await context.supabase
        .from("campaign_blocks")
        .select("name, pillar, week, hook, platforms, notes")
        .eq("plan_id", plan.id)
        .order("sort_order", { ascending: true });
      blocks = (bl ?? []) as typeof blocks;
    }

    // Which week of the month
    const weekOfMonth = Math.min(4, Math.max(1, Math.ceil(day / 7)));
    const weekBlock = blocks.find((b) => b.week === weekOfMonth) ?? null;

    const brandLine = brand
      ? `Merk: branche=${brand.industry ?? "onbekend"}; doelgroep=${brand.audience ?? "onbekend"}; tone=${brand.tone ?? data.tone ?? "warm & deskundig"}; pijlers=${(brand.pillars ?? []).join(" | ")}; USPs=${(brand.usps ?? []).join(" | ")}.`
      : `Merk: (geen merkprofiel — kies veilige generieke thema's). Tone: ${data.tone ?? "warm & deskundig"}.`;

    const campaignLine = plan
      ? `Actieve maandcampagne (${MONTHS_NL[month - 1]} ${year}): thema="${plan.theme}"${plan.goal ? `, doel="${plan.goal}"` : ""}${plan.summary ? `, samenvatting="${plan.summary}"` : ""}.`
      : `Geen actieve maandcampagne — verzin passende ideeën voor ${MONTHS_NL[month - 1]} ${year}.`;

    const blockLine = weekBlock
      ? `Week ${weekOfMonth}-blok uit de campagne: "${weekBlock.name}"${weekBlock.pillar ? ` (pijler: ${weekBlock.pillar})` : ""}${weekBlock.hook ? `, hook: "${weekBlock.hook}"` : ""}${weekBlock.notes ? `, notities: ${weekBlock.notes}` : ""}.`
      : `Geen specifiek campagne-blok voor week ${weekOfMonth}.`;

    const system =
      "Je bent een senior social media strateeg. Je geeft exact 5 concrete, uiteenlopende content-ideeën voor één post. " +
      "Antwoord uitsluitend in geldig JSON, in het Nederlands, structuur: " +
      `{"ideas":[{"title": string (max 80 tekens, concreet onderwerp), "hook": string (max 120 tekens, eerste regel/scrollstopper), "angle": string (1 zin waarom dit werkt voor dit kanaal en type)}]}.`;

    const prompt = [
      brandLine,
      campaignLine,
      blockLine,
      `Datum van de post: ${data.date}. Kanaal: ${data.channel}. Type content: ${data.content_type}.`,
      "Zorg dat elk idee past bij het gekozen type content (bijv. bij 'educatief' gaat het om leren/kennisoverdracht).",
      "Sluit aan bij het campagnethema en het week-blok als die er zijn. Varieer de 5 ideeën in invalshoek zodat de gebruiker echt kan kiezen.",
      data.extraContext ? `Extra context: ${data.extraContext}` : "",
    ].filter(Boolean).join("\n");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: system },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (res.status === 429) throw new Error("AI-limiet bereikt — probeer het zo nog eens.");
    if (res.status === 402) throw new Error("AI-tegoed op — voeg credits toe in je Lovable-werkruimte.");
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`AI Gateway fout (${res.status}): ${t.slice(0, 200)}`);
    }
    const json = (await res.json()) as { choices: Array<{ message: { content: string } }> };
    const raw = json.choices?.[0]?.message?.content ?? "";
    let parsed: { ideas?: Idea[] };
    try {
      parsed = JSON.parse(raw) as { ideas?: Idea[] };
    } catch {
      throw new Error("AI-antwoord kon niet gelezen worden (geen geldig JSON).");
    }
    const ideas = Array.isArray(parsed.ideas) ? parsed.ideas.slice(0, 5) : [];
    if (ideas.length === 0) throw new Error("Geen ideeën ontvangen.");

    return {
      ideas,
      campaign: plan
        ? { theme: plan.theme, goal: plan.goal, week: weekOfMonth, block: weekBlock?.name ?? null }
        : null,
    };
  });
