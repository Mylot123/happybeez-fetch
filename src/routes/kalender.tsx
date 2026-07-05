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
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { generateText } from "@/lib/ai.functions";
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
// Index = ma(0) .. zo(6). rest=true betekent: geen post deze dag.
type DailyPlan = {
  channel?: Channel;
  content_type?: ContentType;
  label: string;
  rest?: boolean;
};
const WEEKLY_PLAN: DailyPlan[] = [
  { rest: true, label: "Rustdag — laat algoritme ademen" },
  { channel: "instagram", content_type: "tip", label: "IG tip / educatief" },
  { channel: "linkedin", content_type: "educatief", label: "LinkedIn kennis" },
  { channel: "instagram", content_type: "behind_scenes", label: "IG behind-the-scenes" },
  { channel: "facebook", content_type: "seizoen", label: "FB seizoens-post" },
  { rest: true, label: "Rustdag — engagement laag" },
  { channel: "instagram", content_type: "nieuws", label: "IG nieuws-haakje" },
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

      <div className="flex flex-wrap gap-3 mb-5">
        {CHANNELS.map((ch) => (
          <div
            key={ch}
            className="flex items-center gap-1.5 text-xs text-muted-foreground"
          >
            <div className={cn("w-2.5 h-2.5 rounded-full", channelDot[ch])} />
            <span className="capitalize">{ch}</span>
          </div>
        ))}
      </div>

      <PostingAdvice month={month} />


      <div className="bg-card rounded-lg shadow-sm border border-border overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-secondary/40">
          <button
            onClick={prev}
            className="p-2 hover:bg-secondary rounded-md transition-colors"
            aria-label="Vorige maand"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <h2 className="font-heading text-xl font-semibold text-ink">
            {MONTHS_NL[month]} {year}
          </h2>
          <button
            onClick={next}
            className="p-2 hover:bg-secondary rounded-md transition-colors"
            aria-label="Volgende maand"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
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
            const dayItems = itemsByDate.get(dateStr) ?? [];
            const isToday =
              today.getFullYear() === year &&
              today.getMonth() === month &&
              today.getDate() === day;
            const col = (firstDay + i) % 7;
            const weekend = col === 5 || col === 6;
            const plan = WEEKLY_PLAN[col]!;
            const planRoute = plan.rest ? null : routeForType(plan.content_type);

            return (
              <div
                key={day}
                onClick={() => openNew(dateStr)}
                className={cn(
                  "min-h-[110px] border-b border-r border-border/50 p-1.5 cursor-pointer transition-colors group",
                  weekend ? "bg-muted/40" : "hover:bg-secondary/40",
                  isToday && "bg-wine/5 ring-1 ring-inset ring-wine/30",
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={cn(
                      "text-xs font-semibold w-5 h-5 flex items-center justify-center rounded-full",
                      isToday
                        ? "bg-wine text-primary-foreground"
                        : "text-muted-foreground",
                    )}
                  >
                    {day}
                  </span>
                  {plan.channel && (
                    <span
                      className={cn(
                        "w-1.5 h-1.5 rounded-full",
                        channelDot[plan.channel],
                      )}
                      title={plan.label}
                    />
                  )}
                </div>

                {/* Dagtip: klik → ga direct naar de juiste tool */}
                {dayItems.length === 0 && (
                  plan.rest ? (
                    <div className="text-[10px] text-muted-foreground/80 px-1 py-0.5 flex items-center gap-1">
                      <Coffee className="w-3 h-3" /> Rustdag
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void navigate({
                          to: planRoute!,
                          search: {
                            date: dateStr,
                            channel: plan.channel,
                            type: plan.content_type,
                          } as never,
                        });
                      }}
                      className="w-full text-left text-[10px] leading-tight px-1.5 py-1 rounded border border-dashed border-border hover:border-wine/50 hover:bg-wine/5 text-muted-foreground hover:text-ink transition-colors flex items-center justify-between gap-1 group/tip"
                      title={`Ga naar ${planRoute === "/nieuws" ? "Nieuws" : "Content Studio"}`}
                    >
                      <span className="truncate">
                        {plan.channel && channelEmoji[plan.channel]} {plan.label}
                      </span>
                      <ArrowRight className="w-3 h-3 opacity-0 group-hover/tip:opacity-100 shrink-0" />
                    </button>
                  )
                )}

                <div className="space-y-0.5 mt-0.5">
                  {dayItems.slice(0, 3).map((item) => {
                    const itemType = (item.content_type as ContentType) ?? "tip";
                    const itemRoute = routeForType(itemType);
                    return (
                      <div
                        key={item.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          void navigate({
                            to: itemRoute,
                            search: {
                              date: item.publish_date ?? dateStr,
                              channel: item.channel,
                              type: itemType,
                              item: item.id,
                            } as never,
                          });
                        }}
                        className={cn(
                          "text-xs px-1.5 py-0.5 rounded border-l-2 flex items-center gap-1 cursor-pointer hover:bg-secondary/60 transition-colors bg-card text-ink group/item",
                          statusBorder[(item.status as Status) ?? "draft"],
                        )}
                        title={`Ga naar ${itemRoute === "/nieuws" ? "Nieuws" : "Content Studio"}`}
                      >
                        <span>{channelEmoji[(item.channel as Channel) ?? "instagram"]}</span>
                        <span className="truncate flex-1">{item.title}</span>
                        <button
                          type="button"
                          onClick={(e) => openEdit(item, e)}
                          className="opacity-0 group-hover/item:opacity-100 hover:text-wine transition-opacity"
                          title="Bewerken"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })}
                  {dayItems.length > 3 && (
                    <div className="text-xs text-muted-foreground px-1.5">
                      +{dayItems.length - 3} meer
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

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
                        <SelectItem key={s} value={s} className="capitalize">
                          {s}
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
    slots: "11:00–13:00 en 19:00–21:00",
    weekdays: "di, wo, do, zo",
    note: "Reels presteren beter 's avonds; carrousels rond lunch.",
  },
  linkedin: {
    slots: "07:30–09:00 en 12:00–13:00",
    weekdays: "di, wo, do",
    note: "Zakelijk publiek leest vóór werk en in lunchpauze.",
  },
  facebook: {
    slots: "09:00–11:00 en 19:00–21:00",
    weekdays: "wo, do, vr, zo",
    note: "Oudere doelgroep — ochtend koffie & avond TV-moment.",
  },
  blog: {
    slots: "Publiceer di of wo ochtend (08:00–10:00)",
    weekdays: "di, wo",
    note: "Google-indexering + delen via socials op zelfde dag.",
  },
  website: {
    slots: "Update vóór nieuwsbrief / campagne",
    weekdays: "ma, di",
    note: "Verkeer piekt op werkdagen vroeg in de week.",
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

