import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const ALLOWED_ORIGINS = [
  "https://happybeez.nl",
  "https://www.happybeez.nl",
  "https://happybeezstudio.com",
  "https://www.happybeezstudio.com",
];

function corsHeaders(origin: string | null): Record<string, string> {
  const allow =
    origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };
}

const Body = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(2000),
      }),
    )
    .min(1)
    .max(24),
});

const SYSTEM_PROMPT = `Je bent de Bijenkenner van Happybeez, de online expert op de website van Happybeez.
Happybeez maakt handgemaakte, natuurvriendelijke bijenhotels in Boekel. Happybeez verkoopt GEEN honing en houdt geen honingbijen.
Je helpt bezoekers met vragen over wilde en solitaire bijen, biodiversiteit in de tuin, de juiste plek en ophanghoogte van een bijenhotel, onderhoud, en welk model past bij hun situatie.
Schrijf in het Nederlands, warm, deskundig en concreet. Houd antwoorden kort, maximaal ongeveer 120 woorden.
Opmaak: korte alinea's van maximaal twee zinnen. Opsommingen op aparte regels met "- " ervoor. Vet alleen losse labels met **label**.
Gebruik nooit gedachtestreepjes of koppelstreepjes tussen zinsdelen. Schrijf de merknaam altijd als "Happybeez".
Weet je iets niet zeker, verwijs dan vriendelijk naar happybeez.nl of het contactformulier. Verzin geen prijzen, voorraad of levertijden.`;

async function askAI(messages: Array<{ role: string; content: string }>) {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("missing_key");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
    }),
  });
  return res;
}

export const Route = createFileRoute("/api/public/bee-chat")({
  server: {
    handlers: {
      OPTIONS: ({ request }) =>
        new Response(null, { status: 204, headers: corsHeaders(request.headers.get("origin")) }),
      POST: async ({ request }) => {
        const headers = corsHeaders(request.headers.get("origin"));
        let parsed;
        try {
          parsed = Body.parse(await request.json());
        } catch {
          return new Response(JSON.stringify({ error: "Ongeldige aanvraag" }), {
            status: 400,
            headers,
          });
        }

        try {
          const res = await askAI(parsed.messages);
          if (res.status === 429) {
            return new Response(
              JSON.stringify({ error: "Het is even druk. Probeer het zo nog eens." }),
              { status: 429, headers },
            );
          }
          if (res.status === 402) {
            return new Response(
              JSON.stringify({ error: "De assistent is tijdelijk niet beschikbaar." }),
              { status: 503, headers },
            );
          }
          if (!res.ok) {
            return new Response(
              JSON.stringify({ error: "De assistent is tijdelijk niet bereikbaar." }),
              { status: 502, headers },
            );
          }
          const json = (await res.json()) as {
            choices?: Array<{ message?: { content?: string } }>;
          };
          const raw = json.choices?.[0]?.message?.content?.trim() ?? "";
          const reply =
            raw.replace(/\s+[—–]\s+/g, ", ").replace(/\s+-\s+/g, ", ") ||
            "Sorry, ik kon even geen antwoord geven.";
          return new Response(JSON.stringify({ reply }), { status: 200, headers });
        } catch {
          return new Response(
            JSON.stringify({ error: "De assistent is tijdelijk niet bereikbaar." }),
            { status: 502, headers },
          );
        }
      },
    },
  },
});
