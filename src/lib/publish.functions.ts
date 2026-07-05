import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Map interne kanalen -> Ayrshare platform-strings.
// Blog/website worden lokaal als "published" gemarkeerd (geen social-publisher).
const AYRSHARE_PLATFORM: Record<string, string | null> = {
  instagram: "instagram",
  linkedin: "linkedin",
  facebook: "facebook",
  youtube: "youtube",
  blog: null,
  website: null,
};

type PublishResult = {
  ok: boolean;
  status: string;
  provider_post_id?: string;
  error?: string;
};

async function callAyrshare(payload: {
  post: string;
  platforms: string[];
  mediaUrls?: string[];
  scheduleDate?: string;
}): Promise<{ ok: boolean; providerId?: string; body: unknown; error?: string }> {
  const key = process.env.AYRSHARE_API_KEY;
  if (!key) {
    return { ok: false, body: null, error: "AYRSHARE_API_KEY ontbreekt in de omgeving." };
  }
  const res = await fetch("https://api.ayrshare.com/api/post", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const body: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, body, error: body?.message ?? `Ayrshare ${res.status}` };
  }
  const providerId: string | undefined = body?.id ?? body?.postIds?.[0]?.id ?? body?.postIds?.[0];
  return { ok: true, providerId, body };
}

async function publishOne(
  supabase: any,
  post: any,
  orgId: string,
): Promise<PublishResult> {
  const platformKey = (post.channel ?? "").toLowerCase();
  const ayrPlatform = AYRSHARE_PLATFORM[platformKey];

  // Skip niet-social kanalen — gewoon als published markeren
  if (ayrPlatform === null) {
    await supabase
      .from("content_calendar_items")
      .update({ status: "published", last_publish_attempt_at: new Date().toISOString() })
      .eq("id", post.id);
    await supabase.from("publish_attempts").insert({
      post_id: post.id,
      org_id: orgId,
      platform: platformKey,
      status: "success",
      provider: "local",
      response: { note: "Kanaal zonder social publisher" },
    });
    return { ok: true, status: "published" };
  }
  if (ayrPlatform === undefined) {
    return { ok: false, status: "failed", error: `Kanaal ${platformKey} niet ondersteund` };
  }

  const mediaUrls: string[] = Array.isArray(post.media_urls) ? post.media_urls : [];
  const result = await callAyrshare({
    post: (post.content_text ?? post.title ?? "").toString().slice(0, 2200),
    platforms: [ayrPlatform],
    mediaUrls: mediaUrls.length ? mediaUrls : undefined,
  });

  const now = new Date().toISOString();
  if (!result.ok) {
    await supabase
      .from("content_calendar_items")
      .update({
        status: "failed",
        last_publish_attempt_at: now,
        retry_count: (post.retry_count ?? 0) + 1,
        failure_reason: result.error ?? "Onbekende fout",
      })
      .eq("id", post.id);
    await supabase.from("publish_attempts").insert({
      post_id: post.id,
      org_id: orgId,
      platform: platformKey,
      status: "failed",
      provider: "ayrshare",
      response: result.body as any,
      error: result.error,
    });
    return { ok: false, status: "failed", error: result.error };
  }

  await supabase
    .from("content_calendar_items")
    .update({
      status: "published",
      ayrshare_post_id: result.providerId,
      last_publish_attempt_at: now,
      failure_reason: null,
    })
    .eq("id", post.id);
  await supabase.from("publish_attempts").insert({
    post_id: post.id,
    org_id: orgId,
    platform: platformKey,
    status: "success",
    provider: "ayrshare",
    provider_post_id: result.providerId,
    response: result.body as any,
  });
  return { ok: true, status: "published", provider_post_id: result.providerId };
}

// Publiceer één post direct (admin action)
export const publishPostNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ post_id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: post, error } = await context.supabase
      .from("content_calendar_items")
      .select("*")
      .eq("id", data.post_id)
      .single();
    if (error || !post) throw new Error("Post niet gevonden.");

    const orgId = (post as any).org_id;
    if (!orgId) throw new Error("Post heeft geen organisatie.");

    const { data: isAdmin } = await context.supabase.rpc("has_org_role", {
      _user_id: context.userId,
      _org_id: orgId,
      _role: "org_admin",
    });
    const { data: isAgency } = await context.supabase.rpc("has_org_role", {
      _user_id: context.userId,
      _org_id: orgId,
      _role: "agency_admin",
    });
    if (!isAdmin && !isAgency) throw new Error("Alleen beheerders mogen publiceren.");

    return publishOne(context.supabase, post, orgId);
  });

// Retry een gefaalde post
export const retryFailedPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ post_id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: post } = await context.supabase
      .from("content_calendar_items")
      .select("*")
      .eq("id", data.post_id)
      .single();
    if (!post) throw new Error("Post niet gevonden.");
    return publishOne(context.supabase, post, (post as any).org_id);
  });
