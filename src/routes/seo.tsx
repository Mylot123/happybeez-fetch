import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle,
  CheckCircle2,
  Compass,
  Crosshair,
  ExternalLink,
  Eye,
  FileSearch,
  Globe,
  Lightbulb,
  Loader2,
  RefreshCw,
  Search,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Trash2,
  Trophy,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useAuth } from "@/lib/auth";
import { analyzeDomain, auditPage, researchKeyword, trackKeyword } from "@/lib/seo.functions";

type SeoRow = Database["public"]["Tables"]["seo_keywords"]["Row"];
type Snapshot = Database["public"]["Tables"]["seo_domain_snapshots"]["Row"];
type Audit = Database["public"]["Tables"]["seo_page_audits"]["Row"];
type KwHistory = Database["public"]["Tables"]["seo_keyword_history"]["Row"];

type TopKw = {
  keyword: string;
  position: number | null;
  volume: number | null;
  cpc: number | null;
  competition: number | null;
  traffic_share: number | null;
  url: string | null;
  kd: number | null;
};
type Competitor = { domain: string; common_keywords: number | null; organic_keywords: number | null; organic_traffic: number | null };
type Idea = {
  keyword: string;
  search_volume: number | null;
  cpc: number | null;
  competition: number | null;
  difficulty: number | null;
  kind: "related" | "question" | "commercial" | "content" | "local";
  source?: "ai" | "fallback";
};

export const Route = createFileRoute("/seo")({
  head: () => ({
    meta: [
      { title: "SEO & Ranking — HappyBeez" },
      { name: "description", content: "Volg SEO-keywords, ranking, pagina-audits en concurrentie." },
    ],
  }),
  component: SeoPage,
});

function SeoPage() {
  return (
    <ProtectedRoute>
      <Seo />
    </ProtectedRoute>
  );
}

const TABS = [
  { id: "overview", label: "Domein-overzicht", icon: Globe },
  { id: "research", label: "Keyword-onderzoek", icon: Lightbulb },
  { id: "tracking", label: "Rank-tracking", icon: Target },
  { id: "audit", label: "Pagina-audit", icon: FileSearch },
  { id: "competitors", label: "Concurrenten", icon: Compass },
] as const;
type TabId = (typeof TABS)[number]["id"];

