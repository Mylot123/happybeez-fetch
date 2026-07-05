import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import type { SupabaseClient } from "@supabase/supabase-js";

type SB = SupabaseClient<Database>;

const idSchema = z.object({ id: z.string().uuid() });

async function updateStatus(
  supabase: SB,
  id: string,
  patch: Database["public"]["Tables"]["content_calendar_items"]["Update"],
) {
  const { error } = await supabase.from("content_calendar_items").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export const submitPostForReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => idSchema.parse(d))
  .handler(async ({ data, context }) => updateStatus(context.supabase as SB, data.id, { status: "review" }));

export const revertPostToDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => idSchema.parse(d))
  .handler(async ({ data, context }) => updateStatus(context.supabase as SB, data.id, { status: "draft" }));

export const approvePost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => idSchema.parse(d))
  .handler(async ({ data, context }) => updateStatus(context.supabase as SB, data.id, { status: "approved" }));

const scheduleSchema = z.object({
  id: z.string().uuid(),
  scheduled_at: z.string().datetime(),
});
export const schedulePost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => scheduleSchema.parse(d))
  .handler(async ({ data, context }) =>
    updateStatus(context.supabase as SB, data.id, { status: "scheduled", scheduled_at: data.scheduled_at }),
  );

export const markPostPublished = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => idSchema.parse(d))
  .handler(async ({ data, context }) =>
    updateStatus(context.supabase as SB, data.id, { status: "published", failure_reason: null }),
  );

const rejectSchema = z.object({ id: z.string().uuid(), notes: z.string().max(2000).optional() });
export const rejectPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => rejectSchema.parse(d))
  .handler(async ({ data, context }) =>
    updateStatus(context.supabase as SB, data.id, { status: "draft", review_notes: data.notes ?? null }),
  );

const failSchema = z.object({ id: z.string().uuid(), reason: z.string().max(500) });
export const markPostFailed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => failSchema.parse(d))
  .handler(async ({ data, context }) =>
    updateStatus(context.supabase as SB, data.id, { status: "failed", failure_reason: data.reason }),
  );
