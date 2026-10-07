import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, MessageSquare, Mic, HelpCircle, TrendingUp, RefreshCw } from "lucide-react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { categorizeBijenkennerQuestions, QUESTION_CATEGORIES } from "@/lib/bijenkenner-analytics.functions";

export const Route = createFileRoute("/bijenspecialist-analyse")({
  head: () => ({
    meta: [
      { title: "Analyse Bijenspecialist | Happybeez Studio" },
      { name: "description", content: "Welke vragen bezoekers stellen aan de Bijenspecialist, per week en per kanaal." },
      { property: "og:title", content: "Analyse Bijenspecialist" },
      { property: "og:description", content: "Vragen, onderwerpen en gesprekken per week via chat en spraak." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <ProtectedRoute>
      <AnalysePage />
    </ProtectedRoute>
  ),
});

type Row = {
  id: string;
  session_id: string;
  kanaal: string;
  role: string;
  content: string;
  category: string | null;
  created_at: string;
};

function weekStart(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}
function weekNr(d: Date) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t.getTime() - y.getTime()) / 86400000 + 1) / 7);
}

const RANGES = [
  { label: "4 weken", weeks: 4 },
  { label: "12 weken", weeks: 12 },
  { label: "26 weken", weeks: 26 },
];

function AnalysePage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [weeks, setWeeks] = useState(12);
  const [kanaal, setKanaal] = useState<"alle" | "chat" | "spraak">("alle");
  const [cat, setCat] = useState<string>("alle");
  const [search, setSearch] = useState("");
  const [categorizing, setCategorizing] = useState(false);
  const categorize = useServerFn(categorizeBijenkennerQuestions);

  async function load() {
    const since = weekStart(new Date());
    since.setDate(since.getDate() - 7 * (weeks - 1));
    const { data } = await supabase
      .from("bijenkenner_messages")
      .select("id,session_id,kanaal,role,content,category,created_at")
      .gte("created_at", since.toISOString())
      .order("created_at", { ascending: false })
      .limit(5000);
    const list = (data ?? []) as Row[];
    setRows(list);
    if (list.some((r) => r.role === "user" && !r.category)) {
      setCategorizing(true);
      try {
        const res = await categorize();
        if (res.processed > 0) {
          const { data: again } = await supabase
            .from("bijenkenner_messages")
            .select("id,session_id,kanaal,role,content,category,created_at")
            .gte("created_at", since.toISOString())
            .order("created_at", { ascending: false })
            .limit(5000);
          setRows((again ?? []) as Row[]);
        }
      } catch {
        /* stil */
      } finally {
        setCategorizing(false);
      }
    }
  }

  useEffect(() => {
    void load();
  }, [weeks]);

  const stats = useMemo(() => {
    if (!rows) return null;
    const questions = rows.filter((r) => r.role === "user");
    const sessions = new Map<string, { kanaal: string; start: Date; vragen: number }>();
    for (const r of [...rows].reverse()) {
      const s = sessions.get(r.session_id);
      const d = new Date(r.created_at);
      if (!s) sessions.set(r.session_id, { kanaal: r.kanaal, start: d, vragen: r.role === "user" ? 1 : 0 });
      else if (r.role === "user") s.vragen++;
    }
    const sessList = [...sessions.values()];
    const chat = sessList.filter((s) => s.kanaal === "chat").length;
    const spraak = sessList.length - chat;

    const now = weekStart(new Date());
    const weekRows: { key: number; label: string; chat: number; spraak: number; vragen: number }[] = [];
    for (let i = weeks - 1; i >= 0; i--) {
      const w = new Date(now);
      w.setDate(w.getDate() - 7 * i);
      weekRows.push({ key: w.getTime(), label: `wk ${weekNr(w)}`, chat: 0, spraak: 0, vragen: 0 });
    }
    const byKey = new Map(weekRows.map((w) => [w.key, w]));
    for (const s of sessList) {
      const w = byKey.get(weekStart(s.start).getTime());
      if (w) w[s.kanaal === "spraak" ? "spraak" : "chat"]++;
    }
    for (const q of questions) {
      const w = byKey.get(weekStart(new Date(q.created_at)).getTime());
      if (w) w.vragen++;
    }

    const catCount: Record<string, { chat: number; spraak: number }> = {};
    for (const q of questions) {
      const c = q.category ?? "Nog niet ingedeeld";
      catCount[c] ??= { chat: 0, spraak: 0 };
      catCount[c][q.kanaal === "spraak" ? "spraak" : "chat"]++;
    }
    const cats = Object.entries(catCount)
      .map(([name, v]) => ({ name, ...v, total: v.chat + v.spraak }))
      .sort((a, b) => b.total - a.total);

    const thisWeek = weekRows[weekRows.length - 1];
    const lastWeek = weekRows[weekRows.length - 2];
    const thisWeekTotal = thisWeek ? thisWeek.chat + thisWeek.spraak : 0;
    const lastWeekTotal = lastWeek ? lastWeek.chat + lastWeek.spraak : 0;

    const hours = Array.from({ length: 24 }, () => 0);
    for (const q of questions) hours[new Date(q.created_at).getHours()]++;

    return {
      questions,
      totalSessions: sessList.length,
      chat,
      spraak,
      weekRows,
      cats,
      thisWeekTotal,
      lastWeekTotal,
      avgQ: sessList.length ? questions.length / sessList.length : 0,
      hours,
    };
  }, [rows, weeks]);

  const answerFor = useMemo(() => {
    const map = new Map<string, string>();
    if (!rows) return map;
    const asc = [...rows].reverse();
    for (let i = 0; i < asc.length; i++) {
      const r = asc[i];
      if (r.role !== "user") continue;
      const next = asc.slice(i + 1).find((x) => x.session_id === r.session_id);
      if (next && next.role === "assistant") map.set(r.id, next.content);
    }
    return map;
  }, [rows]);

  const filtered = useMemo(() => {
    if (!stats) return [];
    const s = search.trim().toLowerCase();
    return stats.questions.filter(
      (q) =>
        (kanaal === "alle" || q.kanaal === kanaal) &&
        (cat === "alle" || (q.category ?? "Nog niet ingedeeld") === cat) &&
        (!s || q.content.toLowerCase().includes(s)),
    );
  }, [stats, kanaal, cat, search]);

  const maxWeek = stats ? Math.max(1, ...stats.weekRows.map((w) => w.chat + w.spraak)) : 1;
  const maxCat = stats ? Math.max(1, ...stats.cats.map((c) => c.total)) : 1;
  const maxHour = stats ? Math.max(1, ...stats.hours) : 1;
  const diff = stats ? stats.thisWeekTotal - stats.lastWeekTotal : 0;

  return (
    <div className="px-4 sm:px-8 py-8 max-w-6xl mx-auto">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="text-xs tracking-[0.2em] uppercase text-muted-foreground font-medium">Analyse</span>
          <h1 className="font-heading font-bold text-ink text-3xl mt-1 ruled-heading">Vragen aan de Bijenspecialist</h1>
          <p className="text-muted-foreground text-sm mt-2 max-w-2xl">
            Wat bezoekers van happybeez.nl vragen, hoe vaak, en of ze liever chatten of praten. Vragen worden
            automatisch per onderwerp ingedeeld.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-border bg-card p-1">
            {RANGES.map((r) => (
              <button
                key={r.weeks}
                onClick={() => setWeeks(r.weeks)}
                className={cn(
                  "px-3 py-1.5 rounded-md text-sm font-medium",
                  weeks === r.weeks ? "bg-wine text-primary-foreground" : "text-muted-foreground hover:text-ink",
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={() => load()}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {!stats ? (
        <div className="py-20 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Kpi icon={MessageSquare} label="Gesprekken" value={stats.totalSessions}
              sub={`${stats.chat} chat · ${stats.spraak} spraak`} />
            <Kpi icon={HelpCircle} label="Gestelde vragen" value={stats.questions.length}
              sub={`gem. ${stats.avgQ.toFixed(1)} per gesprek`} />
            <Kpi icon={TrendingUp} label="Gesprekken deze week" value={stats.thisWeekTotal}
              sub={`${diff >= 0 ? "+" : ""}${diff} t.o.v. vorige week`} />
            <Kpi icon={Mic} label="Aandeel spraak"
              value={stats.totalSessions ? `${Math.round((stats.spraak / stats.totalSessions) * 100)}%` : "0%"}
              sub={stats.cats[0] ? `Top onderwerp: ${stats.cats[0].name}` : "Nog geen vragen"} />
          </div>

          {stats.totalSessions === 0 && (
            <div className="bg-card border border-border rounded-lg p-6 mb-6 text-sm text-muted-foreground">
              Nog geen gesprekken in deze periode. Vanaf nu wordt elke vraag op happybeez.nl hier bijgehouden
              (anoniem, zonder naam of e-mail van de bezoeker).
            </div>
          )}

          <div className="grid lg:grid-cols-2 gap-6 mb-6">
            <section className="bg-card border border-border rounded-lg p-5">
              <h2 className="font-heading font-semibold text-ink mb-1">Gesprekken per week</h2>
              <Legend />
              <div className="flex items-end gap-1.5 h-48 mt-4">
                {stats.weekRows.map((w) => {
                  const total = w.chat + w.spraak;
                  return (
                    <div key={w.key} className="flex-1 flex flex-col items-center gap-1 min-w-0" title={`${w.label}: ${w.chat} chat, ${w.spraak} spraak, ${w.vragen} vragen`}>
                      <span className="text-[10px] text-muted-foreground">{total || ""}</span>
                      <div className="w-full flex flex-col justify-end rounded-t overflow-hidden" style={{ height: `${(total / maxWeek) * 150}px` }}>
                        <div className="bg-gold" style={{ height: `${total ? (w.spraak / total) * 100 : 0}%` }} />
                        <div className="bg-wine" style={{ height: `${total ? (w.chat / total) * 100 : 0}%` }} />
                      </div>
                      <span className="text-[10px] text-muted-foreground truncate w-full text-center">{w.label}</span>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="bg-card border border-border rounded-lg p-5">
              <h2 className="font-heading font-semibold text-ink mb-1">Type vragen</h2>
              <div className="flex items-center gap-3">
                <Legend />
                {categorizing && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" /> nieuwe vragen indelen…
                  </span>
                )}
              </div>
              <div className="space-y-2.5 mt-4">
                {stats.cats.length === 0 && <p className="text-sm text-muted-foreground">Nog geen vragen.</p>}
                {stats.cats.map((c) => (
                  <button key={c.name} onClick={() => setCat(cat === c.name ? "alle" : c.name)} className="w-full text-left group">
                    <div className="flex justify-between text-sm mb-1">
                      <span className={cn("text-ink", cat === c.name && "font-semibold")}>{c.name}</span>
                      <span className="text-muted-foreground">
                        {c.total} · {Math.round((c.total / stats.questions.length) * 100)}%
                      </span>
                    </div>
                    <div className="h-2.5 rounded-full bg-muted overflow-hidden flex" style={{ width: `${Math.max(4, (c.total / maxCat) * 100)}%` }}>
                      <div className="bg-wine" style={{ width: `${(c.chat / c.total) * 100}%` }} />
                      <div className="bg-gold" style={{ width: `${(c.spraak / c.total) * 100}%` }} />
                    </div>
                  </button>
                ))}
              </div>
            </section>
          </div>

          <section className="bg-card border border-border rounded-lg p-5 mb-6">
            <h2 className="font-heading font-semibold text-ink mb-3">Op welk uur worden vragen gesteld</h2>
            <div className="flex items-end gap-1 h-24">
              {stats.hours.map((h, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1" title={`${i}:00 · ${h} vragen`}>
                  <div className="w-full bg-forest/70 rounded-t" style={{ height: `${(h / maxHour) * 70}px` }} />
                  <span className="text-[9px] text-muted-foreground">{i % 3 === 0 ? i : ""}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="bg-card border border-border rounded-lg p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <h2 className="font-heading font-semibold text-ink">Alle vragen ({filtered.length})</h2>
              <div className="flex flex-wrap gap-2">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Zoek in vragen…"
                  className="h-9 rounded-md border border-border bg-background px-3 text-sm"
                />
                <select value={kanaal} onChange={(e) => setKanaal(e.target.value as typeof kanaal)} className="h-9 rounded-md border border-border bg-background px-2 text-sm">
                  <option value="alle">Alle kanalen</option>
                  <option value="chat">Chat</option>
                  <option value="spraak">Spraak</option>
                </select>
                <select value={cat} onChange={(e) => setCat(e.target.value)} className="h-9 rounded-md border border-border bg-background px-2 text-sm">
                  <option value="alle">Alle onderwerpen</option>
                  {[...QUESTION_CATEGORIES, "Nog niet ingedeeld"].map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="divide-y divide-border">
              {filtered.slice(0, 200).map((q) => (
                <details key={q.id} className="py-3 group">
                  <summary className="cursor-pointer list-none flex items-start gap-3">
                    <span className={cn("mt-0.5 text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full border shrink-0",
                      q.kanaal === "spraak" ? "bg-gold/15 text-gold border-gold/30" : "bg-wine/10 text-wine border-wine/30")}>
                      {q.kanaal}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-ink">{q.content}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {new Date(q.created_at).toLocaleString("nl-NL")} · {q.category ?? "Nog niet ingedeeld"}
                      </p>
                    </div>
                  </summary>
                  {answerFor.get(q.id) && (
                    <p className="mt-2 ml-16 text-sm text-ink/80 bg-secondary/40 rounded-md p-3 whitespace-pre-wrap">
                      {answerFor.get(q.id)}
                    </p>
                  )}
                </details>
              ))}
              {filtered.length === 0 && <p className="text-sm text-muted-foreground py-4">Geen vragen gevonden.</p>}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function Legend() {
  return (
    <div className="flex gap-3 text-xs text-muted-foreground">
      <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-wine" /> Chat</span>
      <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-gold" /> Spraak</span>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, sub }: { icon: typeof Mic; label: string; value: number | string; sub: string }) {
  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wider">
        <Icon className="w-4 h-4" /> {label}
      </div>
      <p className="font-heading font-bold text-ink text-3xl mt-2">{value}</p>
      <p className="text-xs text-muted-foreground mt-1 truncate">{sub}</p>
    </div>
  );
}