function Seo() {
  const { user } = useAuth();
  const [tab, setTab] = useState<TabId>("overview");

  // Domain & snapshot
  const [domain, setDomain] = useState("happybeez.nl");
  const [database, setDatabase] = useState("nl");
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [history, setHistory] = useState<KwHistory[]>([]);
  const [loadingSnap, setLoadingSnap] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [skipSemrush, setSkipSemrush] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("seo:skip_semrush") === "1";
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("seo:skip_semrush", skipSemrush ? "1" : "0");
  }, [skipSemrush]);

  function autoDisableOnLimit(msg: string | null | undefined) {
    if (msg && /limiet|limit|exceeded/i.test(msg) && !skipSemrush) {
      setSkipSemrush(true);
      toast.info("Semrush-limiet bereikt — fallback nu standaard aan.");
    }
  }

  // Tracked keywords
  const [tracked, setTracked] = useState<SeoRow[]>([]);

  // Research
  const [seed, setSeed] = useState("");
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [researching, setResearching] = useState(false);

  // Tracking add
  const [newKw, setNewKw] = useState("");
  const [trackingBusy, setTrackingBusy] = useState(false);

  // Audit
  const [audits, setAudits] = useState<Audit[]>([]);
  const [auditUrl, setAuditUrl] = useState("https://happybeez.nl");
  const [auditGoal, setAuditGoal] = useState("organisch verkeer & verkopen");
  const [auditKw, setAuditKw] = useState("bijenhotel");
  const [auditing, setAuditing] = useState(false);
  const [activeAudit, setActiveAudit] = useState<Audit | null>(null);

  useEffect(() => {
    void loadAll();
  }, []);


  async function loadAll() {
    setLoadingSnap(true);
    const [snaps, kws, aud, hist] = await Promise.all([
      supabase.from("seo_domain_snapshots").select("*").order("created_at", { ascending: false }).limit(30),
      supabase.from("seo_keywords").select("*").order("created_at", { ascending: false }),
      supabase.from("seo_page_audits").select("*").order("created_at", { ascending: false }).limit(10),
      supabase.from("seo_keyword_history").select("*").order("checked_at", { ascending: false }).limit(500),
    ]);
    setLoadingSnap(false);
    const snapList = (snaps.data ?? []) as Snapshot[];
    setSnapshots(snapList);
    if (snapList[0]) {
      setSnapshot(snapList[0]);
      setDomain(snapList[0].domain);
      setDatabase(snapList[0].database_code);
    }
    setTracked((kws.data ?? []) as SeoRow[]);
    setAudits((aud.data ?? []) as Audit[]);
    setHistory((hist.data ?? []) as KwHistory[]);
  }

  async function runAnalyze() {
    if (!domain.trim()) return toast.error("Vul een domein in.");
    setAnalyzing(true);
    try {
      const data = await analyzeDomain({ data: { domain: domain.trim(), database } });
      if (data.soft_error) {
        toast.warning(data.soft_error);
        await loadAll();
      } else {
        toast.success(`Analyse klaar — ${data.organic_keywords ?? 0} organische keywords gevonden.`);
        await loadAll();
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Analyse mislukt.");
    } finally {
      setAnalyzing(false);
    }

  }

  async function runResearch(s?: string) {
    const term = (s ?? seed).trim();
    if (term.length < 2) return toast.error("Vul een zoekwoord in.");
    setSeed(term);
    setResearching(true);
    try {
      const data = await researchKeyword({ data: { seed: term, database, limit: 20 } });
      setIdeas(data.ideas as Idea[]);
      if (data.soft_error) {
        toast.warning(data.soft_error);
      } else {
        toast.success(`${data.ideas.length} ideeën gevonden voor "${term}".`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Onderzoek mislukt.");
    } finally {
      setResearching(false);
    }
  }

  async function addTracked(kw: string) {
    if (!user) return;
    const keyword = kw.trim();
    if (!keyword) return;
    setTrackingBusy(true);
    try {
      const result = await trackKeyword({ data: { keyword, domain: domain.trim(), database } });
      if (result.soft_error) toast.warning(result.soft_error);
      else toast.success(`"${keyword}" toegevoegd.`);
      setNewKw("");
      const [{ data }, { data: h }] = await Promise.all([
        supabase.from("seo_keywords").select("*").order("created_at", { ascending: false }),
        supabase.from("seo_keyword_history").select("*").order("checked_at", { ascending: false }).limit(500),
      ]);
      setTracked((data ?? []) as SeoRow[]);
      setHistory((h ?? []) as KwHistory[]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Tracking mislukt.");
    } finally {
      setTrackingBusy(false);
    }
  }

  async function refreshKeyword(row: SeoRow) {
    if (!row.domain) return;
    setTrackingBusy(true);
    try {
      const result = await trackKeyword({ data: { keyword: row.keyword, domain: row.domain, database: row.database_code ?? "nl" } });
      const [{ data }, { data: h }] = await Promise.all([
        supabase.from("seo_keywords").select("*").order("created_at", { ascending: false }),
        supabase.from("seo_keyword_history").select("*").order("checked_at", { ascending: false }).limit(500),
      ]);
      setTracked((data ?? []) as SeoRow[]);
      setHistory((h ?? []) as KwHistory[]);
      if (result.soft_error) toast.warning(result.soft_error);
      else toast.success("Rank bijgewerkt.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update mislukt.");
    } finally {
      setTrackingBusy(false);
    }
  }

  async function removeTracked(id: string) {
    const { error } = await supabase.from("seo_keywords").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setTracked((p) => p.filter((x) => x.id !== id));
  }

  async function runAudit() {
    if (!auditUrl.trim()) return toast.error("Vul een URL in.");
    setAuditing(true);
    try {
      const res = await auditPage({
        data: { url: auditUrl.trim(), goal: auditGoal.trim() || undefined, target_keyword: auditKw.trim() || undefined },
      });
      toast.success(`Audit klaar — score ${res.score}/100.`);
      const { data } = await supabase.from("seo_page_audits").select("*").order("created_at", { ascending: false }).limit(10);
      setAudits((data ?? []) as Audit[]);
      const first = (data ?? [])[0] as Audit | undefined;
      if (first) setActiveAudit(first);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Audit mislukt.");
    } finally {
      setAuditing(false);
    }
  }

  const topKws = (snapshot?.top_keywords ?? []) as TopKw[];
  const quickWins = (snapshot?.quick_wins ?? []) as TopKw[];
  const competitors = (snapshot?.competitors ?? []) as Competitor[];

  const trackedStats = useMemo(() => {
    const ranked = tracked.filter((t) => t.current_rank != null);
    const top10 = ranked.filter((t) => (t.current_rank ?? 99) <= 10).length;
    const top3 = ranked.filter((t) => (t.current_rank ?? 99) <= 3).length;
    const totalVol = tracked.reduce((s, t) => s + (t.search_volume ?? 0), 0);
    const avg = ranked.length ? Math.round(ranked.reduce((s, t) => s + (t.current_rank ?? 0), 0) / ranked.length) : null;
    return { top3, top10, totalVol, avg, ranked: ranked.length };
  }, [tracked]);

  return (
    <div className="px-4 py-8 sm:px-8 max-w-7xl mx-auto">
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <span className="text-xs tracking-[0.2em] uppercase text-muted-foreground font-medium">Vindbaarheid</span>
          <h1 className="font-heading font-bold text-ink text-3xl mt-1 ruled-heading">SEO & Ranking</h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
            SEO-engine met eigen pagina-audits, AI-keywordstrategie en Semrush-data wanneer beschikbaar — zonder stil te vallen bij limieten.
          </p>
        </div>
      </div>

      {/* Domain bar */}
      <div className="bg-card border border-border rounded-lg p-4 shadow-sm mb-6 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[14rem] space-y-1.5">
          <Label htmlFor="seo-domain" className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Jouw domein</Label>
          <Input id="seo-domain" value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="happybeez.nl" />
        </div>
        <div className="w-28 space-y-1.5">
          <Label htmlFor="seo-db" className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Markt</Label>
          <select
            id="seo-db"
            value={database}
            onChange={(e) => setDatabase(e.target.value)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="nl">NL</option>
            <option value="be">BE</option>
            <option value="de">DE</option>
            <option value="us">US</option>
            <option value="uk">UK</option>
          </select>
        </div>
        <Button onClick={runAnalyze} disabled={analyzing} className="bg-wine text-white hover:bg-wine/90">
          {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {analyzing ? "Analyseren…" : snapshot ? "Vernieuw analyse" : "Analyseer domein"}
        </Button>
        {snapshot ? (
          <span className="text-xs text-muted-foreground self-center">
            Laatste analyse: {new Date(snapshot.created_at).toLocaleString("nl-NL")}
          </span>
        ) : null}
      </div>

      <div className="mb-6 rounded-lg border border-honey/40 bg-honey/10 p-4 text-sm text-foreground/85">
        <div className="flex items-start gap-2">
          <Lightbulb className="h-4 w-4 text-gold mt-0.5 shrink-0" />
          <p>
            Semrush is handig voor exacte volumes en rankings, maar niet verplicht. Bij een limiet maakt deze tool automatisch een bruikbaar SEO-plan op basis van je eigen site, AI en opgeslagen metingen.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-border mb-6 flex flex-wrap gap-1">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm border-b-2 -mb-px transition-colors ${
                active ? "border-wine text-ink font-medium" : "border-transparent text-muted-foreground hover:text-ink"
              }`}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* ──────────────── Overview ──────────────── */}
      {tab === "overview" ? (
        <div className="space-y-6">
          {loadingSnap ? (
            <p className="text-sm text-muted-foreground">Laden…</p>
          ) : !snapshot ? (
            <div className="bg-card border border-dashed border-border rounded-lg p-10 text-center">
              <Globe className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="font-heading text-lg text-ink">Nog geen domeinanalyse</p>
              <p className="text-sm text-muted-foreground mt-1">Vul je domein in en klik op "Analyseer domein" om te starten.</p>
            </div>
          ) : (
            <>
              <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
                <StatCard icon={Trophy} label="Globale rank" value={fmtNum(snapshot.rank_global)} delta={deltaFor(snapshots, "rank_global", true)} />
                <StatCard icon={Search} label="Organische keywords" value={fmtNum(snapshot.organic_keywords)} delta={deltaFor(snapshots, "organic_keywords")} />
                <StatCard icon={TrendingUp} label="Organisch verkeer (mnd)" value={fmtNum(snapshot.organic_traffic)} delta={deltaFor(snapshots, "organic_traffic")} />
                <StatCard icon={Target} label="Verkeerwaarde" value={`€${fmtNum(snapshot.organic_cost)}`} delta={deltaFor(snapshots, "organic_cost")} />
              </div>

              {snapshots.length > 1 ? (
                <Section title="Verloop domein" subtitle={`${snapshots.length} metingen bewaard — vergelijk hoe je domein zich ontwikkelt.`} icon={TrendingUp}>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                          <th className="py-2 pr-4">Datum</th>
                          <th className="py-2 pr-4 text-right">Globale rank</th>
                          <th className="py-2 pr-4 text-right">Organische KW</th>
                          <th className="py-2 pr-4 text-right">Verkeer (mnd)</th>
                          <th className="py-2 pr-4 text-right">Verkeerwaarde</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {snapshots.map((s) => (
                          <tr key={s.id} className="hover:bg-secondary/30">
                            <td className="py-2 pr-4 text-xs text-muted-foreground">{new Date(s.created_at).toLocaleString("nl-NL")}</td>
                            <td className="py-2 pr-4 text-right tabular-nums">{fmtNum(s.rank_global)}</td>
                            <td className="py-2 pr-4 text-right tabular-nums">{fmtNum(s.organic_keywords)}</td>
                            <td className="py-2 pr-4 text-right tabular-nums">{fmtNum(s.organic_traffic)}</td>
                            <td className="py-2 pr-4 text-right tabular-nums">€{fmtNum(s.organic_cost)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Section>
              ) : null}



              {quickWins.length > 0 ? (
                <Section title="Quick wins" subtitle="Keywords op positie 4–20 met goed volume — kleine optimalisatie kan ze de top-3 in duwen." icon={Lightbulb}>
                  <KeywordTable rows={quickWins} highlight />
                </Section>
              ) : null}

              <Section title="Top organische keywords" subtitle="Waar je nu al op rankt volgens Semrush." icon={TrendingUp}>
                {topKws.length === 0 ? (
                  <p className="text-sm text-muted-foreground p-4">Geen keyword-data.</p>
                ) : (
                  <KeywordTable rows={topKws.slice(0, 25)} />
                )}
              </Section>

              {competitors.length > 0 ? (
                <Section title="Top concurrenten" subtitle="Domeinen die op dezelfde keywords ranken." icon={Compass}>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                          <th className="py-2 pr-4">Domein</th>
                          <th className="py-2 pr-4 text-right">Gedeelde KW</th>
                          <th className="py-2 pr-4 text-right">Organische KW</th>
                          <th className="py-2 pr-4 text-right">Organisch verkeer</th>
                          <th className="py-2 pr-4"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {competitors.map((c) => (
                          <tr key={c.domain} className="hover:bg-secondary/30">
                            <td className="py-2 pr-4 font-medium text-ink">{c.domain}</td>
                            <td className="py-2 pr-4 text-right">{fmtNum(c.common_keywords)}</td>
                            <td className="py-2 pr-4 text-right">{fmtNum(c.organic_keywords)}</td>
                            <td className="py-2 pr-4 text-right">{fmtNum(c.organic_traffic)}</td>
                            <td className="py-2 pr-4 text-right">
                              <a href={`https://${c.domain}`} target="_blank" rel="noreferrer" className="text-wine inline-flex items-center gap-1 text-xs">
                                bezoek <ExternalLink className="h-3 w-3" />
                              </a>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Section>
              ) : null}
            </>
          )}
        </div>
      ) : null}

      {/* ──────────────── Research ──────────────── */}
      {tab === "research" ? (
        <div className="space-y-6">
          <Section title="Keyword-onderzoek" subtitle="Vind koopkeywords, vragen en blogonderwerpen. Exacte volumes komen uit Semrush; bij limiet vult AI het strategisch aan." icon={Lightbulb}>
            <div className="flex flex-wrap gap-2 mb-4">
              <Input
                value={seed}
                onChange={(e) => setSeed(e.target.value)}
                placeholder="bv. bijenhotel, wilde bijen, insectenhotel…"
                onKeyDown={(e) => {
                  if (e.key === "Enter") void runResearch();
                }}
                className="flex-1 min-w-[14rem]"
              />
              <Button onClick={() => void runResearch()} disabled={researching} className="bg-wine text-white hover:bg-wine/90">
                {researching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Onderzoek
              </Button>
            </div>
            <div className="flex flex-wrap gap-1.5 mb-4">
              {["bijenhotel", "wilde bijen", "insectenhotel", "metselbij", "bestuivers tuin"].map((s) => (
                <button
                  key={s}
                  onClick={() => void runResearch(s)}
                  className="text-xs px-2.5 py-1 rounded-full bg-secondary hover:bg-secondary/70 text-foreground"
                >
                  {s}
                </button>
              ))}
            </div>
            {ideas.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nog geen ideeën. Start een zoekopdracht hierboven.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                      <th className="py-2 pr-4">Keyword</th>
                      <th className="py-2 pr-4">Type</th>
                      <th className="py-2 pr-4 text-right">Volume</th>
                      <th className="py-2 pr-4 text-right">CPC</th>
                      <th className="py-2 pr-4 text-right">KD</th>
                      <th className="py-2 pr-4 text-right">Actie</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {ideas.map((idea, i) => (
                      <tr key={`${idea.keyword}-${i}`} className="hover:bg-secondary/30">
                        <td className="py-2 pr-4 font-medium text-ink">{idea.keyword}</td>
                        <td className="py-2 pr-4">
                          <span className={`text-xs px-2 py-0.5 rounded ${idea.kind === "question" ? "bg-honey/30 text-ink" : idea.kind === "commercial" ? "bg-green-100 text-green-800" : "bg-secondary text-muted-foreground"}`}>
                            {idea.kind === "question" ? "vraag" : idea.kind === "commercial" ? "koop" : idea.kind === "content" ? "blog" : idea.kind === "local" ? "lokaal" : "verwant"}
                          </span>
                        </td>
                        <td className="py-2 pr-4 text-right tabular-nums">{fmtNum(idea.search_volume)}</td>
                        <td className="py-2 pr-4 text-right tabular-nums">{idea.cpc ? `€${idea.cpc.toFixed(2)}` : "—"}</td>
                        <td className="py-2 pr-4 text-right tabular-nums">{kdBadge(idea.difficulty)}</td>
                        <td className="py-2 pr-4 text-right">
                          <button
                            onClick={() => void addTracked(idea.keyword)}
                            className="text-xs text-wine hover:underline inline-flex items-center gap-1"
                          >
                            <Crosshair className="h-3 w-3" /> Volg
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        </div>
      ) : null}

      {/* ──────────────── Tracking ──────────────── */}
      {tab === "tracking" ? (
        <div className="space-y-6">
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            <StatCard icon={Crosshair} label="Gevolgde keywords" value={String(tracked.length)} />
            <StatCard icon={Trophy} label="Top 3" value={String(trackedStats.top3)} accent="green" />
            <StatCard icon={Target} label="Top 10" value={String(trackedStats.top10)} accent="green" />
            <StatCard icon={TrendingUp} label="Gem. positie" value={trackedStats.avg ? `#${trackedStats.avg}` : "—"} />
          </div>

          <Section title="Rank-tracking" subtitle="Voeg keywords toe en bewaar iedere meting. Als Semrush op limiet zit, blijft het keyword alvast in je SEO-lijst staan." icon={Target}>
            <div className="flex flex-wrap gap-2 mb-4">
              <Input
                value={newKw}
                onChange={(e) => setNewKw(e.target.value)}
                placeholder="bv. bijenhotel kopen"
                onKeyDown={(e) => {
                  if (e.key === "Enter") void addTracked(newKw);
                }}
                className="flex-1 min-w-[14rem]"
              />
              <Button onClick={() => void addTracked(newKw)} disabled={trackingBusy} className="bg-wine text-white hover:bg-wine/90">
                {trackingBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crosshair className="h-4 w-4" />} Voeg toe & check
              </Button>
            </div>
            {tracked.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nog geen gevolgde keywords. Voeg er één toe of "volg" een idee uit het onderzoek.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                      <th className="py-2 pr-4">Keyword</th>
                      <th className="py-2 pr-4 text-right">Positie</th>
                      <th className="py-2 pr-4 text-right">Trend</th>
                      <th className="py-2 pr-4 text-right">Volume</th>
                      <th className="py-2 pr-4 text-right">KD</th>
                      <th className="py-2 pr-4">URL</th>
                      <th className="py-2 pr-4">Laatste check</th>
                      <th className="py-2 pr-4 text-right">Acties</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {tracked.map((row) => {
                      const hist = history
                        .filter((h) => h.keyword === row.keyword && h.domain === row.domain)
                        .sort((a, b) => +new Date(b.checked_at) - +new Date(a.checked_at));
                      const prev = hist[1];
                      const rankDelta =
                        prev?.rank != null && row.current_rank != null ? prev.rank - row.current_rank : null;
                      return (
                        <tr key={row.id} className="hover:bg-secondary/30">
                          <td className="py-2 pr-4 font-medium text-ink">{row.keyword}</td>
                          <td className="py-2 pr-4 text-right">{positionBadge(row.current_rank)}</td>
                          <td className="py-2 pr-4 text-right">
                            {rankDelta == null || rankDelta === 0 ? (
                              <span className="text-xs text-muted-foreground">—</span>
                            ) : rankDelta > 0 ? (
                              <span className="text-xs text-green-700 inline-flex items-center gap-0.5">
                                <TrendingUp className="h-3 w-3" /> +{rankDelta}
                              </span>
                            ) : (
                              <span className="text-xs text-destructive inline-flex items-center gap-0.5">
                                <TrendingDown className="h-3 w-3" /> {rankDelta}
                              </span>
                            )}
                            {hist.length > 1 ? (
                              <span className="block text-[10px] text-muted-foreground">{hist.length} metingen</span>
                            ) : null}
                          </td>
                          <td className="py-2 pr-4 text-right tabular-nums">{fmtNum(row.search_volume)}</td>
                          <td className="py-2 pr-4 text-right tabular-nums">{kdBadge(row.difficulty)}</td>
                          <td className="py-2 pr-4 text-xs text-muted-foreground max-w-[18rem] truncate">
                            {row.position_url ? (
                              <a href={row.position_url} target="_blank" rel="noreferrer" className="hover:text-wine">
                                {row.position_url}
                              </a>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="py-2 pr-4 text-xs text-muted-foreground">
                            {row.last_checked_at ? new Date(row.last_checked_at).toLocaleDateString("nl-NL") : "—"}
                          </td>
                          <td className="py-2 pr-4 text-right">
                            <div className="inline-flex gap-2">
                              <button
                                onClick={() => void refreshKeyword(row)}
                                disabled={trackingBusy}
                                className="text-muted-foreground hover:text-wine"
                                title="Ververs"
                              >
                                <RefreshCw className="h-4 w-4" />
                              </button>
                              <button onClick={() => void removeTracked(row.id)} className="text-muted-foreground hover:text-destructive" title="Verwijder">
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        </div>
      ) : null}

      {/* ──────────────── Audit ──────────────── */}
      {tab === "audit" ? (
        <div className="grid gap-6 lg:grid-cols-[24rem_1fr]">
          <Section title="Nieuwe audit" subtitle="On-page SEO-check met AI-advies." icon={FileSearch}>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="au-url">Pagina URL</Label>
                <Input id="au-url" value={auditUrl} onChange={(e) => setAuditUrl(e.target.value)} placeholder="https://…" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="au-kw">Doel-keyword</Label>
                <Input id="au-kw" value={auditKw} onChange={(e) => setAuditKw(e.target.value)} placeholder="bv. bijenhotel" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="au-goal">Zakelijk doel</Label>
                <Input id="au-goal" value={auditGoal} onChange={(e) => setAuditGoal(e.target.value)} placeholder="bv. verkoop / autoriteit" />
              </div>
              <Button onClick={runAudit} disabled={auditing} className="w-full bg-wine text-white hover:bg-wine/90">
                {auditing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} {auditing ? "Audit loopt…" : "Start audit"}
              </Button>
            </div>
            {audits.length > 0 ? (
              <div className="mt-6">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-2">Eerdere audits</p>
                <div className="space-y-1.5">
                  {audits.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => setActiveAudit(a)}
                      className={`w-full text-left text-xs p-2 rounded border transition-colors ${
                        activeAudit?.id === a.id ? "border-wine bg-secondary/40" : "border-border hover:bg-secondary/30"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate">{a.url.replace(/^https?:\/\//, "")}</span>
                        <span className={`tabular-nums font-semibold ${scoreColor(a.score)}`}>{a.score ?? "—"}</span>
                      </div>
                      <span className="text-muted-foreground">{new Date(a.created_at).toLocaleString("nl-NL")}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </Section>

          <div className="space-y-6">
            {activeAudit ? (
              <AuditView audit={activeAudit} />
            ) : (
              <div className="bg-card border border-dashed border-border rounded-lg p-10 text-center">
                <Eye className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="font-heading text-lg text-ink">Nog geen audit geopend</p>
                <p className="text-sm text-muted-foreground mt-1">Start een nieuwe audit links, of kies een eerdere.</p>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {/* ──────────────── Competitors ──────────────── */}
      {tab === "competitors" ? (
        <Section title="Concurrentie-overzicht" subtitle="Domeinen die op dezelfde keywords ranken als jij." icon={Compass}>
          {competitors.length === 0 ? (
            <p className="text-sm text-muted-foreground">Run eerst een domeinanalyse op het tabblad "Domein-overzicht".</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {competitors.map((c) => (
                <div key={c.domain} className="border border-border rounded-lg p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-heading text-lg text-ink">{c.domain}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{fmtNum(c.common_keywords)} gedeelde keywords</p>
                    </div>
                    <a href={`https://${c.domain}`} target="_blank" rel="noreferrer" className="text-wine text-xs inline-flex items-center gap-1">
                      bezoek <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">Organische KW</span>
                      <p className="font-medium tabular-nums">{fmtNum(c.organic_keywords)}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Organisch verkeer</span>
                      <p className="font-medium tabular-nums">{fmtNum(c.organic_traffic)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>
      ) : null}

      <p className="mt-8 text-xs text-muted-foreground border-t border-border pt-4">
        Exacte volumes, posities en concurrentiecijfers komen uit Semrush wanneer beschikbaar. Als die limiet bereikt is, gebruikt HappyBeez eigen audits,
        AI-keywordplanning en opgeslagen historie zodat je alsnog kunt doorwerken.
      </p>
    </div>
  );
}

/* ───────────── helpers & subcomponents ───────────── */

function fmtNum(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function scoreColor(s: number | null): string {
  if (s == null) return "text-muted-foreground";
  if (s >= 80) return "text-green-700";
  if (s >= 60) return "text-honey";
  return "text-destructive";
}

function positionBadge(pos: number | null): React.ReactNode {
  if (pos == null) return <span className="text-muted-foreground text-xs">niet in top-20</span>;
  const cls =
    pos <= 3 ? "bg-green-100 text-green-800" : pos <= 10 ? "bg-honey/30 text-ink" : "bg-secondary text-muted-foreground";
  return <span className={`tabular-nums text-xs px-2 py-0.5 rounded font-semibold ${cls}`}>#{pos}</span>;
}

function kdBadge(kd: number | null | undefined): React.ReactNode {
  if (kd == null) return <span className="text-muted-foreground">—</span>;
  const v = Math.round(kd);
  const cls = v < 30 ? "text-green-700" : v < 60 ? "text-honey" : "text-destructive";
  return <span className={`tabular-nums ${cls}`}>{v}</span>;
}

function StatCard({
  icon: Icon,
  label,
  value,
  accent,
  delta,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  accent?: "green";
  delta?: { value: number; positive: boolean } | null;
}) {
  const ring = accent === "green" ? "bg-green-100 text-green-800" : "bg-wine/10 text-wine";
  return (
    <div className="bg-card border border-border rounded-lg p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className={`h-10 w-10 rounded-md flex items-center justify-center ${ring}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground truncate">{label}</p>
          <p className="font-heading text-2xl font-semibold text-ink tabular-nums">{value}</p>
          {delta ? (
            <p className={`text-xs tabular-nums mt-0.5 ${delta.positive ? "text-green-700" : "text-destructive"}`}>
              {delta.positive ? "▲" : "▼"} {fmtNum(Math.abs(delta.value))} vs vorige
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function deltaFor(
  snaps: Snapshot[],
  field: "rank_global" | "organic_keywords" | "organic_traffic" | "organic_cost",
  lowerIsBetter = false,
): { value: number; positive: boolean } | null {
  if (snaps.length < 2) return null;
  const cur = Number(snaps[0][field] ?? 0);
  const prev = Number(snaps[1][field] ?? 0);
  if (!cur && !prev) return null;
  const diff = cur - prev;
  if (diff === 0) return null;
  const positive = lowerIsBetter ? diff < 0 : diff > 0;
  return { value: diff, positive };
}


function Section({
  title,
  subtitle,
  icon: Icon,
  children,
}: {
  title: string;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-card border border-border rounded-lg p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="font-heading text-lg font-semibold text-ink flex items-center gap-2">
          <Icon className="h-4 w-4 text-gold" /> {title}
        </h2>
        {subtitle ? <p className="text-sm text-muted-foreground mt-1">{subtitle}</p> : null}
      </div>
      {children}
    </section>
  );
}

function KeywordTable({ rows, highlight }: { rows: TopKw[]; highlight?: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
            <th className="py-2 pr-4">Keyword</th>
            <th className="py-2 pr-4 text-right">Positie</th>
            <th className="py-2 pr-4 text-right">Volume</th>
            <th className="py-2 pr-4 text-right">KD</th>
            <th className="py-2 pr-4 text-right">CPC</th>
            <th className="py-2 pr-4">Rankende URL</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((r, i) => (
            <tr key={`${r.keyword}-${i}`} className={highlight ? "bg-honey/5 hover:bg-honey/15" : "hover:bg-secondary/30"}>
              <td className="py-2 pr-4 font-medium text-ink">{r.keyword}</td>
              <td className="py-2 pr-4 text-right">{positionBadge(r.position)}</td>
              <td className="py-2 pr-4 text-right tabular-nums">{fmtNum(r.volume)}</td>
              <td className="py-2 pr-4 text-right tabular-nums">{kdBadge(r.kd)}</td>
              <td className="py-2 pr-4 text-right tabular-nums">{r.cpc ? `€${r.cpc.toFixed(2)}` : "—"}</td>
              <td className="py-2 pr-4 text-xs text-muted-foreground max-w-[20rem] truncate">
                {r.url ? (
                  <a href={r.url} target="_blank" rel="noreferrer" className="hover:text-wine">
                    {r.url}
                  </a>
                ) : (
                  "—"
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AuditView({ audit }: { audit: Audit }) {
  const issues = (audit.issues ?? []) as string[];
  const recs = (audit.recommendations ?? []) as string[];
  return (
    <>
      <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <a href={audit.url} target="_blank" rel="noreferrer" className="text-xs text-wine inline-flex items-center gap-1 hover:underline">
              {audit.url} <ExternalLink className="h-3 w-3" />
            </a>
            <h3 className="font-heading text-xl text-ink mt-1 truncate">{audit.title ?? "—"}</h3>
            <p className="text-sm text-muted-foreground mt-1">{audit.meta_description ?? "Geen meta description"}</p>
          </div>
          <div className="text-center shrink-0">
            <div className={`text-5xl font-heading font-bold tabular-nums ${scoreColor(audit.score)}`}>{audit.score ?? "—"}</div>
            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground mt-1">SEO-score</div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4 mt-6 text-sm">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">H1</p>
            <p className="font-medium text-ink truncate">{audit.h1 ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Woorden</p>
            <p className="font-medium text-ink tabular-nums">{audit.word_count ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Doel-keyword</p>
            <p className="font-medium text-ink">{audit.target_keyword ?? "—"}</p>
          </div>
        </div>
      </div>

      {audit.ai_summary ? (
        <div className="bg-honey/10 border border-honey/40 rounded-lg p-5">
          <h4 className="font-heading text-base text-ink flex items-center gap-2 mb-2">
            <Sparkles className="h-4 w-4 text-gold" /> AI-analyse
          </h4>
          <p className="text-sm text-foreground/85 whitespace-pre-line">{audit.ai_summary}</p>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="bg-card border border-border rounded-lg p-5">
          <h4 className="font-heading text-base text-ink flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-destructive" /> Problemen ({issues.length})
          </h4>
          {issues.length === 0 ? (
            <p className="text-sm text-muted-foreground inline-flex items-center gap-1">
              <CheckCircle2 className="h-4 w-4 text-green-700" /> Geen problemen gevonden — keurig.
            </p>
          ) : (
            <ul className="space-y-2 text-sm">
              {issues.map((it, i) => (
                <li key={i} className="flex items-start gap-2">
                  <TrendingDown className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                  <span>{it}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="bg-card border border-border rounded-lg p-5">
          <h4 className="font-heading text-base text-ink flex items-center gap-2 mb-3">
            <Lightbulb className="h-4 w-4 text-gold" /> Aanbevelingen ({recs.length})
          </h4>
          {recs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Niets specifieks te verbeteren.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {recs.map((r, i) => (
                <li key={i} className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-700 mt-0.5 shrink-0" />
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
