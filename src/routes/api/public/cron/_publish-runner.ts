// Server-only publish helper (Ayrshare) — geen route, wordt geïmporteerd door cron.
const AYRSHARE_PLATFORM: Record<string, string | null> = {
  instagram: "instagram",
  linkedin: "linkedin",
  facebook: "facebook",
  youtube: "youtube",
  blog: null,
  website: null,
};

export async function publishPostNowServer(supabaseAdmin: any, post: any) {
  const platformKey = (post.channel ?? "").toLowerCase();
  const ayr = AYRSHARE_PLATFORM[platformKey];
  const orgId = post.org_id;
  const now = new Date().toISOString();

  if (ayr === null) {
    await supabaseAdmin
      .from("content_calendar_items")
      .update({ status: "published", last_publish_attempt_at: now })
      .eq("id", post.id);
    await supabaseAdmin.from("publish_attempts").insert({
      post_id: post.id,
      org_id: orgId,
      platform: platformKey,
      status: "success",
      provider: "local",
    });
    return { ok: true };
  }
  if (ayr === undefined) return { ok: false, error: `Kanaal ${platformKey} niet ondersteund` };

  const key = process.env.AYRSHARE_API_KEY;
  if (!key) return { ok: false, error: "AYRSHARE_API_KEY ontbreekt" };

  const mediaUrls: string[] = Array.isArray(post.media_urls) ? post.media_urls : [];
  const res = await fetch("https://api.ayrshare.com/api/post", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      post: (post.content_text ?? post.title ?? "").toString().slice(0, 2200),
      platforms: [ayr],
      mediaUrls: mediaUrls.length ? mediaUrls : undefined,
    }),
  });
  const body: any = await res.json().catch(() => ({}));

  if (!res.ok) {
    const err = body?.message ?? `Ayrshare ${res.status}`;
    await supabaseAdmin
      .from("content_calendar_items")
      .update({
        status: "failed",
        last_publish_attempt_at: now,
        retry_count: (post.retry_count ?? 0) + 1,
        failure_reason: err,
      })
      .eq("id", post.id);
    await supabaseAdmin.from("publish_attempts").insert({
      post_id: post.id,
      org_id: orgId,
      platform: platformKey,
      status: "failed",
      provider: "ayrshare",
      response: body,
      error: err,
    });
    return { ok: false, error: err };
  }

  const providerId: string | undefined = body?.id ?? body?.postIds?.[0]?.id ?? body?.postIds?.[0];
  await supabaseAdmin
    .from("content_calendar_items")
    .update({
      status: "published",
      ayrshare_post_id: providerId,
      last_publish_attempt_at: now,
      failure_reason: null,
    })
    .eq("id", post.id);
  await supabaseAdmin.from("publish_attempts").insert({
    post_id: post.id,
    org_id: orgId,
    platform: platformKey,
    status: "success",
    provider: "ayrshare",
    provider_post_id: providerId,
    response: body,
  });
  return { ok: true };
}
