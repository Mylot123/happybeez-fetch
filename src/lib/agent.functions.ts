import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CATEGORIES = [
  "SEO & Vindbaarheid",
  "Content & Social",
  "Techniek/Bugs",
  "Account & Instellingen",
  "Overig",
] as const;

type Category = (typeof CATEGORIES)[number];

async function callAI(prompt: string): Promise<string> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY ontbreekt");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content:
            "Je vat spraakgesprekken samen. Antwoord uitsluitend in geldig JSON zonder markdown.",
        },
        { role: "user", content: prompt },
      ],
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`AI Gateway ${res.status}: ${t.slice(0, 200)}`);
  }
  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return json.choices?.[0]?.message?.content?.trim() ?? "";
}

function parseAIOutput(raw: string): { summary: string; category: Category } {
  let text = raw.trim();
  if (text.startsWith("```")) {
    text = text.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  }
  let parsed: { summary?: unknown; category?: unknown } = {};
  try {
    parsed = JSON.parse(text);
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        parsed = JSON.parse(m[0]);
      } catch {
        /* noop */
      }
    }
  }
  const summary =
    typeof parsed.summary === "string" && parsed.summary.trim().length > 0
      ? parsed.summary.trim().slice(0, 240)
      : "Geen samenvatting beschikbaar.";
  const cat = typeof parsed.category === "string" ? parsed.category.trim() : "";
  const category: Category = (CATEGORIES as readonly string[]).includes(cat)
    ? (cat as Category)
    : "Overig";
  return { summary, category };
}

async function summarizeOne(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  conversationId: string,
) {
  const { data: msgs } = await supabase
    .from("agent_messages")
    .select("role,content")
    .eq("conversation_id", conversationId)
    .order("seq", { ascending: true })
    .limit(200);

  const transcript = (msgs ?? [])
    .map((m) => `${m.role === "user" ? "Gebruiker" : "de Bijenspecialist"}: ${m.content}`)
    .join("\n")
    .slice(0, 6000);

  if (!transcript.trim()) {
    await supabase
      .from("agent_conversations")
      .update({ summary: "Leeg gesprek.", category: "Overig" })
      .eq("id", conversationId);
    return { summary: "Leeg gesprek.", category: "Overig" as Category };
  }

  const prompt = `Hieronder een transcript van een spraakgesprek tussen een gebruiker en assistent de Bijenspecialist.
Geef terug: (1) een korte samenvatting van 1 zin (max 200 tekens) waar het over ging, in het Nederlands.
(2) één categorie, exact een van: ${CATEGORIES.join(", ")}.

Antwoord in dit JSON-formaat:
{"summary":"...","category":"..."}

Transcript:
${transcript}`;

  const raw = await callAI(prompt);
  const result = parseAIOutput(raw);
  await supabase
    .from("agent_conversations")
    .update({ summary: result.summary, category: result.category })
    .eq("id", conversationId);
  return result;
}

export const summarizeAgentConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ conversationId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    return summarizeOne(context.supabase, data.conversationId);
  });

export const backfillAgentSummaries = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: rows } = await context.supabase
      .from("agent_conversations")
      .select("id")
      .or("summary.is.null,category.is.null")
      .eq("user_id", context.userId)
      .limit(50);
    let done = 0;
    for (const r of rows ?? []) {
      try {
        await summarizeOne(context.supabase, r.id);
        done++;
      } catch {
        /* skip failures */
      }
    }
    return { processed: done };
  });
