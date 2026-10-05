import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { createResponsesCall } from "@/lib/bee-ai/responses.server";
import { withLovableAiGatewayRunIdHeader } from "@/lib/bee-ai/run-id.server";

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
    .max(200),
});

const SYSTEM_PROMPT = `Je bent de Bijenkenner van Happybeez, de online expert op de website van Happybeez.
Happybeez maakt handgemaakte, natuurvriendelijke bijenhotels in Boekel. Happybeez verkoopt GEEN honing en houdt geen honingbijen.
Je helpt bezoekers met vragen over wilde en solitaire bijen, biodiversiteit in de tuin, de juiste plek en ophanghoogte van een bijenhotel, onderhoud, en welk model past bij hun situatie.
Schrijf in het Nederlands, warm, deskundig en concreet. Houd antwoorden kort, maximaal ongeveer 120 woorden.
Opmaak: korte alinea's van maximaal twee zinnen. Opsommingen op aparte regels met "- " ervoor. Vet alleen losse labels met **label**.
Gebruik nooit gedachtestreepjes of koppelstreepjes tussen zinsdelen. Schrijf de merknaam altijd als "Happybeez".
Weet je iets niet zeker, verwijs dan vriendelijk naar happybeez.nl of het contactformulier. Verzin geen prijzen, voorraad of levertijden.`;

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
          const apiKey = process.env["LOVABLE_API_KEY"];
          if (!apiKey) return new Response(JSON.stringify({ error: "De AI-configuratie ontbreekt." }), { status: 401, headers });
          const call = createResponsesCall(request, {
            baseURL: "https://ai.gateway.lovable.dev/v1",
            apiKey,
            model: "openai/gpt-6-astra",
          }, parsed.messages, SYSTEM_PROMPT);
          const { "Content-Type": _contentType, ...cors } = headers;
          return await withLovableAiGatewayRunIdHeader(
            call.result.toUIMessageStreamResponse({
              sendReasoning: false,
              onError: (error) => error instanceof Error ? error.message : "Er ging iets mis bij het antwoorden.",
            }),
            call.runIdFetch,
            cors,
          );
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
