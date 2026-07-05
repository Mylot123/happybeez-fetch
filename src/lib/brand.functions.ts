import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const upsertSchema = z.object({
  org_id: z.string().uuid(),
  industry: z.string().max(500).optional().nullable(),
  audience: z.string().max(1000).optional().nullable(),
  tone: z.string().max(500).optional().nullable(),
  pillars: z.array(z.string().max(120)).max(12).default([]),
  pillar_mix: z
    .array(z.object({ name: z.string().max(120), weight: z.number().int().min(0).max(100) }))
    .max(12)
    .default([]),
  usps: z.array(z.string().max(200)).max(12).default([]),
  primary_color: z.string().max(20).optional().nullable(),
  secondary_color: z.string().max(20).optional().nullable(),
  website: z.string().max(400).optional().nullable(),
});

export const saveBrandProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => upsertSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { data: existing } = await context.supabase
      .from("brand_profiles")
      .select("id")
      .eq("org_id", data.org_id)
      .maybeSingle();

    if (existing) {
      const { error } = await context.supabase
        .from("brand_profiles")
        .update(data)
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
      return { id: existing.id };
    }

    const { data: inserted, error } = await context.supabase
      .from("brand_profiles")
      .insert(data)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: inserted.id };
  });
