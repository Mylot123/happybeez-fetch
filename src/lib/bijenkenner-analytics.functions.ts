import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const QUESTION_CATEGORIES = [
  "Ophanghoogte & locatie",
  "Modelkeuze & advies",
  "Wilde bijen & gedrag",
  "Bloemen & biodiversiteit",
  "Onderhoud & winter",
  "Bestellen & levering",
  "Overig",
] as const;

/** Categoriseert nog niet ingedeelde bezoekersvragen met AI (max 80 per keer). */
export const categorizeBijenkennerQuestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: rows } = await context.supabase
      .from("bijenkenner_messages")
      .select("id,content")
      .eq("role", "user")
      .is("category", null)
      .order("created_at", { ascending: false })
      .limit(80);
    if (!rows || rows.length === 0) return { processed: 0 };

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY ontbreekt");
    const list = rows.map((r, i) => `${i}: ${r.content.slice(0, 300).replace(/\n/g, " ")}`).join("\n");
    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: {
        "Lovable-API-Key": apiKey,
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        stream: true,
        store: false,
        reasoning: { effort: "low" },
        instructions: "Je deelt vragen van websitebezoekers in. Antwoord alleen met geldig JSON.",
        input: `Deel elke vraag in in precies één categorie uit: ${QUESTION_CATEGORIES.join(", ")}.\nGeef JSON {"items":[{"index":0,"category":"..."}]} met één item per vraag.\n\nVragen:\n${list}`,
        text: {
          format: {
            type: "json_schema",
            name: "categorieen",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              required: ["items"],
              properties: {
                items: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    required: ["index", "category"],
                    properties: {
                      index: { type: "integer" },
                      category: { type: "string", enum: [...QUESTION_CATEGORIES] },
                    },
                  },
                },
              },
            },
          },
        },
      }),
    });
    if (!res.ok || !res.body) throw new Error(`AI ${res.status}`);
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    let text = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const d = line.slice(5).trim();
        if (!d || d === "[DONE]") continue;
        try {
          const ev = JSON.parse(d) as { type?: string; delta?: string };
          if (ev.type === "response.output_text.delta" && ev.delta) text += ev.delta;
        } catch {
          /* noop */
        }
      }
    }
    const parsed: Record<string, string> = {};
    try {
      const obj = JSON.parse(text) as { items?: { index: number; category: string }[] };
      for (const it of obj.items ?? []) parsed[String(it.index)] = it.category;
    } catch {
      /* noop */
    }
    let processed = 0;
    for (let i = 0; i < rows.length; i++) {
      const raw = (parsed[String(i)] ?? "").trim();
      const cat = (QUESTION_CATEGORIES as readonly string[]).includes(raw) ? raw : "Overig";
      const { error } = await context.supabase
        .from("bijenkenner_messages")
        .update({ category: cat })
        .eq("id", rows[i].id);
      if (!error) processed++;
    }
    return { processed };
  });
