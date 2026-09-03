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
    .map((m) => `${m.role === "user" ? "Gebruiker" : "De Bijenspecialist"}: ${m.content}`)
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

const SYSTEM_PROMPT = `Je bent "De Bijenspecialist", de AI-assistent van Happybeez.
Happybeez maakt handgemaakte, natuurvriendelijke bijenhotels in Boekel en verkoopt GEEN honing.
Je helpt met wilde en solitaire bijen, biodiversiteit, tuininrichting, de producten van Happybeez
en met vragen over dit platform (content, SEO, planning).
Schrijf in het Nederlands, warm en deskundig, kort en concreet.
Opmaak: gebruik korte alinea's van maximaal twee zinnen. Zet opsommingen op aparte regels met "- " ervoor, nooit meerdere opsommingspunten in één doorlopende zin. Vet alleen losse labels met **label**. Geen koppen groter dan ###.
Gebruik nooit gedachtestreepjes of koppelstreepjes tussen zinsdelen. Schrijf de merknaam altijd als "Happybeez".`;

async function chatAI(messages: Array<{ role: string; content: string }>): Promise<string> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY ontbreekt");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "google/gemini-2.5-flash", messages }),
  });
  if (res.status === 429) throw new Error("Even te druk. Probeer het zo nog eens.");
  if (res.status === 402) throw new Error("AI-tegoed op. Voeg credits toe in je Lovable-werkruimte.");
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`AI Gateway ${res.status}: ${t.slice(0, 200)}`);
  }
  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return json.choices?.[0]?.message?.content?.trim() ?? "";
}

export const chatWithSpecialist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({ conversationId: z.string().uuid(), message: z.string().min(1).max(4000) })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;

    const { data: prior } = await supabase
      .from("agent_messages")
      .select("role,content,seq")
      .eq("conversation_id", data.conversationId)
      .order("seq", { ascending: true })
      .limit(60);

    const history = (prior ?? []).map((m) => ({
      role: m.role === "user" ? "user" : "assistant",
      content: m.content,
    }));
    let seq = (prior ?? []).reduce((max, m) => Math.max(max, (m.seq as number) ?? 0), -1) + 1;

    await supabase.from("agent_messages").insert({
      conversation_id: data.conversationId,
      user_id: context.userId,
      role: "user",
      content: data.message,
      seq: seq++,
    });

    const reply =
      (await chatAI([
        { role: "system", content: SYSTEM_PROMPT },
        ...history,
        { role: "user", content: data.message },
      ])) || "Sorry, ik kon geen antwoord genereren.";

    const clean = reply.replace(/\s+[—–]\s+/g, ", ").replace(/\s+-\s+/g, ", ");

    await supabase.from("agent_messages").insert({
      conversation_id: data.conversationId,
      user_id: context.userId,
      role: "agent",
      content: clean,
      seq: seq++,
    });

    return { reply: clean };
  });
