import { createFileRoute } from "@tanstack/react-router";

// Ayrshare webhook — na publish stuurt Ayrshare status naar deze URL.
// Config in Ayrshare-dashboard: https://project--<id>.lovable.app/api/public/hooks/ayrshare
export const Route = createFileRoute("/api/public/hooks/ayrshare")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let payload: any = {};
        try {
          payload = await request.json();
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const providerId: string | undefined =
          payload?.id ?? payload?.postId ?? payload?.refId;
        const status: string | undefined = payload?.status ?? payload?.event;
        if (!providerId) return Response.json({ ok: true, ignored: true });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: post } = await supabaseAdmin
          .from("content_calendar_items")
          .select("id, org_id, channel")
          .eq("ayrshare_post_id", providerId)
          .maybeSingle();

        if (!post) return Response.json({ ok: true, unknown: providerId });

        const mapped =
          status === "success" || status === "published"
            ? "published"
            : status === "error" || status === "failed"
              ? "failed"
              : null;

        if (mapped) {
          await supabaseAdmin
            .from("content_calendar_items")
            .update({
              status: mapped,
              failure_reason: mapped === "failed" ? (payload?.message ?? "Ayrshare fout") : null,
            })
            .eq("id", (post as any).id);
        }

        await supabaseAdmin.from("publish_attempts").insert({
          post_id: (post as any).id,
          org_id: (post as any).org_id,
          platform: (post as any).channel,
          status: mapped === "failed" ? "failed" : "success",
          provider: "ayrshare",
          provider_post_id: providerId,
          response: payload,
          error: mapped === "failed" ? (payload?.message ?? null) : null,
        });

        return Response.json({ ok: true });
      },
    },
  },
});
