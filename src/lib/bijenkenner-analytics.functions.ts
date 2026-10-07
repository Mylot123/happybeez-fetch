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
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Je deelt vragen van websitebezoekers in. Antwoord alleen met geldig JSON." },
          {
            role: "user",
            content: `Deel elke vraag in in precies één categorie uit: ${QUESTION_CATEGORIES.join(", ")}.\nAntwoord als JSON-object {"0":"categorie","1":"categorie",...}.\n\nVragen:\n${list}`,
          },
        ],
      }),
    });
    if (!res.ok) throw new Error(`AI ${res.status}`);
    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    let text = json.choices?.[0]?.message?.content?.trim() ?? "{}";
    const m = text.match(/\{[\s\S]*\}/);
    text = m ? m[0] : "{}";
    let parsed: Record<string, string> = {};
    try {
      parsed = JSON.parse(text);
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
