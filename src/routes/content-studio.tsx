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
      const channelHint =
        CHANNELS.find((c) => c.value === channel)?.hint ?? "";
      const prompt = `Schrijf een ${contentType.replace("_", " ")} post voor ${channel} voor een bedrijf dat bijenhotels verkoopt en een boek over bijen heeft geschreven.

Toon: ${toneLabel}
Platform-specificaties: ${channelHint}
${topic ? `Onderwerp: ${topic}` : ""}
${keywords ? `Kernwoorden: ${keywords}` : ""}

Het bedrijf staat voor: passie voor natuur en biodiversiteit, ambachtelijke bijenhotels voor solitaire bijen, educatie over bestuivers, duurzaamheid.

Schrijf de volledige post in het Nederlands. Voeg voor Instagram relevante hashtags onderaan toe. Geef ALLEEN de posttekst terug.`;
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
    <div className="px-4 sm:px-8 py-8 max-w-6xl mx-auto">
      <div className="mb-6">
        <span className="text-xs tracking-[0.2em] uppercase text-muted-foreground font-medium">
          Studio
        </span>
        <h1 className="font-heading font-bold text-ink text-3xl mt-1 ruled-heading">
          Content Studio
        </h1>
        <p className="text-muted-foreground text-sm mt-2">
          AI-ondersteund schrijven in jullie warm-educatieve toon.
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="space-y-5">
          <div className="bg-card rounded-lg shadow-sm border border-border p-6">
            <h2 className="font-heading font-semibold text-ink mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-gold" /> Instellingen
            </h2>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Kanaal</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {CHANNELS.map((ch) => (
                    <button
                      key={ch.value}
                      onClick={() => setChannel(ch.value)}
                      type="button"
                      className={cn(
                        "px-3 py-2 rounded-md text-xs font-medium transition-all text-left border",
                        channel === ch.value
                          ? "bg-wine text-primary-foreground border-wine shadow-sm"
                          : "bg-secondary border-border hover:border-wine/50",
                      )}
                    >
                      {ch.label}
                    </button>
                  ))}
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
                className="w-full bg-wine text-primary-foreground hover:bg-wine/90"
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
            className="flex items-center justify-between p-4 rounded-md bg-gold/10 border border-gold/30 hover:bg-gold/20 transition-colors"
          >
            <span className="text-sm text-ink font-medium">
              🎨 Canva templates voor {channel}
            </span>
            <ExternalLink className="w-4 h-4 text-muted-foreground" />
          </a>
        </div>

        <div>
          <div className="bg-card rounded-lg shadow-sm border border-border overflow-hidden min-h-[500px] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="font-heading font-semibold text-ink">
                Gegenereerde content
              </h2>
              {generated && !generating && (
                <button
                  onClick={runGenerate}
                  className="p-2 hover:bg-secondary rounded-md text-muted-foreground transition-colors"
                  title="Opnieuw genereren"
                  type="button"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              )}
            </div>

            {generating ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8">
                <div className="w-12 h-12 rounded-full bg-wine/10 flex items-center justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-wine" />
                </div>
                <p className="text-sm text-muted-foreground">
                  AI schrijft je post…
                </p>
              </div>
            ) : generated ? (
              <div className="flex-1 flex flex-col">
                <div className="flex-1 p-5 whitespace-pre-wrap text-sm text-ink leading-relaxed">
                  {generated}
                </div>
                <div className="border-t border-border p-4 space-y-3">
                  <div className="flex gap-2">
                    <Button
                      onClick={copy}
                      variant="outline"
                      className="flex-1"
                      type="button"
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
                      className="bg-wine text-primary-foreground hover:bg-wine/90"
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
                <Wand2 className="w-10 h-10 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">
                  Stel de instellingen in en klik op{" "}
                  <span className="font-medium text-ink">Content genereren</span>.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
