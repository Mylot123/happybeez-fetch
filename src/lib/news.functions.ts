import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const inputSchema = z.object({
  query: z.string().min(2).max(300).optional(),
  recency: z.enum(["day", "week", "month"]).optional(),
});

type NewsResult = {
  title: string;
  source: string | null;
  url: string | null;
  summary: string;
  relevance: number;
};

type PplxResponse = {
  choices: Array<{ message: { content: string } }>;
  citations?: string[];
  search_results?: Array<{ title?: string; url?: string; date?: string }>;
};

export const fetchBeeNews = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => inputSchema.parse(data ?? {}))
  .handler(async ({ data }) => {
    const apiKey = process.env.PERPLEXITY_API_KEY;
    if (!apiKey) throw new Error("PERPLEXITY_API_KEY ontbreekt.");

    const query =
      data.query ??
      "recent nieuws over wilde bijen, solitaire bijen, bestuivers, biodiversiteit en bijenhotels in Nederland en België";
    const recency = data.recency ?? "week";

    const system = `Je bent een nieuwsredacteur voor HappyBeez, een merk voor natuurvriendelijke bijenhotels. Vind 6 tot 8 recente, relevante nieuwsartikelen. Antwoord ALLEEN met geldig JSON in dit formaat:
{"items":[{"title":"...","source":"domeinnaam","url":"https://...","summary":"2-3 zinnen in het Nederlands","relevance":1-10}]}
Geen markdown, geen uitleg, alleen JSON.`;

    const res = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sonar",
        messages: [
          { role: "system", content: system },
          { role: "user", content: query },
        ],
        search_recency_filter: recency,
        return_citations: true,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "news",
            schema: {
              type: "object",
              properties: {
                items: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      title: { type: "string" },
                      source: { type: "string" },
                      url: { type: "string" },
                      summary: { type: "string" },
                      relevance: { type: "number" },
                    },
                    required: ["title", "summary"],
                  },
                },
              },
              required: ["items"],
            },
          },
        },
      }),
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`Perplexity ${res.status}: ${txt.slice(0, 200)}`);
    }

    const json = (await res.json()) as PplxResponse;
    const content = json.choices?.[0]?.message?.content ?? "{}";
    let parsed: { items?: NewsResult[] } = {};
    try {
      parsed = JSON.parse(content);
    } catch {
      const m = content.match(/\{[\s\S]*\}/);
      if (m) parsed = JSON.parse(m[0]);
    }

    const items = (parsed.items ?? []).map((it) => ({
      title: String(it.title ?? "").slice(0, 300),
      source: it.source ? String(it.source).slice(0, 120) : null,
      url: it.url ? String(it.url).slice(0, 500) : null,
      summary: String(it.summary ?? "").slice(0, 1200),
      relevance: Math.max(1, Math.min(10, Math.round(Number(it.relevance) || 7))),
    }));

    return { items, citations: json.citations ?? [] };
  });
