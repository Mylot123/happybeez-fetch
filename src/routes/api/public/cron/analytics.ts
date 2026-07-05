import { createFileRoute } from "@tanstack/react-router";

// Dagelijkse pull van Ayrshare Analytics → post_metrics.
// pg_cron roept dit aan met apikey header (Supabase anon-key).
export const Route = createFileRoute("/api/public/cron/analytics")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expectedKey =
          process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY;
        const apiKey = request.headers.get("apikey");
        if (!expectedKey || apiKey !== expectedKey) {
          return new Response("Unauthorized", { status: 401 });
        }

        const ayrKey = process.env.AYRSHARE_API_KEY;
        if (!ayrKey) {
          return Response.json({ ok: false, error: "AYRSHARE_API_KEY ontbreekt" }, { status: 500 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Pak gepubliceerde posts van laatste 30 dagen met ayrshare_post_id
        const since = new Date(Date.now() - 30 * 86400_000).toISOString();
        const { data: posts, error } = await supabaseAdmin
          .from("content_calendar_items")
          .select("id, org_id, channel, ayrshare_post_id, last_publish_attempt_at")
          .eq("status", "published")
          .not("ayrshare_post_id", "is", null)
          .gte("last_publish_attempt_at", since)
          .limit(200);
        if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

        const results: Array<{ id: string; ok: boolean; error?: string }> = [];
        for (const post of posts ?? []) {
          try {
            const res = await fetch(
              `https://api.ayrshare.com/api/analytics/post?id=${encodeURIComponent((post as any).ayrshare_post_id)}`,
              { headers: { Authorization: `Bearer ${ayrKey}` } },
            );
            const body: any = await res.json().catch(() => ({}));
            if (!res.ok) {
              results.push({ id: (post as any).id, ok: false, error: body?.message ?? `HTTP ${res.status}` });
              continue;
            }

            // Ayrshare geeft per platform een object terug: body.instagram, body.facebook, etc.
            const platformKey = ((post as any).channel ?? "").toLowerCase();
            const p = body?.[platformKey] ?? {};
            const analytics = p?.analytics ?? p ?? {};

            const reach = Number(analytics.reach ?? analytics.reachCount ?? 0) || 0;
            const impressions = Number(analytics.impressions ?? analytics.impressionCount ?? 0) || 0;
            const likes = Number(analytics.likes ?? analytics.likeCount ?? 0) || 0;
            const comments = Number(analytics.comments ?? analytics.commentsCount ?? 0) || 0;
            const shares = Number(analytics.shares ?? analytics.shareCount ?? 0) || 0;
            const saves = Number(analytics.saves ?? analytics.saved ?? 0) || 0;
            const clicks = Number(analytics.clicks ?? analytics.linkClicks ?? 0) || 0;
            const base = reach || impressions || 1;
            const engagement_rate = Math.min(
              1,
              (likes + comments + shares + saves) / base,
            );

            const today = new Date();
            today.setUTCHours(0, 0, 0, 0);

            await supabaseAdmin.from("post_metrics").upsert(
              {
                post_id: (post as any).id,
                org_id: (post as any).org_id,
                platform: platformKey,
                provider_post_id: (post as any).ayrshare_post_id,
                reach,
                impressions,
                likes,
                comments,
                shares,
                saves,
                clicks,
                engagement_rate,
                raw: analytics,
                recorded_at: today.toISOString(),
              },
              { onConflict: "post_id,platform,recorded_at" },
            );
            results.push({ id: (post as any).id, ok: true });
          } catch (e) {
            results.push({
              id: (post as any).id,
              ok: false,
              error: e instanceof Error ? e.message : "onbekend",
            });
          }
        }

        return Response.json({ ok: true, processed: results.length, results });
      },
    },
  },
});
