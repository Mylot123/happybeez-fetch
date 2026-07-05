import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const idSchema = z.object({ id: z.string().uuid() });

async function updateStatus(
  context: { supabase: { from: (t: string) => { update: (v: Record<string, unknown>) => { eq: (col: string, val: string) => Promise<{ error: { message: string } | null }> } } } },
  id: string,
  patch: Record<string, unknown>,
) {
  const { error } = await context.supabase
    .from("content_calendar_items")
    .update(patch)
    .eq("id", id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export const submitPostForReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => idSchema.parse(d))
  .handler(async ({ data, context }) => updateStatus(context, data.id, { status: "review" }));

export const revertPostToDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => idSchema.parse(d))
  .handler(async ({ data, context }) => updateStatus(context, data.id, { status: "draft" }));

export const approvePost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => idSchema.parse(d))
  .handler(async ({ data, context }) => updateStatus(context, data.id, { status: "approved" }));

const scheduleSchema = z.object({
  id: z.string().uuid(),
  scheduled_at: z.string().datetime(),
});
export const schedulePost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => scheduleSchema.parse(d))
  .handler(async ({ data, context }) =>
    updateStatus(context, data.id, { status: "scheduled", scheduled_at: data.scheduled_at }),
  );

export const markPostPublished = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => idSchema.parse(d))
  .handler(async ({ data, context }) =>
    updateStatus(context, data.id, { status: "published", failure_reason: null }),
  );

const rejectSchema = z.object({ id: z.string().uuid(), notes: z.string().max(2000).optional() });
export const rejectPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => rejectSchema.parse(d))
  .handler(async ({ data, context }) =>
    updateStatus(context, data.id, { status: "draft", review_notes: data.notes ?? null }),
  );

const failSchema = z.object({ id: z.string().uuid(), reason: z.string().max(500) });
export const markPostFailed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => failSchema.parse(d))
  .handler(async ({ data, context }) =>
    updateStatus(context, data.id, { status: "failed", failure_reason: data.reason }),
  );
