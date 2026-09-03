import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useConversation } from "@elevenlabs/react";
import { Mic, MicOff, Send, Loader2, MessageSquare } from "lucide-react";
import { ChatMarkdown } from "@/components/ChatMarkdown";

export const Route = createFileRoute("/embed/bijenkenner")({
  component: EmbedBijenkenner,
  head: () => ({
    meta: [
      { title: "De Bijenkenner van Happybeez | Stel je vraag over wilde bijen" },
      {
        name: "description",
        content:
          "Stel je vraag over wilde bijen, bijenhotels en biodiversiteit aan de Bijenkenner van Happybeez. Chat of praat direct met de online bijenexpert.",
      },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "De Bijenkenner van Happybeez" },
      {
        property: "og:description",
        content: "Chat of praat met de online bijenexpert van Happybeez over wilde bijen en bijenhotels.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const AGENT_ID = "agent_9401kvw93hayexdrbs6z367s52m9";

type Msg = { role: "user" | "assistant"; content: string };

const GREEN = "#2f5d3a";
const GREEN_SOFT = "#eaf1ea";

function EmbedBijenkenner() {
  const [mode, setMode] = useState<"chat" | "voice">("chat");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const conversation = useConversation({
    onMessage: (m: { message?: string; source?: string }) => {
      if (!m.message) return;
      setMessages((prev) => [
        ...prev,
        { role: m.source === "user" ? "user" : "assistant", content: m.message as string },
      ]);
    },
    onError: () => setError("Verbindingsfout met de spraakassistent."),
  });
  const isConnected = conversation.status === "connected";

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    setError(null);
    setInput("");
    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setSending(true);
    try {
      const res = await fetch("/api/public/bee-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next.slice(-16) }),
      });
      const json = (await res.json()) as { reply?: string; error?: string };
      if (!res.ok || !json.reply) {
        setError(json.error ?? "Er ging iets mis. Probeer het opnieuw.");
      } else {
        setMessages((prev) => [...prev, { role: "assistant", content: json.reply as string }]);
      }
    } catch {
      setError("Geen verbinding. Probeer het opnieuw.");
    } finally {
      setSending(false);
    }
  }

  async function startVoice() {
    setError(null);
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      await conversation.startSession({ agentId: AGENT_ID, connectionType: "webrtc" });
    } catch {
      setError("Geef toestemming voor de microfoon om te kunnen praten.");
    }
  }

  return (
    <div
      style={{ background: "#ffffff", color: GREEN, fontFamily: "'Inter', system-ui, sans-serif" }}
      className="min-h-screen flex flex-col p-4 gap-3"
    >
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold" style={{ color: GREEN }}>
            De Bijenkenner
          </h1>
          <p className="text-xs" style={{ color: "#5b7a63" }}>
            Stel je vraag over wilde bijen, bijenhotels en je tuin
          </p>
        </div>
        <div className="flex rounded-full p-1" style={{ background: GREEN_SOFT }}>
          {(["chat", "voice"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className="px-3 py-1.5 text-xs font-medium rounded-full transition-colors"
              style={
                mode === m
                  ? { background: GREEN, color: "#ffffff" }
                  : { background: "transparent", color: GREEN }
              }
            >
              {m === "chat" ? "Chatten" : "Spraak"}
            </button>
          ))}
        </div>
      </header>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto rounded-xl p-3 space-y-3"
        style={{ border: `1px solid ${GREEN_SOFT}`, background: "#ffffff", minHeight: 220 }}
      >
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center gap-2 py-8">
            <MessageSquare className="w-6 h-6" style={{ color: GREEN }} />
            <p className="text-sm" style={{ color: "#5b7a63" }}>
              {mode === "chat"
                ? "Bijvoorbeeld: welk bijenhotel past in een kleine stadstuin?"
                : "Klik op Start gesprek en stel je vraag hardop."}
            </p>
          </div>
        ) : (
          messages.map((m, i) => (
            <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
              <div
                className="max-w-[85%] rounded-xl px-3 py-2 text-sm"
                style={
                  m.role === "user"
                    ? { background: GREEN, color: "#ffffff" }
                    : { background: GREEN_SOFT, color: GREEN }
                }
              >
                {m.role === "user" ? m.content : <ChatMarkdown content={m.content} />}
              </div>
            </div>
          ))
        )}
        {sending && (
          <div className="flex items-center gap-2 text-xs" style={{ color: "#5b7a63" }}>
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> De Bijenkenner denkt na…
          </div>
        )}
      </div>

      {error && (
        <p className="text-xs" style={{ color: "#a33" }} role="alert">
          {error}
        </p>
      )}

      {mode === "chat" ? (
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            rows={2}
            placeholder="Stel je vraag aan de Bijenkenner…"
            className="flex-1 resize-none rounded-xl px-3 py-2 text-sm outline-none"
            style={{ border: `1px solid ${GREEN}`, color: GREEN, background: "#ffffff" }}
          />
          <button
            onClick={() => void send()}
            disabled={sending || !input.trim()}
            aria-label="Verstuur vraag"
            className="rounded-xl p-3 disabled:opacity-50"
            style={{ background: GREEN, color: "#ffffff" }}
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="flex justify-center">
          {isConnected ? (
            <button
              onClick={() => void conversation.endSession()}
              className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium"
              style={{ background: GREEN_SOFT, color: GREEN, border: `1px solid ${GREEN}` }}
            >
              <MicOff className="w-4 h-4" /> Gesprek stoppen
            </button>
          ) : (
            <button
              onClick={() => void startVoice()}
              className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium"
              style={{ background: GREEN, color: "#ffffff" }}
            >
              <Mic className="w-4 h-4" /> Start gesprek
            </button>
          )}
        </div>
      )}

      <p className="text-[11px] text-center" style={{ color: "#7d9384" }}>
        Happybeez helpt je graag verder met natuurvriendelijke bijenhotels.
      </p>
    </div>
  );
}
