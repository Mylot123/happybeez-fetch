import { useEffect, useRef, useState } from "react";
import { useConversation, ConversationProvider } from "@elevenlabs/react";
import { Mic, MicOff, Send, Loader2, ArrowLeft, MessageSquare } from "lucide-react";
import { ChatMarkdown } from "@/components/ChatMarkdown";
import { DefaultChatTransport, readUIMessageStream, type UIMessage } from "ai";

const AGENT_ID = "agent_9401kvw93hayexdrbs6z367s52m9";

/* Huisstijl happybeez.nl */
const DARK = "#23301f"; // donkergroene balk
const GREEN = "#0f6b34"; // diep groen voor koppen en tekst
const GREEN_SOFT = "#e7efe7"; // zacht groen vlak
const PAGE = "#e8efe8"; // paginaachtergrond
const ORANGE = "#e2662a"; // accentknop
const MUTED = "#5b7a63";

type Msg = { role: "user" | "assistant"; content: string };

export function EmbedBijenkenner() {
  return (
    <ConversationProvider>
      <BijenkennerPage />
    </ConversationProvider>
  );
}

function BijenkennerPage() {
  const [mode, setMode] = useState<"chat" | "voice">("chat");
  const [embed, setEmbed] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

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

  useEffect(() => {
    if (mode === "chat" && !embed) inputRef.current?.focus();
  }, [mode, embed]);

  useEffect(() => {
    let inFrame = false;
    try {
      inFrame = window.self !== window.top;
    } catch {
      inFrame = true;
    }
    const param = new URLSearchParams(window.location.search).get("embed") === "1";
    if (!inFrame && !param) return;
    setEmbed(true);
    const h = document.documentElement;
    const b = document.body;
    const prev = [h.style.background, b.style.background, h.style.overflow, b.style.overflow, b.style.margin];
    h.style.background = "transparent";
    b.style.background = "transparent";
    h.style.overflow = "auto";
    b.style.overflow = "visible";
    b.style.margin = "0";
    return () => {
      [h.style.background, b.style.background, h.style.overflow, b.style.overflow, b.style.margin] = prev;
    };
  }, []);



  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    setError(null);
    setInput("");
    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setSending(true);
    try {
      const transport = new DefaultChatTransport({
        api: "/api/public/bee-chat",
        prepareSendMessagesRequest: () => ({ body: { messages: next } }),
      });
      const uiMessages: UIMessage[] = next.map((m, i) => ({
        id: String(i), role: m.role, parts: [{ type: "text", text: m.content }],
      }));
      const stream = await transport.sendMessages({
        trigger: "submit-message", chatId: "bijenkenner", messages: uiMessages,
        messageId: undefined, abortSignal: undefined,
      });
      let received = false;
      for await (const message of readUIMessageStream({ stream, terminateOnError: true })) {
        const content = message.parts.filter((p) => p.type === "text").map((p) => p.text).join("")
          .replace(/\s+[—–]\s+/g, ", ").replace(/([^\n]) +- +/g, "$1, ");
        if (!content) continue;
        received = true;
        setMessages([...next, { role: "assistant", content }]);
      }
      if (!received) setError("Er is geen antwoord ontvangen. Stel je vraag opnieuw.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Geen verbinding. Probeer het opnieuw.");
    } finally {
      setSending(false);
      inputRef.current?.focus();
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
      style={{
        background: embed ? "#ffffff" : PAGE,
        ...(embed ? { height: "100vh" } : {}),
        color: GREEN,
        fontFamily: "'Open Sans', system-ui, -apple-system, sans-serif",
      }}
      className={embed ? "w-full flex flex-col overflow-hidden m-0 p-0" : "min-h-screen flex flex-col"}
      {...(embed ? { "data-embed": "1" } : {})}
    >
      {!embed && (
      <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 pt-4">
        <div
          style={{ background: DARK, borderRadius: 8 }}
          className="flex items-center justify-between px-4 sm:px-6 py-3"
        >
          <span className="text-base font-bold tracking-tight" style={{ color: "#ffffff" }}>
            happybeez
          </span>
          <a
            href="https://www.happybeez.nl"
            target="_top"
            rel="noopener"
            onClick={(e) => {
              const url = "https://www.happybeez.nl";
              try {
                if (window.top && window.top !== window.self) {
                  e.preventDefault();
                  window.top.location.href = url;
                  return;
                }
              } catch {
                /* sandboxed cross-origin top — fall through to same-frame nav */
              }
              e.preventDefault();
              window.location.href = url;
            }}
            className="inline-flex items-center gap-2 text-sm font-semibold cursor-pointer"
            style={{ color: "#ffffff" }}
          >
            <ArrowLeft className="w-4 h-4" /> Terug naar happybeez.nl
          </a>
        </div>
      </div>
      )}

      <main className={embed ? "w-full flex-1 min-h-0 flex flex-col" : "flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10 flex flex-col gap-5"}>
        {!embed && (
        <header className="text-center">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight" style={{ color: GREEN }}>
            De Bijenkenner
          </h1>
          <p className="mt-2 text-sm sm:text-base max-w-2xl mx-auto" style={{ color: MUTED }}>
            Stel je vraag over wilde bijen, bijenhotels en biodiversiteit in je tuin. Typ je vraag of
            stel hem hardop.
          </p>
        </header>
        )}

        <div
          className={embed ? "bg-white p-3 flex flex-col gap-3 flex-1 min-h-0 rounded-none border-0" : "rounded-2xl bg-white p-2 sm:p-3 flex flex-col gap-4 flex-1 min-h-0"}
          style={{ boxShadow: embed ? "none" : "0 12px 30px -20px rgba(20,60,35,0.45)" }}
        >
          <div className="flex justify-center sm:justify-start">
            <div className="inline-flex rounded-full p-1" style={{ background: GREEN_SOFT }}>
              {(["chat", "voice"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className="px-4 py-1.5 text-sm font-medium rounded-full transition-colors"
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
          </div>

          {!(embed && mode === "voice" && messages.length === 0) && (
          <div
            ref={scrollRef}
            className="flex-1 min-h-0 overflow-y-auto rounded-xl p-3 sm:p-4 space-y-3"
            style={{ border: `1px solid ${GREEN_SOFT}`, background: "#ffffff", minHeight: embed ? 0 : 300, maxHeight: embed ? "none" : "50vh" }}
          >
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center gap-2 py-10">
                <MessageSquare className="w-6 h-6" style={{ color: GREEN }} />
                <p className="text-sm max-w-sm" style={{ color: MUTED }}>
                  {mode === "chat"
                    ? ""
                    : "Klik op Start gesprek en stel je vraag hardop."}
                </p>
              </div>
            ) : (
              messages.map((m, i) => (
                <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                  <div
                    className="max-w-[95%] rounded-2xl px-3 py-2.5 text-sm"
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
            {sending && messages[messages.length - 1]?.role !== "assistant" && (
              <div className="flex items-center gap-2 text-xs" style={{ color: MUTED }}>
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> De Bijenkenner denkt na…
              </div>
            )}
          </div>
          )}

          {error && (
            <p className="text-xs" style={{ color: "#a33" }} role="alert">
              {error}
            </p>
          )}

          {mode === "chat" ? (
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
                rows={2}
                placeholder="Bijvoorbeeld: welk bijenhotel past in een kleine stadstuin en op welke hoogte hang ik het op?"
                aria-label="Stel je vraag aan de Bijenkenner"
                className="flex-1 resize-none rounded-xl px-3 py-2.5 text-sm outline-none"
                style={{ border: `1px solid ${GREEN_SOFT}`, color: GREEN, background: "#ffffff" }}
              />
              <button
                onClick={() => void send()}
                disabled={sending || !input.trim()}
                aria-label="Verstuur vraag"
                className="rounded-xl p-3 disabled:opacity-50"
                style={{ background: ORANGE, color: "#ffffff" }}
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className={embed && messages.length === 0 ? "flex-1 flex items-center justify-center" : "flex justify-center"}>
              {isConnected ? (
                <button
                  onClick={() => void conversation.endSession()}
                  className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-medium"
                  style={{ background: GREEN_SOFT, color: GREEN, border: `1px solid ${GREEN}` }}
                >
                  <MicOff className="w-4 h-4" /> Gesprek stoppen
                </button>
              ) : (
                <button
                  onClick={() => void startVoice()}
                  className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-medium"
                  style={{ background: ORANGE, color: "#ffffff" }}
                >
                  <Mic className="w-4 h-4" /> Start gesprek
                </button>
              )}
            </div>
          )}
        </div>

        {!embed && <p className="text-[11px] text-center" style={{ color: "#7d9384" }}>
          Happybeez maakt handgemaakte, natuurvriendelijke bijenhotels in Boekel.
        </p>}
      </main>
    </div>
  );
}
