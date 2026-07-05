import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useConversation, ConversationProvider } from "@elevenlabs/react";
import { Mic, MicOff, Loader2, MessageSquare, Trash2, ChevronDown, ChevronRight, ExternalLink, Tag } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useServerFn } from "@tanstack/react-start";
import { summarizeAgentConversation, backfillAgentSummaries } from "@/lib/agent.functions";

const CATEGORY_LIST = [
  "SEO & Vindbaarheid",
  "Content & Social",
  "Techniek/Bugs",
  "Account & Instellingen",
  "Overig",
] as const;

const CATEGORY_STYLES: Record<string, string> = {
  "SEO & Vindbaarheid": "bg-wine/10 text-wine border-wine/30",
  "Content & Social": "bg-gold/15 text-gold border-gold/30",
  "Techniek/Bugs": "bg-destructive/10 text-destructive border-destructive/30",
  "Account & Instellingen": "bg-forest/10 text-forest border-forest/30",
  "Overig": "bg-muted text-muted-foreground border-border",
};

const AGENT_ID = "agent_9401kvw93hayexdrbs6z367s52m9";

const PAGE_LABELS: Record<string, string> = {
  "https://happybeez.nl/": "Homepage",
  "https://happybeez.nl/bijenhotels/": "Bijenhotels overzicht",
  "https://happybeez.nl/bijenhotels/#studio": "Model Studio (€34,95)",
  "https://happybeez.nl/bijenhotels/#penthouse": "Model Penthouse",
  "https://happybeez.nl/bijenhotels/#chalet": "Model Chalet",
  "https://happybeez.nl/bijenhotels/#lodge": "Model Lodge",
  "https://happybeez.nl/bijenhotels/#tower": "Model Tower",
  "https://happybeez.nl/bijenhotels/#kleinecassette": "Kleine Cassette",
  "https://happybeez.nl/bijenhotels/#grotecassette": "Grote Cassette",
  "https://happybeez.nl/hoe-het-werkt/": "Hoe het werkt",
  "https://happybeez.nl/waarom-biodiversiteit-telt/": "Biodiversiteit",
  "https://happybeez.nl/bloemen-en-voedsel/": "Bloemen en voedsel",
  "https://happybeez.nl/partners/": "Partners",
  "https://happybeez.nl/over-ons/": "Over ons",
  "https://happybeez-2.myshopify.com/": "Webshop",
};

function pageLabelFor(url: string): string {
  if (PAGE_LABELS[url]) return PAGE_LABELS[url];
  try {
    const u = new URL(url);
    return (u.pathname.replace(/\/$/, "") || u.hostname) + (u.hash || "");
  } catch {
    return url;
  }
}

export const Route = createFileRoute("/agent")({
  head: () => ({
    meta: [
      { title: "Josef — HappyBeez Agent" },
      { name: "description", content: "Praat met Josef, je HappyBeez AI-assistent." },
    ],
  }),
  component: () => (
    <ProtectedRoute>
      <ConversationProvider>
        <AgentPage />
      </ConversationProvider>
    </ProtectedRoute>
  ),
});

type Msg = {
  role: "user" | "agent" | "system" | "navigation";
  content: string;
  ts: number;
  url?: string;
  label?: string;
};
type Conv = {
  id: string;
  title: string | null;
  started_at: string;
  ended_at: string | null;
  elevenlabs_conversation_id: string | null;
};
type ConvWithMsgs = Conv & { messages: { role: string; content: string; created_at: string }[] };

