import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  Wand2,
  Loader2,
  Trash2,
  Copy,
  Download,
  ExternalLink,
  Pencil,
  Coffee,
  ArrowRight,
  Check,
  CircleDashed,
  Image as ImageIcon,
  CalendarDays,
  CalendarRange,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { PostMockup } from "@/components/PostMockups";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { generateText } from "@/lib/ai.functions";
import {
  CHANNEL_RULES,
  hookFeedback,
  wordFeedback,
  hashtagFeedback,
  levelColor,
  type Channel as StrategyChannel,
} from "@/lib/content-strategy";
import type { Database } from "@/integrations/supabase/types";


type CalendarRow = Database["public"]["Tables"]["content_calendar_items"]["Row"];
type CalendarInsert =
  Database["public"]["Tables"]["content_calendar_items"]["Insert"];

const CHANNELS = ["instagram", "linkedin", "facebook", "blog", "website"] as const;
const CONTENT_TYPES = [
  "tip",
  "citaat",
  "boekfragment",
  "product",
  "educatief",
  "seizoen",
  "nieuws",
  "behind_scenes",
] as const;
const STATUSES = ["draft", "review", "approved", "scheduled", "published", "failed"] as const;
const STATUS_LABEL: Record<(typeof STATUSES)[number], string> = {
  draft: "Concept",
  review: "Ter beoordeling",
  approved: "Goedgekeurd",
  scheduled: "Ingepland",
  published: "Gepubliceerd",
  failed: "Mislukt",
};

type Channel = (typeof CHANNELS)[number];
type ContentType = (typeof CONTENT_TYPES)[number];
type Status = (typeof STATUSES)[number];

const channelDot: Record<Channel, string> = {
  instagram: "bg-pink-400",
  linkedin: "bg-blue-500",
  facebook: "bg-indigo-500",
  blog: "bg-amber-500",
  website: "bg-emerald-500",
};

const channelEmoji: Record<Channel, string> = {
  instagram: "📸",
  linkedin: "💼",
  facebook: "👥",
  blog: "✍️",
  website: "🌐",
};

const statusBorder: Record<Status, string> = {
  draft: "border-l-muted-foreground/40",
  review: "border-l-amber-400",
  approved: "border-l-forest",
  scheduled: "border-l-blue-500",
  published: "border-l-emerald-500",
  failed: "border-l-destructive",
};

const DAYS_NL = ["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"];
const MONTHS_NL = [
  "Januari",
  "Februari",
  "Maart",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Augustus",
  "September",
  "Oktober",
  "November",
  "December",
];

// Weekly content-plan, afgestemd op beste posting-momenten + HappyBeez-niche.
// Gebaseerd op de virale contentstrategie: midweek focus, Reels voor bereik,
// carrousels/documents voor saves & shares, LinkedIn later op de dag.
// Index = ma(0) .. zo(6). rest=true betekent: geen post deze dag.
type DailyPlan = {
  channel?: Channel;
  content_type?: ContentType;
  label: string;
  time?: string; // aanbevolen posttijd (lokale tijd doelgroep)
  format?: string; // Reel, carrousel, document, native afbeelding, blog
  rest?: boolean;
};
const WEEKLY_PLAN: DailyPlan[] = [
  // Maandag — IG Reel (discovery, laag-drempelig weekstart)
  { channel: "instagram", content_type: "tip", label: "IG Reel — herkenbare tip", time: "12:30", format: "Reel 9:16" },
  // Dinsdag — LinkedIn thought leadership (midweek zakelijk piek)
  { channel: "linkedin", content_type: "educatief", label: "LinkedIn standpunt", time: "15:00", format: "Tekst + beeld of document" },
  // Woensdag — IG carrousel (saves + shares)
  { channel: "instagram", content_type: "educatief", label: "IG carrousel — save-post", time: "13:00", format: "Carrousel 4:5" },
  // Donderdag — Facebook community + LinkedIn video
  { channel: "facebook", content_type: "seizoen", label: "FB community-verhaal", time: "12:00", format: "Native afbeelding of Reel" },
  // Vrijdag — Blog publiceren (di/do als alternatief), plus IG behind-the-scenes
  { channel: "blog", content_type: "educatief", label: "Blog publiceren + delen", time: "08:00", format: "Long-form + social snippets" },
  // Zaterdag — rustdag (lagere B2B-engagement)
  { rest: true, label: "Rustdag — engagement laag" },
  // Zondag — IG Reel avond (consumer scroll)
  { channel: "instagram", content_type: "behind_scenes", label: "IG Reel — behind-the-scenes", time: "19:30", format: "Reel 9:16" },
];

