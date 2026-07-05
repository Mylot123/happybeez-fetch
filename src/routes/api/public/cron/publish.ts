import { createFileRoute } from "@tanstack/react-router";

// pg_cron elke 5 min → deze endpoint. Auth via Supabase anon-key in apikey header
// (standaard patroon; /api/public/* bypasst edge-auth).
export const Route = createFileRoute("/api/public/cron/publish")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expectedKey = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY;
        const apiKey = request.headers.get("apikey");
        if (!expectedKey || apiKey !== expectedKey) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const nowIso = new Date().toISOString();
        const { data: due, error } = await supabaseAdmin
          .from("content_calendar_items")
          .select("*")
          .eq("status", "scheduled")
          .lte("scheduled_at", nowIso)
          .limit(25);
        if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

        const results: Array<{ id: string; ok: boolean; error?: string }> = [];
        for (const post of due ?? []) {
          try {
            const { publishPostNowServer } = await import("./_publish-runner");
            const r = await publishPostNowServer(supabaseAdmin, post);
            results.push({ id: (post as any).id, ok: r.ok, error: r.error });
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
