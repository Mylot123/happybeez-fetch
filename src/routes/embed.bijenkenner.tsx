import { useEffect, useRef, useState } from "react";
import { useConversation, ConversationProvider } from "@elevenlabs/react";
import { Mic, MicOff, Send, Loader2, MessageSquare } from "lucide-react";
import { ChatMarkdown } from "@/components/ChatMarkdown";
import { supabase } from "@/integrations/supabase/client";

const AGENT_ID = "agent_9401kvw93hayexdrbs6z367s52m9";
const IDLE_MS = 5 * 60 * 1000;
const VOICE_IDLE_MS = 45 * 1000; // spraak: na 45 sec stilte ophangen
const VOICE_MAX_MS = 4 * 60 * 1000; // spraak: harde stop na 4 minuten
const ENDED_NOTE = "Het gesprek is afgerond. Start gerust een nieuw gesprek.";
const MAX_NOTE = "De maximale gespreksduur van 4 minuten is bereikt. Start gerust een nieuw gesprek.";
const UNAVAILABLE = "De Bijenkenner is even niet bereikbaar, probeer het later opnieuw";
const GREETING = "Hoi, ik ben de bijenkenner van Happybeez. Waar kan ik je mee helpen?";

/* Huisstijl happybeez.nl */
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
  const [messages, setMessages] = useState<Msg[]>([{ role: "assistant", content: GREETING }]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const kindRef = useRef<"chat" | "voice" | null>(null);
  const pendingRef = useRef<string | null>(null);
  const connectedRef = useRef(false);
  const idleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipGreetingRef = useRef(false);
  const endRef = useRef<() => void>(() => {});
  const sessionRef = useRef<string | null>(null);
  const maxRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const endReasonRef = useRef<"max" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function newSession() {
    sessionRef.current = crypto.randomUUID();
  }
  function logMsg(role: "user" | "assistant", content: string, kanaal: "chat" | "spraak") {
    const sid = sessionRef.current;
    if (!sid || !content.trim()) return;
    void supabase
      .from("bijenkenner_messages")
      .insert({ session_id: sid, kanaal, role, content: content.slice(0, 4000) })
      .then(() => {}, () => {});
  }

  const conversation = useConversation({
    onConnect: () => {
      connectedRef.current = true;
      const pending = pendingRef.current;
      pendingRef.current = null;
      if (pending && kindRef.current === "chat") {
        // kleine vertraging zodat de sessie volledig klaar is
        setTimeout(() => conversation.sendUserMessage(pending), 50);
      }
    },
    onDisconnect: () => {
      const wasConnected = connectedRef.current;
      const wasVoice = kindRef.current === "voice";
      connectedRef.current = false;
      kindRef.current = null;
      clearTimers();
      if (pendingRef.current || (!wasConnected && sendingRef.current)) {
        pendingRef.current = null;
        setSending(false);
        setError(UNAVAILABLE);
        return;
      }
      if (wasConnected && wasVoice) {
        // Gesprek voorbij: venster leegmaken en schoon beginnen
        setMessages([{ role: "assistant", content: GREETING }]);
        setSending(false);
        setNotice(endReasonRef.current === "max" ? MAX_NOTE : ENDED_NOTE);
      }
      endReasonRef.current = null;
    },
    onMessage: (m: { message?: string; source?: string }) => {
      if (!m.message) return;
      const isUser = m.source === "user";
      // In chat voegen we de vraag zelf al toe
      if (isUser && kindRef.current === "chat") return;
      // Eerste agent-bericht na sessiestart is de begroeting; die tonen we al zelf
      if (!isUser && skipGreetingRef.current) {
        skipGreetingRef.current = false;
        return;
      }
      const content = isUser
        ? m.message
        : m.message.replace(/\s+[—–]\s+/g, ", ").replace(/([^\n]) +- +/g, "$1, ");
      setMessages((prev) => [...prev, { role: isUser ? "user" : "assistant", content }]);
      logMsg(isUser ? "user" : "assistant", content, kindRef.current === "voice" ? "spraak" : "chat");
      if (!isUser) setSending(false);
      resetIdle();
    },
    onError: () => {
      pendingRef.current = null;
      setSending(false);
      setError(UNAVAILABLE);
    },
    clientTools: {
      // Jozef kan hiermee zelf het gesprek afronden
      gesprek_beeindigen: () => {
        setTimeout(() => endRef.current(), 2500);
        return "Gesprek wordt beëindigd";
      },
    },
  });
  const isConnected = conversation.status === "connected";
  const sendingRef = useRef(false);
  sendingRef.current = sending;
  endRef.current = () => {
    clearTimers();
    try {
      conversation.endSession();
    } catch {
      /* al gesloten */
    }
  };

  function clearTimers() {
    if (idleRef.current) clearTimeout(idleRef.current);
    if (maxRef.current) clearTimeout(maxRef.current);
    idleRef.current = null;
    maxRef.current = null;
  }

  function resetIdle() {
    if (idleRef.current) clearTimeout(idleRef.current);
    const ms = kindRef.current === "voice" ? VOICE_IDLE_MS : IDLE_MS;
    idleRef.current = setTimeout(() => endRef.current(), ms);
  }

  useEffect(() => () => {
    endRef.current();
  }, []);

  // Tab of venster verlaten tijdens spraak: direct ophangen
  useEffect(() => {
    const stop = () => {
      if (kindRef.current === "voice") endRef.current();
    };
    const onVis = () => {
      if (document.visibilityState === "hidden") stop();
    };
    window.addEventListener("pagehide", stop);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("pagehide", stop);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  // Wissel van tab: lopende sessie sluiten en met een schoon gesprek starten
  useEffect(() => {
    endRef.current();
    kindRef.current = null;
    pendingRef.current = null;
    skipGreetingRef.current = false;
    setMessages([{ role: "assistant", content: GREETING }]);
    setSending(false);
  }, [mode]);

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

  function send() {
    const text = input.trim();
    if (!text || sending) return;
    setError(null);
    setNotice(null);
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setSending(true);
    resetIdle();
    try {
      if (connectedRef.current && kindRef.current === "chat") {
        logMsg("user", text, "chat");
        conversation.sendUserMessage(text);
      } else {
        pendingRef.current = text;
        kindRef.current = "chat";
        skipGreetingRef.current = true;
        newSession();
        logMsg("user", text, "chat");
        conversation.startSession({
          agentId: AGENT_ID,
          textOnly: true,
          connectionType: "websocket",
          dynamicVariables: { kanaal: "chat" },
        });
      }
    } catch {
      pendingRef.current = null;
      setSending(false);
      setError(UNAVAILABLE);
    }
    inputRef.current?.focus();
  }

  async function startVoice() {
    setError(null);
    setNotice(null);
    endReasonRef.current = null;
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError("Geef toestemming voor de microfoon om te kunnen praten.");
      return;
    }
    try {
      kindRef.current = "voice";
      skipGreetingRef.current = true;
      newSession();
      conversation.startSession({
        agentId: AGENT_ID,
        connectionType: "webrtc",
        dynamicVariables: { kanaal: "spraak" },
      });
      resetIdle();
      if (maxRef.current) clearTimeout(maxRef.current);
      maxRef.current = setTimeout(() => {
        endReasonRef.current = "max";
        endRef.current();
      }, VOICE_MAX_MS);
    } catch {
      setError(UNAVAILABLE);
    }
  }

  return (
    <div
      style={{
        background: embed ? "#ffffff" : PAGE,
        color: GREEN,
        fontFamily: "'Open Sans', system-ui, -apple-system, sans-serif",
      }}
      className={embed ? "w-full flex flex-col m-0 p-0" : "min-h-screen flex flex-col"}
      {...(embed ? { "data-embed": "1" } : {})}
    >

      <main className={embed ? "w-full flex flex-col" : "flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10 flex flex-col gap-5"}>
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
          className={embed ? "bg-white p-3 flex flex-col gap-3 rounded-none border-0" : "rounded-2xl bg-white p-2 sm:p-3 flex flex-col gap-4 flex-1 min-h-0"}
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
            className={embed
              ? "overflow-y-auto rounded-xl p-3 sm:p-4 space-y-3 h-[360px] sm:h-[420px]"
              : "flex-1 min-h-0 overflow-y-auto rounded-xl p-3 sm:p-4 space-y-3"}
            style={{ border: `1px solid ${GREEN_SOFT}`, background: "#ffffff", maxHeight: embed ? 420 : "50vh" }}
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
          {notice && !error && (
            <p className="text-xs text-center" style={{ color: MUTED }} role="status">
              {notice}
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
            <div className="flex justify-center py-2 sm:py-4">
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
