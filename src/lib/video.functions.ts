import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const renderSchema = z.object({
  org_id: z.string().uuid(),
  template_id: z.string().uuid(),
  variables: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
});

export const listVideoTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("video_templates")
      .select("id, name, description, thumbnail_url, aspect_ratio, variables_schema, creatomate_template_id")
      .eq("is_active", true)
      .order("name");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const renderVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => renderSchema.parse(data))
  .handler(async ({ data, context }) => {
    // Toegang: alleen org-leden
    const { data: isMember } = await context.supabase.rpc("is_org_member", {
      _user_id: context.userId,
      _org_id: data.org_id,
    });
    if (!isMember) throw new Error("Geen toegang tot deze organisatie.");

    const { data: template, error: tErr } = await context.supabase
      .from("video_templates")
      .select("id, creatomate_template_id, aspect_ratio")
      .eq("id", data.template_id)
      .single();
    if (tErr || !template) throw new Error("Template niet gevonden.");

    const apiKey = process.env.CREATOMATE_API_KEY;
    if (!apiKey) throw new Error("CREATOMATE_API_KEY ontbreekt in de omgeving.");

    // Webhook-URL — stabiele preview/prod URL
    const origin = process.env.PUBLIC_APP_URL ?? "";
    const webhookUrl = origin ? `${origin}/api/public/hooks/creatomate` : undefined;

    const res = await fetch("https://api.creatomate.com/v1/renders", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        template_id: (template as any).creatomate_template_id,
        modifications: data.variables,
        webhook_url: webhookUrl,
      }),
    });
    const body: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = body?.error ?? body?.message ?? `Creatomate ${res.status}`;
      throw new Error(msg);
    }

    const jobs = Array.isArray(body) ? body : [body];
    const first = jobs[0] ?? {};
    const jobId: string = first?.id ?? crypto.randomUUID();
    const url: string = first?.url ?? "";
    const status: string = first?.status === "succeeded" ? "ready" : "rendering";

    // Log asset (pending) — webhook vult later url/status aan
    const { data: asset, error: aErr } = await context.supabase
      .from("media_assets")
      .insert({
        org_id: data.org_id,
        type: "video",
        url,
        source: "creatomate",
        format: (template as any).aspect_ratio,
        template_id: data.template_id,
        render_job_id: jobId,
        render_status: status,
        meta: { modifications: data.variables },
        created_by: context.userId,
      })
      .select()
      .single();
    if (aErr) throw new Error(aErr.message);

    return { asset, provider: first };
  });