function AgentPage() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const convIdRef = useRef<string | null>(null);
  const seqRef = useRef(0);
  const [history, setHistory] = useState<Conv[]>([]);
  const [expanded, setExpanded] = useState<Record<string, ConvWithMsgs | "loading">>({});
  const [starting, setStarting] = useState(false);

  const conversation = useConversation({
    onConnect: () => toast.success("Verbonden met Josef"),
    onDisconnect: () => toast.info("Gesprek beëindigd"),
    onError: (e: unknown) => toast.error(typeof e === "string" ? e : "Verbindingsfout"),
    clientTools: {
      navigate_to_page: ({ url, label }: { url: string; label?: string }) => {
        if (!url || !/^https?:\/\//i.test(url)) {
          return "Ongeldige URL";
        }
        const pageLabel = label ?? pageLabelFor(url);
        toast.info("Ik open de pagina voor je…");
        window.open(url, "_blank", "noopener,noreferrer");
        setMessages((prev) => [
          ...prev,
          { role: "navigation", content: pageLabel, url, label: pageLabel, ts: Date.now() },
        ]);
        void persistMessage("agent", `[navigatie] ${pageLabel} — ${url}`);
        return `Pagina geopend: ${pageLabel}`;
      },
      navigateToHappybeez: (params: { path?: string; url?: string }) => {
        const base = "https://happybeez.nl";
        let target: string;
        if (params.url && /^https?:\/\//i.test(params.url)) {
          try {
            const u = new URL(params.url);
            if (!u.hostname.endsWith("happybeez.nl")) {
              return `Geweigerd: ${u.hostname} valt buiten happybeez.nl`;
            }
            target = u.toString();
          } catch {
            return "Ongeldige URL";
          }
        } else {
          const path = (params.path ?? "/").trim();
          const normalized = path.startsWith("/") ? path : `/${path}`;
          target = `${base}${normalized}`;
        }
        const pageLabel = pageLabelFor(target);
        toast.info("Ik open de pagina voor je…");
        window.open(target, "_blank", "noopener,noreferrer");
        setMessages((prev) => [
          ...prev,
          { role: "navigation", content: pageLabel, url: target, label: pageLabel, ts: Date.now() },
        ]);
        void persistMessage("agent", `[navigatie] ${pageLabel} — ${target}`);
        return `Geopend: ${target}`;
      },
    },
    onMessage: (m: { message?: string; source?: string }) => {
      const role: "user" | "agent" = m.source === "user" ? "user" : "agent";
      const content = m.message ?? "";
      if (!content) return;
      setMessages((prev) => [...prev, { role, content, ts: Date.now() }]);
      void persistMessage(role, content);
    },
  });

  async function persistMessage(role: "user" | "agent", content: string) {
    if (!convIdRef.current || !user) return;
    const seq = seqRef.current++;
    await supabase.from("agent_messages").insert({
      conversation_id: convIdRef.current,
      user_id: user.id,
      role,
      content,
      seq,
    });
  }

  async function loadHistory() {
    if (!user) return;
    const { data } = await supabase
      .from("agent_conversations")
      .select("id,title,started_at,ended_at,elevenlabs_conversation_id")
      .eq("user_id", user.id)
      .order("started_at", { ascending: false })
      .limit(50);
    setHistory(data ?? []);
  }

  useEffect(() => {
    void loadHistory();
  }, [user]);

  async function start() {
    if (!user) return;
    setStarting(true);
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      const { data, error } = await supabase
        .from("agent_conversations")
        .insert({
          user_id: user.id,
          agent_id: AGENT_ID,
          title: `Gesprek ${new Date().toLocaleString("nl-NL")}`,
        })
        .select()
        .single();
      if (error || !data) throw error ?? new Error("DB-fout");
      convIdRef.current = data.id;
      setConversationId(data.id);
      seqRef.current = 0;
      setMessages([]);
      const elId = await conversation.startSession({
        agentId: AGENT_ID,
        connectionType: "webrtc",
      });
      if (typeof elId === "string") {
        await supabase
          .from("agent_conversations")
          .update({ elevenlabs_conversation_id: elId })
          .eq("id", data.id);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Kon gesprek niet starten");
    } finally {
      setStarting(false);
    }
  }

  async function stop() {
    await conversation.endSession();
    if (convIdRef.current) {
      await supabase
        .from("agent_conversations")
        .update({ ended_at: new Date().toISOString() })
        .eq("id", convIdRef.current);
    }
    convIdRef.current = null;
    setConversationId(null);
    void loadHistory();
  }

  async function toggleExpand(id: string) {
    if (expanded[id]) {
      const copy = { ...expanded };
      delete copy[id];
      setExpanded(copy);
      return;
    }
    setExpanded((p) => ({ ...p, [id]: "loading" }));
    const { data: conv } = await supabase
      .from("agent_conversations")
      .select("id,title,started_at,ended_at,elevenlabs_conversation_id")
      .eq("id", id)
      .single();
    const { data: msgs } = await supabase
      .from("agent_messages")
      .select("role,content,created_at")
      .eq("conversation_id", id)
      .order("seq", { ascending: true });
    if (conv) setExpanded((p) => ({ ...p, [id]: { ...conv, messages: msgs ?? [] } }));
  }

  async function deleteConv(id: string) {
    if (!confirm("Dit gesprek verwijderen?")) return;
    await supabase.from("agent_conversations").delete().eq("id", id);
    toast.success("Verwijderd");
    void loadHistory();
  }

  const isConnected = conversation.status === "connected";
  const isSpeaking = conversation.isSpeaking;

  return (
    <div className="px-4 sm:px-8 py-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <span className="text-xs tracking-[0.2em] uppercase text-muted-foreground font-medium">
          AI-Assistent
        </span>
        <h1 className="font-heading font-bold text-ink text-3xl mt-1 ruled-heading">
          Josef
        </h1>
        <p className="text-muted-foreground text-sm mt-2">
          Praat met Josef, je HappyBeez assistent. Alles wat je vraagt en zijn
          antwoorden worden opgeslagen.
        </p>
      </div>

      <div className="bg-card border border-border rounded-lg p-6 shadow-sm mb-8">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "w-12 h-12 rounded-full flex items-center justify-center transition-colors",
                isConnected
                  ? isSpeaking
                    ? "bg-gold/20 text-gold animate-pulse"
                    : "bg-wine/10 text-wine"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {isConnected ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
            </div>
            <div>
              <p className="font-semibold text-ink text-sm">
                {isConnected ? (isSpeaking ? "Josef praat…" : "Josef luistert…") : "Niet verbonden"}
              </p>
              <p className="text-xs text-muted-foreground">Status: {conversation.status}</p>
            </div>
          </div>
          {isConnected ? (
            <Button onClick={stop} variant="outline">
              Stop gesprek
            </Button>
          ) : (
            <Button
              onClick={start}
              disabled={starting}
              className="bg-wine text-primary-foreground hover:bg-wine/90"
            >
              {starting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Verbinden…
                </>
              ) : (
                <>
                  <Mic className="w-4 h-4 mr-2" /> Start gesprek
                </>
              )}
            </Button>
          )}
        </div>

        <div className="border-t border-border pt-4">
          {messages.length === 0 ? (
            <p className="text-sm text-muted-foreground italic text-center py-8">
              {isConnected
                ? "Begin gewoon te praten — Josef luistert."
                : "Klik op Start gesprek om met Josef te praten."}
            </p>
          ) : (
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
              {messages.map((m, i) => {
                if (m.role === "navigation" && m.url) {
                  return (
                    <div key={i} className="flex justify-start">
                      <a
                        href={m.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="max-w-[80%] flex items-center gap-3 rounded-lg border border-forest/30 bg-forest/10 px-4 py-3 text-sm hover:bg-forest/15 transition-colors"
                      >
                        <ExternalLink className="w-4 h-4 text-forest shrink-0" />
                        <div className="min-w-0">
                          <p className="font-medium text-ink">Josef opent: {m.label ?? m.content}</p>
                          <p className="text-xs text-muted-foreground truncate">{m.url}</p>
                        </div>
                      </a>
                    </div>
                  );
                }
                return (
                  <div
                    key={i}
                    className={cn(
                      "flex",
                      m.role === "user" ? "justify-end" : "justify-start",
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[80%] rounded-lg px-4 py-2 text-sm",
                        m.role === "user"
                          ? "bg-wine text-primary-foreground"
                          : "bg-secondary text-ink",
                      )}
                    >
                      {m.content}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div>
        <h2 className="font-heading font-semibold text-ink text-xl mb-4 flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-wine" />
          Geschiedenis
        </h2>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">
            Nog geen gesprekken opgenomen.
          </p>
        ) : (
          <div className="space-y-2">
            {history.map((c) => {
              const ex = expanded[c.id];
              const isOpen = !!ex;
              return (
                <div
                  key={c.id}
                  className="bg-card border border-border rounded-md overflow-hidden"
                >
                  <div className="flex items-center justify-between p-4">
                    <button
                      onClick={() => toggleExpand(c.id)}
                      className="flex items-center gap-2 flex-1 text-left"
                    >
                      {isOpen ? (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      )}
                      <div>
                        <p className="text-sm font-medium text-ink">
                          {c.title ?? "Gesprek"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(c.started_at).toLocaleString("nl-NL")}
                          {c.id === conversationId && " · actief"}
                        </p>
                      </div>
                    </button>
                    <button
                      onClick={() => deleteConv(c.id)}
                      className="p-2 hover:bg-muted rounded text-muted-foreground hover:text-destructive"
                      title="Verwijderen"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  {isOpen && (
                    <div className="border-t border-border p-4 bg-secondary/30">
                      {ex === "loading" ? (
                        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                      ) : ex.messages.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic">
                          Geen berichten opgeslagen.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {ex.messages.map((m, i) => (
                            <div key={i} className="text-sm">
                              <span
                                className={cn(
                                  "font-semibold mr-2",
                                  m.role === "user" ? "text-wine" : "text-gold",
                                )}
                              >
                                {m.role === "user" ? "Jij:" : "Josef:"}
                              </span>
                              <span className="text-ink">{m.content}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
