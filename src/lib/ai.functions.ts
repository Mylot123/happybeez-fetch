import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const inputSchema = z.object({
  prompt: z.string().min(1).max(8000),
  system: z.string().max(4000).optional(),
  model: z.string().optional(),
});

type AIResponse = {
  choices: Array<{ message: { content: string } }>;
};

export const generateText = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => inputSchema.parse(data))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      throw new Error("LOVABLE_API_KEY is niet beschikbaar.");
    }

    const model = data.model ?? "openai/gpt-5";

    const messages: Array<{ role: "system" | "user"; content: string }> = [];
    if (data.system) messages.push({ role: "system", content: data.system });
    messages.push({ role: "user", content: data.prompt });

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model, messages }),
    });

    if (res.status === 429) {
      throw new Error("Limiet bereikt — probeer het zo nog eens.");
    }
    if (res.status === 402) {
      throw new Error("AI-tegoed op — voeg credits toe in je Lovable-werkruimte.");
    }
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`AI Gateway fout (${res.status}): ${txt.slice(0, 200)}`);
    }

    const json = (await res.json()) as AIResponse;
    const text = json.choices?.[0]?.message?.content?.trim() ?? "";
    if (!text) throw new Error("Lege response van AI.");
    return { text };
  });
