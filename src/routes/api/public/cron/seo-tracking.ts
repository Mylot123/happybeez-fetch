import { createFileRoute } from "@tanstack/react-router";

// Cron endpoint: dagelijks alle tracked keywords + concurrenten verversen via DataForSEO.
// Authenticatie via Supabase anon key (apikey header) — pg_cron patroon.
// Aanroep vanuit pg_cron: activeer met SQL in Supabase zodra DATAFORSEO_LOGIN/PASSWORD zijn ingesteld.

export const Route = createFileRoute("/api/public/cron/seo-tracking")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apikey = request.headers.get("apikey") ?? request.headers.get("x-supabase-apikey");
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!expected || apikey !== expected) {
          return new Response("unauthorized", { status: 401 });
        }

        if (!process.env.DATAFORSEO_LOGIN || !process.env.DATAFORSEO_PASSWORD) {
          return Response.json({ ok: false, skipped: "DataForSEO niet geconfigureerd." }, { status: 200 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Groepeer tracked keywords per (org_id, user_id, domain, database_code).
        const { data: kws, error } = await supabaseAdmin
          .from("seo_keywords")
          .select("org_id, user_id, domain, database_code, keyword")
          .not("domain", "is", null);
        if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

        type Group = {
          org_id: string;
          user_id: string;
          domain: string;
          database_code: string;
          keywords: string[];
        };
        const groups = new Map<string, Group>();
        for (const r of kws ?? []) {
          if (!r.domain) continue;
          const key = `${r.org_id}::${r.user_id}::${r.domain}::${r.database_code ?? "nl"}`;
          const g = groups.get(key) ?? {
            org_id: r.org_id,
            user_id: r.user_id,
            domain: r.domain,
            database_code: r.database_code ?? "nl",
            keywords: [],
          };
          g.keywords.push(r.keyword);
          groups.set(key, g);
        }

        const { runDfsGroupRefresh } = await import("./_dfs-runner");
        const results: Array<{ domain: string; checked: number; error?: string }> = [];
        for (const g of groups.values()) {
          try {
            const r = await runDfsGroupRefresh(g);
            results.push({ domain: g.domain, checked: r.checked });
          } catch (e) {
            results.push({ domain: g.domain, checked: 0, error: e instanceof Error ? e.message : String(e) });
          }
        }
        return Response.json({ ok: true, groups: results.length, results });
      },
    },
  },
});