function routeForType(content_type?: ContentType): "/nieuws" | "/content-studio" {
  return content_type === "nieuws" ? "/nieuws" : "/content-studio";
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}
function firstWeekday(year: number, month: number) {
  const d = new Date(year, month, 1).getDay();
  return d === 0 ? 6 : d - 1;
}
function fmtDate(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
function fmtDateObj(d: Date) {
  return fmtDate(d.getFullYear(), d.getMonth(), d.getDate());
}
function startOfWeek(d: Date) {
  const c = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const wd = c.getDay() === 0 ? 6 : c.getDay() - 1;
  c.setDate(c.getDate() - wd);
  return c;
}
function addDays(d: Date, n: number) {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
}
/** Een post telt als "gemaakt" zodra er echte contenttekst in staat. */
function isMade(item: CalendarRow) {
  return (item.content_text ?? "").trim().length > 20;
}


type FormState = {
  title: string;
  channel: Channel;
  content_type: ContentType;
  status: Status;
  publish_date: string;
  content_text: string;
  notes: string;
  canva_link: string;
};

const blankForm = (date: string): FormState => ({
  title: "",
  channel: "instagram",
  content_type: "tip",
  status: "draft",
  publish_date: date,
  content_text: "",
  notes: "",
  canva_link: "",
});

export const Route = createFileRoute("/kalender")({
  head: () => ({
    meta: [
      { title: "Kalender — HappyBeez" },
      {
        name: "description",
        content: "Plan en publiceer je social-media content per kanaal.",
      },
    ],
  }),
  component: KalenderPage,
});

function KalenderPage() {
  return (
    <ProtectedRoute>
      <Kalender />
    </ProtectedRoute>
  );
}

function Kalender() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const today = useMemo(() => new Date(), []);
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [items, setItems] = useState<CalendarRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<CalendarRow | null>(null);
  const [form, setForm] = useState<FormState>(() =>
    blankForm(today.toISOString().split("T")[0]!),
  );
  const [generating, setGenerating] = useState(false);
  const [view, setView] = useState<"week" | "maand">("week");
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()));
  const [detail, setDetail] = useState<CalendarRow | null>(null);
  const generate = useServerFn(generateText);


  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("content_calendar_items")
      .select("*")
      .order("publish_date", { ascending: false })
      .limit(500);
    if (error) {
      toast.error(error.message);
    } else {
      setItems((data ?? []) as CalendarRow[]);
    }
    setLoading(false);
  }

  function openNew(dateStr: string) {
    setEditing(null);
    setForm(blankForm(dateStr));
    setShowModal(true);
  }

  function openEdit(item: CalendarRow, e?: React.MouseEvent) {
    e?.stopPropagation();
    setEditing(item);
    setForm({
      title: item.title,
      channel: (item.channel as Channel) ?? "instagram",
      content_type: (item.content_type as ContentType) ?? "tip",
      status: (item.status as Status) ?? "draft",
      publish_date: item.publish_date ?? "",
      content_text: item.content_text ?? "",
      notes: item.notes ?? "",
      canva_link: item.canva_link ?? "",
    });
    setShowModal(true);
  }

  async function save() {
    if (!form.title.trim() || !form.publish_date) {
      toast.error("Vul minstens titel en datum in.");
      return;
    }
    if (!user) return;

    const payload: CalendarInsert = {
      user_id: user.id,
      title: form.title.trim(),
      channel: form.channel,
      content_type: form.content_type,
      status: form.status,
      publish_date: form.publish_date,
      content_text: form.content_text || null,
      notes: form.notes || null,
      canva_link: form.canva_link || null,
    };

    if (editing) {
      const { error } = await supabase
        .from("content_calendar_items")
        .update(payload)
        .eq("id", editing.id);
      if (error) return toast.error(error.message);
      toast.success("Item bijgewerkt.");
    } else {
      const { error } = await supabase
        .from("content_calendar_items")
        .insert(payload);
      if (error) return toast.error(error.message);
      toast.success("Item aangemaakt.");
    }
    setShowModal(false);
    void load();
  }

  async function remove(item: CalendarRow, e?: React.MouseEvent) {
    e?.stopPropagation();
    const { error } = await supabase
      .from("content_calendar_items")
      .delete()
      .eq("id", item.id);
    if (error) return toast.error(error.message);
    toast.success("Item verwijderd.");
    setShowModal(false);
    void load();
  }

  async function aiGenerate() {
    setGenerating(true);
    try {
      const prompt = `Schrijf een ${form.content_type.replace("_", " ")} post voor ${form.channel} voor een bedrijf dat bijenhotels verkoopt. De toon is warm, educatief en passioneel over natuur en biodiversiteit.${form.title ? ` Onderwerp: ${form.title}.` : ""} Schrijf in het Nederlands. Geef alleen de posttekst terug, geen uitleg.`;
      const { text } = await generate({ data: { prompt } });
      setForm((p) => ({ ...p, content_text: text }));
      toast.success("AI content gegenereerd.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "AI-fout");
    } finally {
      setGenerating(false);
    }
  }

  function prev() {
    if (month === 0) {
      setMonth(11);
      setYear((y) => y - 1);
    } else setMonth((m) => m - 1);
  }
  function next() {
    if (month === 11) {
      setMonth(0);
      setYear((y) => y + 1);
    } else setMonth((m) => m + 1);
  }

  const dim = daysInMonth(year, month);
  const firstDay = firstWeekday(year, month);
  const itemsByDate = useMemo(() => {
    const m = new Map<string, CalendarRow[]>();
    for (const it of items) {
      if (!it.publish_date) continue;
      const arr = m.get(it.publish_date) ?? [];
      arr.push(it);
      m.set(it.publish_date, arr);
    }
    return m;
  }, [items]);

  return (
    <div className="px-4 sm:px-8 py-8 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
        <div>
          <span className="text-xs tracking-[0.2em] uppercase text-muted-foreground font-medium">
            Planning
          </span>
          <h1 className="font-heading font-bold text-ink text-3xl mt-1 ruled-heading">
            Publicatiekalender
          </h1>
        </div>
        <Button
          onClick={() => openNew(fmtDate(year, month, today.getDate()))}
          className="bg-wine text-primary-foreground hover:bg-wine/90"
        >
          <Plus className="w-4 h-4 mr-2" /> Nieuw item
        </Button>
      </div>

      <div className="mb-5 rounded-lg border border-border bg-card p-5">
        <h2 className="font-heading text-base font-semibold text-ink mb-2">
          Zo werkt de kalender
        </h2>
        <ul className="text-sm text-muted-foreground space-y-1.5 list-disc list-inside">
          <li>
            <span className="text-ink font-medium">Week- of maandweergave:</span>{" "}
            standaard zie je de <span className="font-medium">weekkalender</span> met
            grote dagkolommen, voorbeeldbeelden en het volledige weekritme. Wissel
            rechtsboven naar maand voor het overzicht.
          </li>
          <li>
            <span className="text-ink font-medium">Gemaakt of nog te maken:</span>{" "}
            een groene <span className="font-medium">Gemaakt</span>-markering betekent
            dat de posttekst er al staat. Oranje{" "}
            <span className="font-medium">Nog te maken</span> betekent: schrijven in de
            Content Studio. Een fotolabel geeft aan dat er beeld met watermerk bij zit.
          </li>
          <li>
            <span className="text-ink font-medium">Post bekijken:</span> klik op een
            bestaande post om hem volledig te zien — afbeelding met watermerk,
            volledige tekst, hashtags en een viral-check (hook, lengte, hashtags,
            beeld, CTA) op basis van de contentstrategie.
          </li>
          <li>
            <span className="text-ink font-medium">Nieuw item:</span> klik op een
            lege dag of op <span className="font-medium">"Nieuw item"</span> rechtsboven
            om zelf een post in te plannen (titel, kanaal, type, datum, tekst,
            status en optioneel een Canva-link).
          </li>


          <li>
            <span className="text-ink font-medium">Statussen:</span> de gekleurde
            balk links van een item toont de status (concept, ter beoordeling,
            goedgekeurd, ingepland, gepubliceerd, mislukt). De volledige
            goedkeuringsflow beheer je op de{" "}
            <span className="font-medium">Planning &amp; goedkeuring</span>-pagina.
          </li>
          <li>
            <span className="text-ink font-medium">Advies onder de kalender:</span>{" "}
            per kanaal de beste tijden en dagen, plus een seizoenstip voor deze
            maand.
          </li>
        </ul>
        <div className="flex flex-wrap gap-3 mt-4 pt-3 border-t border-border/60">
          <span className="text-xs text-muted-foreground font-medium mr-1">
            Kanalen:
          </span>
          {CHANNELS.map((ch) => (
            <div
              key={ch}
              className="flex items-center gap-1.5 text-xs text-muted-foreground"
            >
              <div className={cn("w-2.5 h-2.5 rounded-full", channelDot[ch])} />
              <span className="capitalize">
                {channelEmoji[ch]} {ch}
              </span>
            </div>
          ))}
        </div>
      </div>

      <PostingAdvice month={month} />


      <div className="bg-card rounded-lg shadow-sm border border-border overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-4 border-b border-border bg-secondary/40">
          <div className="flex items-center gap-2">
            <button
              onClick={() => (view === "week" ? setWeekStart((w) => addDays(w, -7)) : prev())}
              className="p-2 hover:bg-secondary rounded-md transition-colors"
              aria-label="Vorige"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <h2 className="font-heading text-lg sm:text-xl font-semibold text-ink">
              {view === "week"
                ? `Week van ${weekStart.getDate()} ${MONTHS_NL[weekStart.getMonth()]!.toLowerCase()} ${weekStart.getFullYear()}`
                : `${MONTHS_NL[month]} ${year}`}
            </h2>
            <button
              onClick={() => (view === "week" ? setWeekStart((w) => addDays(w, 7)) : next())}
              className="p-2 hover:bg-secondary rounded-md transition-colors"
              aria-label="Volgende"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setView("week");
                setWeekStart(startOfWeek(new Date()));
              }}
              className="text-xs"
            >
              Vandaag
            </Button>
            <div className="flex rounded-md border border-border overflow-hidden">
              <button
                onClick={() => setView("week")}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 transition-colors",
                  view === "week"
                    ? "bg-wine text-primary-foreground"
                    : "bg-card text-muted-foreground hover:bg-secondary",
                )}
              >
                <CalendarRange className="w-3.5 h-3.5" /> Week
              </button>
              <button
                onClick={() => setView("maand")}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 transition-colors",
                  view === "maand"
                    ? "bg-wine text-primary-foreground"
                    : "bg-card text-muted-foreground hover:bg-secondary",
                )}
              >
                <CalendarDays className="w-3.5 h-3.5" /> Maand
              </button>
            </div>
          </div>
        </div>

        <div className="px-4 sm:px-6 py-2 border-b border-border/60 flex flex-wrap items-center gap-4 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5 text-emerald-600" /> Post is al gemaakt (tekst
            aanwezig)
          </span>
          <span className="flex items-center gap-1.5">
            <CircleDashed className="w-3.5 h-3.5 text-amber-600" /> Nog te maken in
            Content Studio
          </span>
          <span className="flex items-center gap-1.5">
            <ImageIcon className="w-3.5 h-3.5" /> Afbeelding met watermerk aanwezig
          </span>
        </div>

        <div className="grid grid-cols-7 border-b border-border">
          {DAYS_NL.map((d) => (
            <div
              key={d}
              className="py-2 text-center text-xs font-semibold text-muted-foreground"
            >
              {d}
            </div>
          ))}
        </div>

        {view === "week" ? (
          <div className="grid grid-cols-7">
            {Array.from({ length: 7 }).map((_, col) => {
              const d = addDays(weekStart, col);
              const dateStr = fmtDateObj(d);
              return (
                <DayCell
                  key={dateStr}
                  dateStr={dateStr}
                  dayNum={d.getDate()}
                  col={col}
                  big
                  items={itemsByDate.get(dateStr) ?? []}
                  isToday={dateStr === fmtDateObj(today)}
                  onNew={openNew}
                  onOpenDetail={(it) => setDetail(it)}
                  onEdit={openEdit}
                  onPlanClick={(route, plan) =>
                    void navigate({
                      to: route,
                      search: {
                        date: dateStr,
                        channel: plan.channel,
                        type: plan.content_type,
                      } as never,
                    })
                  }
                />
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-7">
            {Array.from({ length: firstDay }).map((_, i) => (
              <div
                key={`empty-${i}`}
                className="min-h-[90px] border-b border-r border-border/50 bg-muted/30"
              />
            ))}
            {Array.from({ length: dim }).map((_, i) => {
              const day = i + 1;
              const dateStr = fmtDate(year, month, day);
              const col = (firstDay + i) % 7;
              return (
                <DayCell
                  key={dateStr}
                  dateStr={dateStr}
                  dayNum={day}
                  col={col}
                  items={itemsByDate.get(dateStr) ?? []}
                  isToday={
                    today.getFullYear() === year &&
                    today.getMonth() === month &&
                    today.getDate() === day
                  }
                  onNew={openNew}
                  onOpenDetail={(it) => setDetail(it)}
                  onEdit={openEdit}
                  onPlanClick={(route, plan) =>
                    void navigate({
                      to: route,
                      search: {
                        date: dateStr,
                        channel: plan.channel,
                        type: plan.content_type,
                      } as never,
                    })
                  }
                />
              );
            })}
          </div>
        )}
      </div>

      {detail && (
        <PostDetail
          item={detail}
          onClose={() => setDetail(null)}
          onEdit={() => {
            const it = detail;
            setDetail(null);
            openEdit(it);
          }}
          onOpenStudio={() => {
            const it = detail;
            setDetail(null);
            void navigate({
              to: routeForType((it.content_type as ContentType) ?? "tip"),
              search: {
                date: it.publish_date ?? "",
                channel: it.channel,
                type: (it.content_type as ContentType) ?? "tip",
                item: it.id,
              } as never,
            });
          }}
        />
      )}


      {loading && (
        <p className="text-xs text-muted-foreground mt-4">Items laden…</p>
      )}

      {showModal && (
        <div
          className="fixed inset-0 bg-ink/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowModal(false)}
        >
          <div
            className="bg-card rounded-lg shadow-xl border border-border w-full max-w-lg max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h3 className="font-heading font-semibold text-ink">
                {editing ? "Item bewerken" : "Nieuw kalenderitem"}
              </h3>
              <div className="flex items-center gap-1">
                {editing && (
                  <button
                    onClick={(e) => remove(editing, e)}
                    className="p-2 hover:bg-destructive/10 rounded-md text-destructive transition-colors"
                    aria-label="Verwijderen"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => setShowModal(false)}
                  className="p-2 hover:bg-secondary rounded-md transition-colors"
                  aria-label="Sluiten"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="cal-title">Titel</Label>
                <Input
                  id="cal-title"
                  value={form.title}
                  onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                  placeholder="Onderwerp of beschrijving…"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Kanaal</Label>
                  <Select
                    value={form.channel}
                    onValueChange={(v) =>
                      setForm((p) => ({ ...p, channel: v as Channel }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CHANNELS.map((c) => (
                        <SelectItem key={c} value={c}>
                          {channelEmoji[c]} {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select
                    value={form.content_type}
                    onValueChange={(v) =>
                      setForm((p) => ({ ...p, content_type: v as ContentType }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CONTENT_TYPES.map((t) => (
                        <SelectItem key={t} value={t} className="capitalize">
                          {t.replace("_", " ")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="cal-date">Datum</Label>
                  <Input
                    id="cal-date"
                    type="date"
                    value={form.publish_date}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, publish_date: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={form.status}
                    onValueChange={(v) =>
                      setForm((p) => ({ ...p, status: v as Status }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {STATUS_LABEL[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="cal-text">Contenttekst</Label>
                  <button
                    onClick={aiGenerate}
                    disabled={generating}
                    className="flex items-center gap-1.5 text-xs text-wine hover:text-wine/80 font-medium disabled:opacity-50"
                    type="button"
                  >
                    {generating ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Wand2 className="w-3 h-3" />
                    )}
                    AI genereren
                  </button>
                </div>
                <Textarea
                  id="cal-text"
                  rows={5}
                  value={form.content_text}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, content_text: e.target.value }))
                  }
                  placeholder="Typ of genereer de contenttekst…"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cal-notes">Notities</Label>
                <Textarea
                  id="cal-notes"
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                  placeholder="Interne notities…"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cal-canva">Canva link</Label>
                <Input
                  id="cal-canva"
                  value={form.canva_link}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, canva_link: e.target.value }))
                  }
                  placeholder="https://canva.com/…"
                />
              </div>

              {editing && (
                <div className="space-y-2 rounded-md border border-border bg-secondary/30 p-3">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                    Publiceren
                  </Label>
                  {editing.image_url && (
                    <img
                      src={editing.image_url}
                      alt=""
                      className="w-full max-h-48 object-cover rounded-md border border-border"
                    />
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        await navigator.clipboard.writeText(form.content_text ?? "");
                        toast.success("Tekst gekopieerd — plak in Instagram.");
                      }}
                      disabled={!form.content_text}
                    >
                      <Copy className="w-3.5 h-3.5" /> Kopieer tekst
                    </Button>
                    {editing.image_url && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          try {
                            const res = await fetch(editing.image_url!);
                            const blob = await res.blob();
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement("a");
                            a.href = url;
                            a.download = `${editing.title || "post"}.jpg`;
                            document.body.appendChild(a);
                            a.click();
                            a.remove();
                            URL.revokeObjectURL(url);
                            toast.success("Afbeelding gedownload.");
                          } catch {
                            toast.error("Download mislukt.");
                          }
                        }}
                      >
                        <Download className="w-3.5 h-3.5" /> Download foto
                      </Button>
                    )}
                    {editing.channel === "instagram" && (
                      <Button
                        type="button"
                        size="sm"
                        className="bg-wine text-primary-foreground hover:bg-wine/90"
                        onClick={async () => {
                          await navigator.clipboard.writeText(form.content_text ?? "");
                          toast.success("Tekst gekopieerd. Plak in Instagram.");
                          window.open("https://www.instagram.com/", "_blank");
                        }}
                      >
                        <ExternalLink className="w-3.5 h-3.5" /> Kopieer & open Instagram
                      </Button>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Instagram staat geen directe upload via een externe site toe.
                    Klik op "Kopieer & open Instagram", download de foto en plak
                    de tekst in de Instagram-app of op desktop.
                  </p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowModal(false)}
                >
                  Annuleren
                </Button>
                <Button
                  onClick={save}
                  className="flex-1 bg-wine text-primary-foreground hover:bg-wine/90"
                >
                  Opslaan
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Posting-advies: beste momenten per kanaal (NL-publiek, tuin/bijen-niche)
// Bron: meta-analyse Later/Hootsuite/Sprout 2024-2025, vertaald naar
// CET en geverifieerd tegen HappyBeez-doelgroep (hobby-tuiniers, 35-65j).

const BEST_TIMES: Record<Channel, { slots: string; weekdays: string; note: string }> = {
  instagram: {
    slots: "12:00–16:00 (Reels + carrousels) · 18:00–21:00 (Reels avond)",
    weekdays: "ma, di, wo, do",
    note: "Reels = bereik, carrousels = saves & shares. Max 5 hashtags. Sterke hook in eerste seconde, ondertitels altijd aan. Reageer in het eerste uur.",
  },
  linkedin: {
    slots: "11:00–17:00 (test 12:00–14:00 én 15:00–17:00)",
    weekdays: "di, wo, do",
    note: "Persoonlijk profiel > bedrijfspagina. Standpunt in eerste 2 regels. 3000 tekens max, 3–5 hashtags. Reageer in het eerste uur op comments.",
  },
  facebook: {
    slots: "12:00–14:00 (lunch) · 19:00–21:00 (avond)",
    weekdays: "di, wo, do",
    note: "Native > links. Afbeelding en Reel scoren beste; deel-CTA werkt beter dan like-CTA. Max 3 hashtags, community-toon.",
  },
  blog: {
    slots: "06:00–10:00 publiceren (di/do/vr), zelfde dag delen op social + nieuwsbrief",
    weekdays: "di, do, vr",
    note: "People-first, unieke title + meta, OG-image, structured data, alt-tekst. Bouw interne links + backlinks; refresh oude toppers.",
  },
  website: {
    slots: "Vóór nieuwsbrief of campagne (ma/di ochtend)",
    weekdays: "ma, di",
    note: "Zorg dat CTA + hero-beeld actueel zijn vóór je verkeer stuurt. Mobile-first check.",
  },
};

const SEASONAL: Record<number, string> = {
  0: "Januari — voer-tips, vogels in tuin, vooruitblik bijenseizoen.",
  1: "Februari — sneeuwklokjes & eerste hommelkoninginnen spotten.",
  2: "Maart — start bijenhotel-seizoen, plaatsings­tips zijn HOT.",
  3: "April — piek interesse 'bijenhotel kopen'. Push product-posts.",
  4: "Mei — bloei + Moederdag (cadeau-haakje). Veel zoekvolume.",
  5: "Juni — broed in volle gang, behind-the-scenes van de hotels.",
  6: "Juli — vakantie­content, bijen op vakantie­tuin, lage CPM.",
  7: "Augustus — laatste generatie, oogsten van zaden voor 2027.",
  8: "September — najaars­bloei, voorbereiden op overwintering.",
  9: "Oktober — bijenhotel schoonmaken & opslaan = veel gezocht.",
  10: "November — Sinterklaas/cadeau-haakje, educatieve content.",
  11: "December — kerstcadeaus, jaaroverzicht, biodiversiteits-doelen 2027.",
};

function PostingAdvice({ month }: { month: number }) {
  return (
    <div className="mb-5 rounded-lg border border-border bg-card overflow-hidden">
      <div className="px-5 py-3 border-b border-border bg-secondary/40 flex items-center justify-between">
        <div>
          <span className="text-[11px] tracking-[0.2em] uppercase text-muted-foreground font-medium">
            Posting-advies
          </span>
          <h3 className="font-heading text-base font-semibold text-ink">
            Wanneer & waar posten?
          </h3>
        </div>
        <span className="text-xs text-muted-foreground hidden sm:block">
          Tijden in CET — NL hobby-tuinier 35-65j
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-border">
        {CHANNELS.map((ch) => {
          const a = BEST_TIMES[ch];
          return (
            <div key={ch} className="bg-card p-4">
              <div className="flex items-center gap-2 mb-1.5">
                <div className={cn("w-2.5 h-2.5 rounded-full", channelDot[ch])} />
                <span className="font-semibold text-ink capitalize text-sm">
                  {channelEmoji[ch]} {ch}
                </span>
              </div>
              <p className="text-xs text-ink mb-0.5">
                <span className="font-medium">Beste tijd:</span> {a.slots}
              </p>
              <p className="text-xs text-ink mb-1">
                <span className="font-medium">Beste dagen:</span> {a.weekdays}
              </p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                {a.note}
              </p>
            </div>
          );
        })}
      </div>

      <div className="px-5 py-3 border-t border-border bg-wine/5">
        <p className="text-xs text-ink">
          <span className="font-semibold text-wine">Seizoens­focus:</span>{" "}
          {SEASONAL[month]}
        </p>
      </div>
    </div>
  );
}


// ──────────────────────────────────────────────────────────────
// Dagcel — gedeeld door week- en maandweergave

function DayCell({
  dateStr,
  dayNum,
  col,
  big,
  items,
  isToday,
  onNew,
  onOpenDetail,
  onEdit,
  onPlanClick,
}: {
  dateStr: string;
  dayNum: number;
  col: number;
  big?: boolean;
  items: CalendarRow[];
  isToday: boolean;
  onNew: (date: string) => void;
  onOpenDetail: (item: CalendarRow) => void;
  onEdit: (item: CalendarRow, e?: React.MouseEvent) => void;
  onPlanClick: (route: "/nieuws" | "/content-studio", plan: DailyPlan) => void;
}) {
  const plan = WEEKLY_PLAN[col]!;
  const planRoute = plan.rest ? null : routeForType(plan.content_type);
  const weekend = col === 5 || col === 6;
  const visible = big ? items : items.slice(0, 3);

  return (
    <div
      onClick={() => onNew(dateStr)}
      className={cn(
        "border-b border-r border-border/50 p-1.5 cursor-pointer transition-colors group",
        big ? "min-h-[320px]" : "min-h-[110px]",
        weekend ? "bg-muted/40" : "hover:bg-secondary/40",
        isToday && "bg-wine/5 ring-1 ring-inset ring-wine/30",
      )}
    >
      <div className="flex items-center justify-between mb-1">
        <span
          className={cn(
            "text-xs font-semibold w-5 h-5 flex items-center justify-center rounded-full",
            isToday ? "bg-wine text-primary-foreground" : "text-muted-foreground",
          )}
        >
          {dayNum}
        </span>
        {plan.channel && (
          <span
            className={cn("w-1.5 h-1.5 rounded-full", channelDot[plan.channel])}
            title={plan.label}
          />
        )}
      </div>

      {/* Weekplan-suggestie: alleen tonen als er nog niets gemaakt is */}
      {items.length === 0 &&
        (plan.rest ? (
          <div className="text-[10px] text-muted-foreground/80 px-1 py-0.5 flex items-center gap-1">
            <Coffee className="w-3 h-3" /> Rustdag
          </div>
        ) : (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onPlanClick(planRoute!, plan);
            }}
            className="w-full text-left text-[10px] leading-tight px-1.5 py-1.5 rounded border border-dashed border-amber-400/60 bg-amber-50/40 hover:border-wine/50 hover:bg-wine/5 text-muted-foreground hover:text-ink transition-colors flex flex-col gap-0.5 group/tip"
            title={`Ga naar ${planRoute === "/nieuws" ? "Nieuws" : "Content Studio"}`}
          >
            <span className="flex items-center gap-1 text-amber-700 font-semibold">
              <CircleDashed className="w-3 h-3" /> Nog te maken
            </span>
            <span className="flex items-center justify-between gap-1">
              <span className="truncate">
                {plan.channel && channelEmoji[plan.channel]} {plan.label}
              </span>
              <ArrowRight className="w-3 h-3 opacity-0 group-hover/tip:opacity-100 shrink-0" />
            </span>
            {(plan.time || plan.format) && (
              <span className="text-[9px] text-muted-foreground/80 truncate">
                {plan.time && (
                  <span className="font-semibold text-wine/80">{plan.time}</span>
                )}
                {plan.time && plan.format ? " · " : ""}
                {plan.format}
              </span>
            )}
          </button>
        ))}

      <div className="space-y-1 mt-1">
        {visible.map((item) => {
          const made = isMade(item);
          return (
            <div
              key={item.id}
              onClick={(e) => {
                e.stopPropagation();
                onOpenDetail(item);
              }}
              className={cn(
                "text-xs px-1.5 py-1 rounded border-l-2 cursor-pointer hover:bg-secondary/60 transition-colors bg-card text-ink group/item",
                statusBorder[(item.status as Status) ?? "draft"],
              )}
              title="Bekijk de volledige post"
            >
              <div className="flex items-center gap-1">
                <span>{channelEmoji[(item.channel as Channel) ?? "instagram"]}</span>
                <span className="truncate flex-1">{item.title}</span>
                <button
                  type="button"
                  onClick={(e) => onEdit(item, e)}
                  className="opacity-0 group-hover/item:opacity-100 hover:text-wine transition-opacity"
                  title="Snel bewerken"
                >
                  <Pencil className="w-3 h-3" />
                </button>
              </div>
              <div className="flex items-center gap-2 mt-0.5 text-[9px]">
                <span
                  className={cn(
                    "flex items-center gap-0.5 font-semibold",
                    made ? "text-emerald-600" : "text-amber-600",
                  )}
                >
                  {made ? (
                    <>
                      <Check className="w-3 h-3" /> Gemaakt
                    </>
                  ) : (
                    <>
                      <CircleDashed className="w-3 h-3" /> Nog te maken
                    </>
                  )}
                </span>
                {item.image_url && <ImageIcon className="w-3 h-3 text-muted-foreground" />}
                <span className="text-muted-foreground truncate">
                  {STATUS_LABEL[(item.status as Status) ?? "draft"]}
                </span>
              </div>
              {big && item.image_url && (
                <img
                  src={item.image_url}
                  alt=""
                  loading="lazy"
                  className="mt-1 w-full h-16 object-cover rounded border border-border"
                />
              )}
            </div>
          );
        })}
        {!big && items.length > 3 && (
          <div className="text-xs text-muted-foreground px-1.5">
            +{items.length - 3} meer
          </div>
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Postdetail — volledige post incl. afbeelding (met watermerk) en viral-check

function PostDetail({
  item,
  onClose,
  onEdit,
  onOpenStudio,
}: {
  item: CalendarRow;
  onClose: () => void;
  onEdit: () => void;
  onOpenStudio: () => void;
}) {
  const channel = ((item.channel as StrategyChannel) ?? "instagram") in CHANNEL_RULES
    ? (item.channel as StrategyChannel)
    : "instagram";
  const rules = CHANNEL_RULES[channel];
  const text = item.content_text ?? "";
  const made = isMade(item);
  const checks = [
    hookFeedback(channel, text),
    wordFeedback(channel, text),
    hashtagFeedback(channel, text),
    {
      level: item.image_url ? ("good" as const) : ("warning" as const),
      message: item.image_url
        ? "Beeld aanwezig (met HappyBeez-watermerk)"
        : "Nog geen beeld — visuele posts scoren fors beter",
    },
    {
      level: /\?|deel|sla .*op|reageer/i.test(text) ? ("good" as const) : ("warning" as const),
      message: /\?|deel|sla .*op|reageer/i.test(text)
        ? "Duidelijke CTA of vraag aanwezig"
        : `Voeg een CTA toe, bijv. "${rules.ctaExamples[0]}"`,
    },
  ].filter((c) => c.message);

  return (
    <div
      className="fixed inset-0 bg-ink/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-card rounded-lg shadow-xl border border-border w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between px-6 py-4 border-b border-border">
          <div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{rules.emoji} {rules.label}</span>
              <span>·</span>
              <span>{item.publish_date ?? "geen datum"}</span>
              <span>·</span>
              <span>{STATUS_LABEL[(item.status as Status) ?? "draft"]}</span>
            </div>
            <h3 className="font-heading font-semibold text-ink text-lg mt-1">
              {item.title}
            </h3>
            <span
              className={cn(
                "inline-flex items-center gap-1 mt-1 text-[11px] font-semibold",
                made ? "text-emerald-600" : "text-amber-600",
              )}
            >
              {made ? <Check className="w-3.5 h-3.5" /> : <CircleDashed className="w-3.5 h-3.5" />}
              {made ? "Deze post is gemaakt" : "Deze post moet nog gemaakt worden"}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-secondary rounded-md transition-colors"
            aria-label="Sluiten"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="flex flex-col items-center gap-2">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Zo ziet de post er live uit
            </span>
            <PostMockup
              channel={channel}
              image={item.image_url ?? null}
              caption={text}
              title={item.title}
            />
            <p className="text-[11px] text-muted-foreground">
              {item.image_url
                ? "Beeld inclusief HappyBeez-watermerk."
                : "Nog geen afbeelding bij deze post."}
            </p>
          </div>


          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Volledige posttekst
            </Label>
            <p className="mt-2 whitespace-pre-wrap text-sm text-ink leading-relaxed">
              {text || "Nog geen tekst geschreven."}
            </p>
          </div>

          {(item.hashtags ?? []).length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {(item.hashtags ?? []).map((h) => (
                <span
                  key={h}
                  className="text-[11px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground"
                >
                  {h.startsWith("#") ? h : `#${h}`}
                </span>
              ))}
            </div>
          )}

          <div className="rounded-md border border-border bg-secondary/30 p-4">
            <h4 className="font-heading text-sm font-semibold text-ink mb-2">
              Viral-check voor {rules.label}
            </h4>
            <ul className="space-y-1.5">
              {checks.map((c, i) => (
                <li key={i} className="text-xs flex items-start gap-2">
                  <span
                    className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0"
                    style={{ background: levelColor(c.level) }}
                  />
                  <span className="text-muted-foreground">{c.message}</span>
                </li>
              ))}
            </ul>
            <p className="text-[11px] text-muted-foreground mt-3 leading-relaxed">
              Doel: {rules.goal}. Format: {rules.format}. Beste tijden:{" "}
              {rules.bestTimes} ({rules.bestDays}).
            </p>
          </div>

          {item.notes && (
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Notities
              </Label>
              <p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">
                {item.notes}
              </p>
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
            <Button
              size="sm"
              variant="outline"
              disabled={!text}
              onClick={async () => {
                await navigator.clipboard.writeText(text);
                toast.success("Tekst gekopieerd.");
              }}
            >
              <Copy className="w-3.5 h-3.5" /> Kopieer tekst
            </Button>
            {item.image_url && (
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  try {
                    const res = await fetch(item.image_url!);
                    const blob = await res.blob();
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `${item.title || "post"}.jpg`;
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                    URL.revokeObjectURL(url);
                    toast.success("Afbeelding gedownload.");
                  } catch {
                    toast.error("Download mislukt.");
                  }
                }}
              >
                <Download className="w-3.5 h-3.5" /> Download foto
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={onEdit}>
              <Pencil className="w-3.5 h-3.5" /> Snel bewerken
            </Button>
            <Button
              size="sm"
              className="bg-wine text-primary-foreground hover:bg-wine/90"
              onClick={onOpenStudio}
            >
              <ExternalLink className="w-3.5 h-3.5" />{" "}
              {made ? "Open in Content Studio" : "Maak af in Content Studio"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
