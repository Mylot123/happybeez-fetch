import { createFileRoute } from "@tanstack/react-router";

// Creatomate webhook — vult media_assets.url + render_status aan na afronden.
export const Route = createFileRoute("/api/public/hooks/creatomate")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let payload: any = {};
        try {
          payload = await request.json();
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const jobId: string | undefined = payload?.id;
        if (!jobId) return Response.json({ ok: true, ignored: true });

        const status: string =
          payload?.status === "succeeded"
            ? "ready"
            : payload?.status === "failed"
              ? "failed"
              : "rendering";
        const url: string | undefined = payload?.url;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await supabaseAdmin
          .from("media_assets")
          .update({
            render_status: status,
            url: url ?? undefined,
            meta: { ...(payload ?? {}) },
          })
          .eq("render_job_id", jobId);

        return Response.json({ ok: true });
      },
    },
  },
});
