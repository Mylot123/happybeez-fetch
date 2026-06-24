import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Wand2,
  Copy,
  CheckCheck,
  Save,
  Loader2,
  RefreshCw,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { generateText } from "@/lib/ai.functions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

type Channel = "instagram" | "linkedin" | "facebook" | "blog" | "website";
type ContentType =
  | "tip"
  | "citaat"
  | "educatief"
  | "product"
  | "seizoen"
  | "behind_scenes"
  | "nieuws"
  | "boekfragment";
type Tone =
  | "warm_educatief"
  | "enthousiast"
  | "persoonlijk"
  | "professioneel"
  | "poetisch";

const CHANNELS: { value: Channel; label: string; hint: string }[] = [
  { value: "instagram", label: "📸 Instagram", hint: "Emoji, persoonlijk, hashtags, max 2200 tekens" },
  { value: "linkedin", label: "💼 LinkedIn", hint: "Professioneel maar warm, storytelling, geen hashtag-spam" },
  { value: "facebook", label: "👥 Facebook", hint: "Vriendelijk, uitnodigend, community-gericht" },
  { value: "blog", label: "✍️ Blog", hint: "Informatief, SEO-vriendelijk, subkoppen, diepgaand" },
  { value: "website", label: "🌐 Website", hint: "Heldere call-to-actions, productgericht, beknopt" },
];

const CONTENT_TYPES: { value: ContentType; label: string }[] = [
  { value: "tip", label: "💡 Praktische tip" },
  { value: "citaat", label: "💬 Inspirerend citaat" },
  { value: "educatief", label: "📚 Educatieve post" },
  { value: "product", label: "🛒 Productpost" },
  { value: "seizoen", label: "🌸 Seizoensbericht" },
  { value: "behind_scenes", label: "🎬 Behind the scenes" },
  { value: "nieuws", label: "📰 Nieuwspost" },
  { value: "boekfragment", label: "📖 Boekfragment" },
];

const TONES: { value: Tone; label: string }[] = [
  { value: "warm_educatief", label: "🌿 Warm & educatief" },
  { value: "enthousiast", label: "🔥 Enthousiast & energiek" },
  { value: "persoonlijk", label: "💛 Persoonlijk & authentiek" },
  { value: "professioneel", label: "🎯 Professioneel & betrouwbaar" },
  { value: "poetisch", label: "✨ Poëtisch & inspirerend" },
];

export const Route = createFileRoute("/content-studio")({
  validateSearch: (search: Record<string, unknown>) => ({
    topic: typeof search.topic === "string" ? search.topic : "",
    keywords: typeof search.keywords === "string" ? search.keywords : "",
    source: typeof search.source === "string" ? search.source : "",
  }),
  head: () => ({
    meta: [
      { title: "Content Studio — HappyBeez" },
      {
        name: "description",
        content: "AI-ondersteund content schrijven voor al je kanalen.",
      },
    ],
  }),
  component: ContentStudioPage,
});

function ContentStudioPage() {
  return (
    <ProtectedRoute>
      <ContentStudio />
    </ProtectedRoute>
  );
}

