import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MONTHS_NL = [
  "januari", "februari", "maart", "april", "mei", "juni",
  "juli", "augustus", "september", "oktober", "november", "december",
];

const genSchema = z.object({
  org_id: z.string().uuid(),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2024).max(2100),
  extraContext: z.string().max(2000).optional(),
});

type PlanJson = {
  theme: string;
  goal: string;
  summary: string;
  blocks: Array<{
    name: string;
    pillar?: string;
    week?: number;
    hook?: string;
    platforms?: string[];
    notes?: string;
  }>;
};

async function callGateway(apiKey: string, system: string, prompt: string) {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
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
  return json.choices?.[0]?.message?.content ?? "";
}

export const generateCampaignPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => genSchema.parse(data))
  .handler(async ({ context, data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY is niet beschikbaar.");

    const { data: brand } = await context.supabase
      .from("brand_profiles")
      .select("industry, audience, tone, pillars, usps, website")
      .eq("org_id", data.org_id)
      .maybeSingle();

    const monthName = MONTHS_NL[data.month - 1];
    const system =
      "Je bent een senior social media strateeg. Je maakt een maandcampagne-plan voor een specifiek merk. " +
      "Antwoord uitsluitend in geldig JSON, in het Nederlands. Structuur: " +
      `{"theme": string, "goal": string, "summary": string, "blocks": [{"name": string, "pillar": string, "week": number (1-4), "hook": string, "platforms": string[], "notes": string}]}. ` +
      "Maak 4 blokken (één per week), variatie in pijler en platform (facebook, instagram, linkedin, youtube).";

    const brandLine = brand
      ? `Merk: branche=${brand.industry ?? "onbekend"}; doelgroep=${brand.audience ?? "onbekend"}; tone=${brand.tone ?? "warm & deskundig"}; pijlers=${(brand.pillars ?? []).join(" | ")}; USPs=${(brand.usps ?? []).join(" | ")}.`
      : "Merk: (nog geen merkprofiel — kies veilige generieke thema's).";

    // Feedback-loop: haal analytics-samenvatting laatste 30 dagen op
    const since30 = new Date(Date.now() - 30 * 86400_000).toISOString();
    const { data: metrics } = await context.supabase
      .from("post_metrics")
      .select("platform, reach, engagement_rate")
      .eq("org_id", data.org_id)
      .gte("recorded_at", since30);

    let analyticsLine = "";
    if (metrics && metrics.length) {
      const byP: Record<string, { r: number; e: number; n: number }> = {};
      for (const m of metrics as any[]) {
        const k = m.platform;
        if (!byP[k]) byP[k] = { r: 0, e: 0, n: 0 };
        byP[k].r += Number(m.reach) || 0;
        byP[k].e += Number(m.engagement_rate) || 0;
        byP[k].n += 1;
      }
      const summary = Object.entries(byP)
        .map(([p, v]) => `${p}: ${v.r} bereik, ${((v.e / v.n) * 100).toFixed(1)}% engagement`)
        .join(" | ");
      analyticsLine = `Analytics laatste 30 dagen: ${summary}. Zet de best-presterende kanalen vaker in.`;
    }

    const prompt = [
      brandLine,
      `Maand: ${monthName} ${data.year}.`,
      "Denk aan seizoen, NL-feestdagen en actuele momenten in die maand.",
      analyticsLine,
      data.extraContext ? `Extra context: ${data.extraContext}` : "",
    ].filter(Boolean).join("\n");

    const raw = await callGateway(apiKey, system, prompt);
    let parsed: PlanJson;
    try {
      parsed = JSON.parse(raw) as PlanJson;
    } catch {
      throw new Error("AI-antwoord kon niet gelezen worden (geen geldig JSON).");
    }
    if (!parsed.theme || !Array.isArray(parsed.blocks)) {
      throw new Error("AI-antwoord miste verplichte velden.");
    }

    // Snapshot existing plan (if any) before overwrite so it can be restored
    const { data: existing } = await context.supabase
      .from("campaign_plans")
      .select("id, theme, goal, summary, status")
      .eq("org_id", data.org_id)
      .eq("year", data.year)
      .eq("month", data.month)
      .maybeSingle();

    if (existing?.id) {
      const { data: existingBlocks } = await context.supabase
        .from("campaign_blocks")
        .select("name, pillar, week, hook, platforms, notes, sort_order")
        .eq("plan_id", existing.id)
        .order("sort_order", { ascending: true });

      await context.supabase.from("campaign_plan_versions").insert({
        plan_id: existing.id,
        org_id: data.org_id,
        prev_status: existing.status,
        created_by: context.userId,
        snapshot: {
          theme: existing.theme,
          goal: existing.goal,
          summary: existing.summary,
          status: existing.status,
          blocks: existingBlocks ?? [],
        },
      });
    }

    const { data: plan, error: planErr } = await context.supabase
      .from("campaign_plans")
      .upsert(
        {
          org_id: data.org_id,
          month: data.month,
          year: data.year,
          theme: parsed.theme,
          goal: parsed.goal ?? null,
          summary: parsed.summary ?? null,
          status: "concept",
          created_by: context.userId,
        },
        { onConflict: "org_id,year,month" },
      )
      .select("id")
      .single();
    if (planErr) throw new Error(planErr.message);

    // Replace blocks
    await context.supabase.from("campaign_blocks").delete().eq("plan_id", plan.id);

    const blockRows = parsed.blocks.slice(0, 8).map((b, i) => ({
      plan_id: plan.id,
      org_id: data.org_id,
      name: (b.name ?? `Blok ${i + 1}`).slice(0, 200),
      pillar: b.pillar ?? null,
      week: typeof b.week === "number" ? Math.min(Math.max(b.week, 1), 6) : i + 1,
      hook: b.hook ?? null,
      platforms: Array.isArray(b.platforms) ? b.platforms.slice(0, 6) : [],
      notes: b.notes ?? null,
      sort_order: i,
    }));

    if (blockRows.length) {
      const { error: blkErr } = await context.supabase
        .from("campaign_blocks")
        .insert(blockRows);
      if (blkErr) throw new Error(blkErr.message);
    }

    return { plan_id: plan.id };
  });

const approveSchema = z.object({
  plan_id: z.string().uuid(),
  status: z.enum(["concept", "approved", "active", "archived"]),
});

export const setCampaignPlanStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => approveSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("campaign_plans")
      .update({ status: data.status })
      .eq("id", data.plan_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const restoreSchema = z.object({
  version_id: z.string().uuid(),
});

type BlockSnap = {
  name?: string;
  pillar?: string | null;
  week?: number | null;
  hook?: string | null;
  platforms?: string[] | null;
  notes?: string | null;
  sort_order?: number | null;
};

export const restoreCampaignPlanVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => restoreSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { data: version, error: verErr } = await context.supabase
      .from("campaign_plan_versions")
      .select("id, plan_id, org_id, snapshot")
      .eq("id", data.version_id)
      .maybeSingle();
    if (verErr) throw new Error(verErr.message);
    if (!version) throw new Error("Versie niet gevonden");

    const snap = (version.snapshot ?? {}) as {
      theme?: string;
      goal?: string | null;
      summary?: string | null;
      status?: string;
      blocks?: BlockSnap[];
    };

    // Snapshot the current state first so restore itself is also reversible
    const { data: current } = await context.supabase
      .from("campaign_plans")
      .select("id, theme, goal, summary, status")
      .eq("id", version.plan_id)
      .maybeSingle();
    if (current) {
      const { data: currentBlocks } = await context.supabase
        .from("campaign_blocks")
        .select("name, pillar, week, hook, platforms, notes, sort_order")
        .eq("plan_id", current.id)
        .order("sort_order", { ascending: true });
      await context.supabase.from("campaign_plan_versions").insert({
        plan_id: current.id,
        org_id: version.org_id,
        prev_status: current.status,
        created_by: context.userId,
        snapshot: {
          theme: current.theme,
          goal: current.goal,
          summary: current.summary,
          status: current.status,
          blocks: currentBlocks ?? [],
        },
      });
    }

    const { error: updErr } = await context.supabase
      .from("campaign_plans")
      .update({
        theme: snap.theme ?? "Hersteld plan",
        goal: snap.goal ?? null,
        summary: snap.summary ?? null,
        status: "concept",
      })
      .eq("id", version.plan_id);
    if (updErr) throw new Error(updErr.message);

    await context.supabase.from("campaign_blocks").delete().eq("plan_id", version.plan_id);

    const blocks = Array.isArray(snap.blocks) ? snap.blocks : [];
    if (blocks.length) {
      const rows = blocks.map((b, i) => ({
        plan_id: version.plan_id,
        org_id: version.org_id,
        name: (b.name ?? `Blok ${i + 1}`).slice(0, 200),
        pillar: b.pillar ?? null,
        week: typeof b.week === "number" ? Math.min(Math.max(b.week, 1), 6) : i + 1,
        hook: b.hook ?? null,
        platforms: Array.isArray(b.platforms) ? b.platforms.slice(0, 6) : [],
        notes: b.notes ?? null,
        sort_order: typeof b.sort_order === "number" ? b.sort_order : i,
      }));
      const { error: insErr } = await context.supabase.from("campaign_blocks").insert(rows);
      if (insErr) throw new Error(insErr.message);
    }

    return { plan_id: version.plan_id };
  });