function ContentStudio() {
  const { user } = useAuth();
  const generate = useServerFn(generateText);

  const [channel, setChannel] = useState<Channel>("instagram");
  const [contentType, setContentType] = useState<ContentType>("tip");
  const [tone, setTone] = useState<Tone>("warm_educatief");
  const [topic, setTopic] = useState("");
  const [keywords, setKeywords] = useState("");
  const [generated, setGenerated] = useState("");
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveDate, setSaveDate] = useState(
    new Date().toISOString().split("T")[0]!,
  );

  async function runGenerate() {
    setGenerating(true);
    setGenerated("");
    try {
      const toneLabel = TONES.find((t) => t.value === tone)?.label ?? "warm en educatief";
      const channelHint = CHANNELS.find((c) => c.value === channel)?.hint ?? "";
      const prompt = `Je schrijft een ${contentType.replace("_", " ")} post voor ${channel} namens HappyBeez — een Nederlands merk dat handgemaakte, natuurvriendelijke bijenhotels maakt in Boekel en educeert over solitaire bijen en biodiversiteit.

Toon: ${toneLabel}
Platform: ${channelHint}
${topic ? `Onderwerp: ${topic}` : ""}
${keywords ? `Kernwoorden: ${keywords}` : ""}

MERKSTIJL (verplicht volgen):
• Rustig, deskundig, natuurvriendelijk — eerst helpen, daarna pas verkopen. Geen schreeuwerige urgentie of kortingsdruk.
• Perspectief: "we / onze" namens HappyBeez, "je" voor praktisch advies.
• Zinsbouw: kort tot middellang. Vaak probleem → oplossing → onderbouwing.
• Structuur waar passend: 1 korte conclusie + 2–4 praktische bullets.

GEBRUIK DEZE TERMEN waar relevant: natuurvriendelijke bijenhotels, solitaire bijen, veilige nestelplaats, geschikte nestgangen, verwisselbare cassettes, onbehandeld beukenhout, Douglas hout, geborsteld RVS, diepe gladde nestgangen, verschillende diameters en dieptes, bestuiving, bloemen en voedsel, biodiversiteit, handgemaakt in Boekel.

VERMIJD STRIKT:
• Absolute claims als "dit redt de bijen" of "alle bijensoorten gebruiken dit hotel".
• De suggestie dat een bijenhotel voedsel biedt — het biedt nestelgelegenheid; bloemen leveren het voedsel.
• Garanties dat er bijen komen (locatie, zon, beschutting en bloemen bepalen het resultaat).
• Generieke marketingtaal en clichés.

CTA-stijl: kort en neutraal ("bekijken", "lees meer", "naar de webshop") — alleen toevoegen als er een logische koopintentie is.
${channel === "instagram" ? "Voeg onderaan 5–10 relevante, niet-spammy hashtags toe." : "Geen hashtags."}

Geef ALLEEN de posttekst terug, in het Nederlands.`;
      const { text } = await generate({ data: { prompt } });
      setGenerated(text);
      toast.success("Content gegenereerd.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "AI-fout");
    } finally {
      setGenerating(false);
    }
  }

  async function copy() {
    await navigator.clipboard.writeText(generated);
    setCopied(true);
    toast.success("Gekopieerd.");
    setTimeout(() => setCopied(false), 1800);
  }

  async function saveToCalendar() {
    if (!generated || !user) return;
    setSaving(true);
    const { error } = await supabase.from("content_calendar_items").insert({
      user_id: user.id,
      title: topic || `${contentType} — ${channel}`,
      channel,
      content_type: contentType,
      status: "idee",
      publish_date: saveDate,
      content_text: generated,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Opgeslagen in kalender.");
  }

  return (
    <div
      className="min-h-full"
      style={{
        ["--hb-green" as string]: "#6F8A3A",
        ["--hb-green-dark" as string]: "#56702A",
        ["--hb-dark" as string]: "#263022",
        ["--hb-wood" as string]: "#B98549",
        ["--hb-honey" as string]: "#D2A13A",
        ["--hb-offwhite" as string]: "#F6F3EA",
        ["--hb-border" as string]: "#E5E2DA",
        background: "var(--hb-offwhite)",
        color: "var(--hb-dark)",
        fontFamily:
          'Inter, "Helvetica Neue", Roboto, Arial, system-ui, sans-serif',
      }}
    >
      <div className="px-4 sm:px-8 py-8 max-w-6xl mx-auto">
        <div
          className="mb-6 rounded-2xl px-6 py-7 flex items-center justify-between gap-4 shadow-sm"
          style={{
            background:
              "linear-gradient(135deg, var(--hb-green) 0%, var(--hb-green-dark) 100%)",
            color: "#fff",
          }}
        >
          <div>
            <span className="text-[11px] tracking-[0.22em] uppercase opacity-80">
              HappyBeez · Social Studio
            </span>
            <h1
              className="font-bold text-2xl sm:text-3xl mt-1"
              style={{ fontFamily: "inherit", letterSpacing: "-0.01em" }}
            >
              Schrijf in onze stem
            </h1>
            <p className="text-sm mt-2 opacity-90 max-w-xl">
              Rustig, deskundig en natuurvriendelijk. Eerst helpen, daarna pas
              verkopen — voor solitaire bijen, biodiversiteit en handgemaakte
              bijenhotels uit Boekel.
            </p>
          </div>
          <div
            className="hidden sm:flex h-14 w-14 rounded-full items-center justify-center shrink-0"
            style={{ background: "rgba(255,255,255,0.18)" }}
          >
            <Sparkles className="w-7 h-7" style={{ color: "#fff" }} />
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <div className="space-y-5">
            <div
              className="rounded-2xl p-6 shadow-sm"
              style={{
                background: "#fff",
                border: "1px solid var(--hb-border)",
              }}
            >
              <h2
                className="font-semibold mb-4 flex items-center gap-2 text-base"
                style={{ color: "var(--hb-dark)" }}
              >
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ background: "var(--hb-green)" }}
                />
                Instellingen
              </h2>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Kanaal</Label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {CHANNELS.map((ch) => {
                      const active = channel === ch.value;
                      return (
                        <button
                          key={ch.value}
                          onClick={() => setChannel(ch.value)}
                          type="button"
                          className="px-3 py-2 rounded-lg text-xs font-medium transition-all text-left"
                          style={{
                            background: active
                              ? "var(--hb-green)"
                              : "var(--hb-offwhite)",
                            color: active ? "#fff" : "var(--hb-dark)",
                            border: `1px solid ${active ? "var(--hb-green)" : "var(--hb-border)"}`,
                          }}
                        >
                          {ch.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Type content</Label>
                  <Select
                    value={contentType}
                    onValueChange={(v) => setContentType(v as ContentType)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CONTENT_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Toon</Label>
                  <Select value={tone} onValueChange={(v) => setTone(v as Tone)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TONES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="topic">Onderwerp (optioneel)</Label>
                  <Input
                    id="topic"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="Bijv: solitaire metselbijen in de lente…"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="kw">Kernwoorden (optioneel)</Label>
                  <Input
                    id="kw"
                    value={keywords}
                    onChange={(e) => setKeywords(e.target.value)}
                    placeholder="bijenhotel, bestuiving, biodiversiteit…"
                  />
                </div>

                <Button
                  onClick={runGenerate}
                  disabled={generating}
                  className="w-full font-semibold rounded-full h-11 hover:brightness-110 transition"
                  style={{
                    background: "var(--hb-green)",
                    color: "#fff",
                  }}
                >
                  {generating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      AI schrijft…
                    </>
                  ) : (
                    <>
                      <Wand2 className="w-4 h-4 mr-2" />
                      Content genereren
                    </>
                  )}
                </Button>
              </div>
            </div>

            <a
              href={`https://www.canva.com/templates/?query=${channel}+bee+nature`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-4 rounded-xl transition-colors hover:brightness-105"
              style={{
                background: "rgba(210, 161, 58, 0.12)",
                border: "1px solid rgba(210, 161, 58, 0.35)",
              }}
            >
              <span
                className="text-sm font-medium"
                style={{ color: "var(--hb-dark)" }}
              >
                🎨 Canva templates voor {channel}
              </span>
              <ExternalLink
                className="w-4 h-4"
                style={{ color: "var(--hb-wood)" }}
              />
            </a>
          </div>

          <div>
            <div
              className="rounded-2xl overflow-hidden min-h-[500px] flex flex-col shadow-sm"
              style={{
                background: "#fff",
                border: "1px solid var(--hb-border)",
              }}
            >
              <div
                className="flex items-center justify-between px-5 py-4"
                style={{ borderBottom: "1px solid var(--hb-border)" }}
              >
                <h2
                  className="font-semibold"
                  style={{ color: "var(--hb-dark)" }}
                >
                  Gegenereerde post
                </h2>
                {generated && !generating && (
                  <button
                    onClick={runGenerate}
                    className="p-2 rounded-md transition-colors hover:bg-[var(--hb-offwhite)]"
                    title="Opnieuw genereren"
                    type="button"
                    style={{ color: "var(--hb-dark)" }}
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                )}
              </div>

              {generating ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center"
                    style={{ background: "rgba(111, 138, 58, 0.12)" }}
                  >
                    <Loader2
                      className="w-6 h-6 animate-spin"
                      style={{ color: "var(--hb-green)" }}
                    />
                  </div>
                  <p
                    className="text-sm"
                    style={{ color: "var(--hb-dark)", opacity: 0.7 }}
                  >
                    AI schrijft je post…
                  </p>
                </div>
              ) : generated ? (
                <div className="flex-1 flex flex-col">
                  <div
                    className="flex-1 p-5 whitespace-pre-wrap text-[15px] leading-[1.6]"
                    style={{ color: "var(--hb-dark)" }}
                  >
                    {generated}
                  </div>
                  <div
                    className="p-4 space-y-3"
                    style={{ borderTop: "1px solid var(--hb-border)" }}
                  >
                    <div className="flex gap-2">
                      <Button
                        onClick={copy}
                        variant="outline"
                        className="flex-1 rounded-full"
                        type="button"
                        style={{
                          borderColor: "var(--hb-border)",
                          color: "var(--hb-dark)",
                        }}
                      >
                        {copied ? (
                          <>
                            <CheckCheck className="w-4 h-4 mr-2" /> Gekopieerd
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4 mr-2" /> Kopiëren
                          </>
                        )}
                      </Button>
                    </div>
                    <div className="flex gap-2 items-end">
                      <div className="flex-1 space-y-1">
                        <Label htmlFor="save-date" className="text-xs">
                          Datum
                        </Label>
                        <Input
                          id="save-date"
                          type="date"
                          value={saveDate}
                          onChange={(e) => setSaveDate(e.target.value)}
                        />
                      </div>
                      <Button
                        onClick={saveToCalendar}
                        disabled={saving}
                        className="rounded-full font-semibold hover:brightness-110"
                        style={{
                          background: "var(--hb-green)",
                          color: "#fff",
                        }}
                      >
                        {saving ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Save className="w-4 h-4 mr-2" />
                        )}
                        Naar kalender
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center gap-2 p-8 text-center">
                  <Wand2
                    className="w-10 h-10"
                    style={{ color: "var(--hb-green)", opacity: 0.35 }}
                  />
                  <p
                    className="text-sm"
                    style={{ color: "var(--hb-dark)", opacity: 0.7 }}
                  >
                    Stel de instellingen in en klik op{" "}
                    <span style={{ fontWeight: 600 }}>Content genereren</span>.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
