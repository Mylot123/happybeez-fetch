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
import { analyzeDomain, auditPage, discoverRankedKeywords, researchKeyword, trackKeywordScrape } from "@/lib/seo.functions";
import {
  addSeoCompetitor,
  bulkAddSeoKeywords,
  deleteSeoKeywords,
  enrichSeoKeywords,
  listSeoCompetitors,
  refreshDfsRankings,
  removeSeoCompetitor,
  researchDfsKeywords,
  toggleSeoKeyword,
} from "@/lib/dataforseo.functions";

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
type SeoAction = { priority: "hoog" | "midden" | "laag"; action: string; why: string; where: string };
type SeoPageAudit = { title: string | null; meta_description: string | null; h1: string | null; word_count: number; issues: string[] };
type ExtendedSnapshot = Omit<Snapshot, "ai_actions" | "content_gaps" | "page_audit" | "soft_error"> & {
  ai_actions: SeoAction[];
  content_gaps: string[];
  page_audit: SeoPageAudit | null;
  soft_error: string | null;
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
  { id: "overview", label: "Dashboard", icon: Globe },
  { id: "tracking", label: "Keywords", icon: Target },
  { id: "ranglijst", label: "Rankings", icon: Trophy },
  { id: "research", label: "Research", icon: Lightbulb },
  { id: "audit", label: "On-page", icon: FileSearch },
  { id: "competitors", label: "Concurrenten", icon: Compass },
  { id: "backlinks", label: "Backlinks", icon: ExternalLink },
  { id: "settings", label: "Instellingen", icon: Crosshair },
] as const;
type TabId = (typeof TABS)[number]["id"];

function Seo() {
  const { user } = useAuth();
  const [tab, setTab] = useState<TabId>("overview");

  // Domain & snapshot
  const [domain, setDomain] = useState("happybeez.nl");
  const [database, setDatabase] = useState("nl");
  const [snapshot, setSnapshot] = useState<ExtendedSnapshot | null>(null);
  const [snapshots, setSnapshots] = useState<ExtendedSnapshot[]>([]);
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
  const [bulkKw, setBulkKw] = useState("");
  const [enriching, setEnriching] = useState(false);
  const [selectedKwIds, setSelectedKwIds] = useState<Set<string>>(new Set());
  const [rankFilter, setRankFilter] = useState<"all" | "top3" | "top10" | "top100" | "none">("all");

  // Audit
  const [audits, setAudits] = useState<Audit[]>([]);
  const [auditUrl, setAuditUrl] = useState("https://happybeez.nl");
  const [auditGoal, setAuditGoal] = useState("organisch verkeer & verkopen");
  const [auditKw, setAuditKw] = useState("bijenhotel");
  const [auditing, setAuditing] = useState(false);
  const [activeAudit, setActiveAudit] = useState<Audit | null>(null);

  // Ranglijst (organic ranked keywords for domain)
  type RankedRow = {
    keyword: string;
    rank: number | null;
    previous_rank: number | null;
    search_volume: number | null;
    cpc: number | null;
    competition: number | null;
    traffic_share: number | null;
    url: string | null;
  };
  const [ranked, setRanked] = useState<RankedRow[]>([]);
  const [rankedCheckedAt, setRankedCheckedAt] = useState<string | null>(null);
  const [rankedLoading, setRankedLoading] = useState(false);
  const [rankedFilter, setRankedFilter] = useState<"all" | "top3" | "top10" | "p11_20" | "p21" | "quickwins">("all");
  const [rankedSort, setRankedSort] = useState<"rank" | "volume" | "delta">("rank");

  // DataForSEO: tracked competitors & competitor rank history
  type CompetitorRow = { id: string; competitor_domain: string; label: string | null; database_code: string; own_domain: string };
  type CompetitorHistRow = { keyword: string; competitor_domain: string; rank: number | null; checked_at: string };
  const [dfsCompetitors, setDfsCompetitors] = useState<CompetitorRow[]>([]);
  const [dfsCompHist, setDfsCompHist] = useState<CompetitorHistRow[]>([]);
  const [newCompetitor, setNewCompetitor] = useState("");
  const [newCompetitorLabel, setNewCompetitorLabel] = useState("");
  const [dfsBusy, setDfsBusy] = useState(false);
  const [dfsRefreshing, setDfsRefreshing] = useState(false);

  useEffect(() => {
    void loadAll();
  }, []);

  useEffect(() => {
    if (!domain) return;
    void loadCompetitors();
  }, [domain, database]);

  async function loadAll() {
    setLoadingSnap(true);
    const [snaps, kws, aud, hist, ch] = await Promise.all([
      supabase.from("seo_domain_snapshots").select("*").order("created_at", { ascending: false }).limit(30),
      supabase.from("seo_keywords").select("*").order("created_at", { ascending: false }),
      supabase.from("seo_page_audits").select("*").order("created_at", { ascending: false }).limit(10),
      supabase.from("seo_keyword_history").select("*").order("checked_at", { ascending: false }).limit(500),
      supabase.from("seo_competitor_history").select("keyword,competitor_domain,rank,checked_at").order("checked_at", { ascending: false }).limit(1000),
    ]);
    setLoadingSnap(false);
    const snapList = (snaps.data ?? []) as ExtendedSnapshot[];
    setSnapshots(snapList);
    if (snapList[0]) {
      setSnapshot(snapList[0]);
      setDomain(snapList[0].domain);
      setDatabase(snapList[0].database_code);
    }
    setTracked((kws.data ?? []) as SeoRow[]);
    setAudits((aud.data ?? []) as Audit[]);
    setHistory((hist.data ?? []) as KwHistory[]);
    setDfsCompHist((ch.data ?? []) as CompetitorHistRow[]);
  }

  async function loadCompetitors() {
    const own = domain.trim();
    if (own.length < 3) {
      setDfsCompetitors([]);
      return;
    }
    try {
      const rows = await listSeoCompetitors({ data: { own_domain: own, database } });
      setDfsCompetitors(rows as CompetitorRow[]);
    } catch {
      setDfsCompetitors([]);
    }
  }


  async function addCompetitor() {
    if (!newCompetitor.trim()) return toast.error("Vul een concurrent-domein in.");
    setDfsBusy(true);
    try {
      await addSeoCompetitor({
        data: {
          own_domain: domain.trim(),
          competitor_domain: newCompetitor.trim(),
          label: newCompetitorLabel.trim() || undefined,
          database,
        },
      });
      setNewCompetitor("");
      setNewCompetitorLabel("");
      await loadCompetitors();
      toast.success("Concurrent toegevoegd.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Toevoegen mislukt.");
    } finally {
      setDfsBusy(false);
    }
  }

  async function delCompetitor(id: string) {
    try {
      await removeSeoCompetitor({ data: { id } });
      setDfsCompetitors((p) => p.filter((c) => c.id !== id));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Verwijderen mislukt.");
    }
  }

  async function refreshDfs() {
    setDfsRefreshing(true);
    try {
      const res = await refreshDfsRankings({ data: { own_domain: domain.trim(), database } });
      if (res.soft_error) toast.info(res.soft_error);
      else toast.success(`DataForSEO check: ${res.checked}/${res.keywords} keywords · ${res.own_found ?? 0} in top-100.`);
      await loadAll();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "DataForSEO refresh mislukt.");
    } finally {
      setDfsRefreshing(false);
    }
  }

  async function runDfsResearch() {
    if (seed.trim().length < 2) return toast.error("Vul een seed keyword in.");
    setResearching(true);
    try {
      const res = await researchDfsKeywords({ data: { seed: seed.trim(), database, limit: 30 } });
      if (res.soft_error) toast.info(res.soft_error);
      else {
        setIdeas(res.ideas as Idea[]);
        toast.success(`${res.ideas.length} DataForSEO ideeën gevonden.`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Research mislukt.");
    } finally {
      setResearching(false);
    }
  }


  async function runAnalyze() {
    if (!domain.trim()) return toast.error("Vul een domein in.");
    setAnalyzing(true);
    try {
      const data = await analyzeDomain({ data: { domain: domain.trim(), database, skip_semrush: skipSemrush } });
      const freshSnapshot = data as unknown as ExtendedSnapshot;
      if (freshSnapshot.id) {
        setSnapshot(freshSnapshot);
        setSnapshots((prev) => [freshSnapshot, ...prev.filter((s) => s.id !== freshSnapshot.id)].slice(0, 30));
      }
      if (data.soft_error) {
        toast.info(data.soft_error);
        autoDisableOnLimit(data.soft_error);
        void loadAll();
      } else {
        toast.success(`Analyse klaar — ${data.organic_keywords ?? 0} organische keywords gevonden.`);
        void loadAll();
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
      const data = await researchKeyword({ data: { seed: term, database, limit: 20, skip_semrush: skipSemrush } });
      setIdeas(data.ideas as Idea[]);
      if (data.soft_error) {
        toast.info(data.soft_error);
        autoDisableOnLimit(data.soft_error);
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
      const result = await trackKeywordScrape({ data: { keyword, domain: domain.trim(), database } });
      if (result.soft_error) { toast.info(result.soft_error); autoDisableOnLimit(result.soft_error); }
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
      const result = await trackKeywordScrape({ data: { keyword: row.keyword, domain: row.domain, database: row.database_code ?? "nl" } });
      const [{ data }, { data: h }] = await Promise.all([
        supabase.from("seo_keywords").select("*").order("created_at", { ascending: false }),
        supabase.from("seo_keyword_history").select("*").order("checked_at", { ascending: false }).limit(500),
      ]);
      setTracked((data ?? []) as SeoRow[]);
      setHistory((h ?? []) as KwHistory[]);
      if (result.soft_error) { toast.info(result.soft_error); autoDisableOnLimit(result.soft_error); }
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
    setSelectedKwIds((prev) => {
      const n = new Set(prev);
      n.delete(id);
      return n;
    });
  }

  async function bulkDeleteTracked() {
    if (selectedKwIds.size === 0) return;
    const ids = Array.from(selectedKwIds);
    try {
      await deleteSeoKeywords({ data: { ids } });
      setTracked((p) => p.filter((x) => !selectedKwIds.has(x.id)));
      setSelectedKwIds(new Set());
      toast.success(`${ids.length} keywords verwijderd.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Verwijderen mislukt.");
    }
  }

  async function addBulkKeywords() {
    const list = bulkKw.split(/[\n,]+/).map((s) => s.trim()).filter((s) => s.length >= 2);
    if (!list.length) return toast.error("Plak of typ minimaal één keyword.");
    if (!domain.trim()) return toast.error("Vul eerst een domein in.");
    setTrackingBusy(true);
    try {
      const res = await bulkAddSeoKeywords({ data: { keywords: list, domain: domain.trim(), database } });
      toast.success(`${res.added} nieuwe keywords toegevoegd${res.skipped ? ` (${res.skipped} bestonden al)` : ""}.`);
      setBulkKw("");
      const { data } = await supabase.from("seo_keywords").select("*").order("created_at", { ascending: false });
      setTracked((data ?? []) as SeoRow[]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Bulk toevoegen mislukt.");
    } finally {
      setTrackingBusy(false);
    }
  }

  async function enrichAll() {
    if (!domain.trim()) return toast.error("Vul een domein in.");
    setEnriching(true);
    try {
      const res = await enrichSeoKeywords({ data: { domain: domain.trim(), database } });
      if (res.soft_error) toast.info(res.soft_error);
      else toast.success(`${res.enriched} keywords verrijkt.`);
      const { data } = await supabase.from("seo_keywords").select("*").order("created_at", { ascending: false });
      setTracked((data ?? []) as SeoRow[]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Verrijken mislukt.");
    } finally {
      setEnriching(false);
    }
  }

  async function toggleKeywordActive(row: SeoRow) {
    const next = !((row as SeoRow & { is_active?: boolean }).is_active ?? true);
    setTracked((p) => p.map((x) => (x.id === row.id ? { ...x, is_active: next } : x)));
    try {
      await toggleSeoKeyword({ data: { id: row.id, is_active: next } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Aan/uit mislukt.");
      setTracked((p) => p.map((x) => (x.id === row.id ? { ...x, is_active: !next } : x)));
    }
  }

  function exportRankingsCsv() {
    const rows = tracked.filter((r) => (r as SeoRow & { is_active?: boolean }).is_active !== false);
    const header = ["keyword", "volume", "positie", "url", "laatst_gemeten"];
    const body = rows.map((r) => [
      r.keyword,
      r.search_volume ?? "",
      r.current_rank ?? "",
      r.position_url ?? "",
      r.last_checked_at ?? "",
    ]);
    const csv = [header, ...body].map((cols) => cols.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rankings-${domain}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
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

  async function runRanked() {
    if (!domain.trim()) return toast.error("Vul een domein in.");
    setRankedLoading(true);
    try {
      const res = await discoverRankedKeywords({ data: { domain: domain.trim(), database, limit: 20 } });
      setRanked(res.rows.map((r) => ({ ...r, search_volume: null, cpc: null, competition: null, traffic_share: null })) as RankedRow[]);
      setRankedCheckedAt(res.checked_at);
      toast.success(`AI-agent checkte ${res.stats.total} keywords · ${res.stats.found} ranken in top 30.`);
      const { data: h } = await supabase.from("seo_keyword_history").select("*").order("checked_at", { ascending: false }).limit(2000);
      setHistory((h ?? []) as KwHistory[]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ranglijst ophalen mislukt.");
    } finally {
      setRankedLoading(false);
    }
  }



  const topKws = (snapshot?.top_keywords ?? []) as TopKw[];
  const quickWins = (snapshot?.quick_wins ?? []) as TopKw[];
  const competitors = (snapshot?.competitors ?? []) as Competitor[];
  const fallbackPlan = useMemo(() => buildFallbackSeoPlan(domain, topKws), [domain, topKws]);
  const storedActions = snapshot?.ai_actions ?? [];
  const storedGaps = snapshot?.content_gaps ?? [];
  const aiActions = storedActions.length ? storedActions : fallbackPlan.actions;
  const contentGaps = storedGaps.length ? storedGaps : fallbackPlan.contentGaps;
  const pageAudit = snapshot?.page_audit ?? null;
  const analysisSource = storedActions.length || pageAudit ? "live" : "fallback";
  const hasMetricData = snapshot ? [snapshot.rank_global, snapshot.organic_traffic, snapshot.organic_cost].some((value) => value != null) : false;
  const hasHistoryMetricData = snapshots.some((s) => [s.rank_global, s.organic_traffic, s.organic_cost].some((value) => value != null));

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
            SEO-engine met eigen pagina-audits, AI-keywordstrategie en DataForSEO-rankings — dagelijks up-to-date.
          </p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        {/* Sub-sidebar */}
        <aside className="md:w-56 shrink-0">
          <nav className="bg-card border border-border rounded-lg p-2 md:sticky md:top-4 flex md:flex-col gap-1 overflow-x-auto">
            {TABS.map((t) => {
              const Icon = t.icon;
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm text-left whitespace-nowrap transition-colors ${
                    active ? "bg-wine/10 text-wine font-medium" : "text-muted-foreground hover:text-ink hover:bg-muted/50"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Main content */}
        <div className="min-w-0 flex-1">
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
              {hasMetricData ? (
                <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
                  <StatCard icon={Trophy} label="Globale rank" value={fmtNum(snapshot.rank_global)} delta={deltaFor(snapshots, "rank_global", true)} />
                  <StatCard icon={Search} label="Organische keywords" value={fmtNum(snapshot.organic_keywords)} delta={deltaFor(snapshots, "organic_keywords")} />
                  <StatCard icon={TrendingUp} label="Organisch verkeer (mnd)" value={fmtNum(snapshot.organic_traffic)} delta={deltaFor(snapshots, "organic_traffic")} />
                  <StatCard icon={Target} label="Verkeerwaarde" value={`€${fmtNum(snapshot.organic_cost)}`} delta={deltaFor(snapshots, "organic_cost")} />
                </div>
              ) : (
                <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
                  <StatCard icon={CheckCircle2} label="SEO-plan" value="Actief" accent="green" />
                  <StatCard icon={Lightbulb} label="Actiepunten" value={String(aiActions.length)} />
                  <StatCard icon={TrendingUp} label="Contentkansen" value={String(contentGaps.length)} />
                  <StatCard icon={Search} label="Keywordfocus" value={fmtNum(snapshot.organic_keywords)} />
                </div>
              )}

              <div className="rounded-lg border border-wine/20 bg-wine/5 p-4 text-sm text-foreground/85 flex items-start gap-3">
                <Sparkles className="h-5 w-5 text-wine mt-0.5 shrink-0" />
                <div>
                  <p className="font-heading font-semibold text-ink">SEO-analyse actief</p>
                  <p className="mt-1">
                    {analysisSource === "live"
                      ? "Deze analyse bevat live site-audit en AI-actiepunten van de laatste vernieuwing."
                      : "Engine toont een praktisch HappyBeez SEO-plan op basis van je domein en relevante bijenhotel-keywords."}
                  </p>
                </div>
              </div>

              {snapshots.length > 1 && hasHistoryMetricData ? (
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
              ) : snapshots.length > 1 ? (
                <Section title="Analysehistorie" subtitle={`${snapshots.length} analyses bewaard — externe rankingdata was beperkt, daarom vergelijken we de inhoudelijke SEO-output.`} icon={TrendingUp}>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {snapshots.slice(0, 6).map((s) => (
                      <div key={s.id} className="border border-border rounded-md p-3 bg-card text-sm">
                        <p className="text-xs text-muted-foreground">{new Date(s.created_at).toLocaleString("nl-NL")}</p>
                        <p className="font-medium text-ink mt-1">{(s.ai_actions?.length ?? 0) || fallbackPlan.actions.length} actiepunten</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{(s.content_gaps?.length ?? 0) || fallbackPlan.contentGaps.length} contentkansen · {fmtNum(s.organic_keywords)} keywordfocus</p>
                      </div>
                    ))}
                  </div>
                </Section>
              ) : null}



              {aiActions.length > 0 ? (
                <Section title="Concrete actiepunten" subtitle={analysisSource === "live" ? "AI-prioritering op basis van je eigen homepage + keyword-doelen." : "Direct toepasbaar SEO-plan voor HappyBeez wanneer externe rankingdata leeg blijft."} icon={Lightbulb}>
                  <ol className="space-y-3">
                    {aiActions.map((a, i) => {
                      const tone = a.priority === "hoog" ? "bg-wine/10 text-wine border-wine/30" : a.priority === "midden" ? "bg-amber-100 text-amber-800 border-amber-300" : "bg-secondary text-muted-foreground border-border";
                      return (
                        <li key={i} className="border border-border rounded-md p-3 bg-card">
                          <div className="flex items-start gap-3">
                            <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border ${tone}`}>{a.priority}</span>
                            <div className="flex-1">
                              <p className="font-medium text-ink text-sm">{a.action}</p>
                              <p className="text-xs text-muted-foreground mt-1"><span className="font-medium text-ink">Waarom:</span> {a.why}</p>
                              <p className="text-xs text-muted-foreground mt-0.5"><span className="font-medium text-ink">Waar:</span> {a.where}</p>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                </Section>
              ) : null}

              {pageAudit ? (
                <Section title="Homepage-audit" subtitle="Wat we direct van je homepage konden lezen." icon={Search}>
                  <div className="grid sm:grid-cols-2 gap-3 text-sm">
                    <div className="border border-border rounded-md p-3 bg-card">
                      <div className="text-xs text-muted-foreground uppercase tracking-wider">Title</div>
                      <div className="text-ink mt-1">{pageAudit.title ?? "—"}</div>
                    </div>
                    <div className="border border-border rounded-md p-3 bg-card">
                      <div className="text-xs text-muted-foreground uppercase tracking-wider">Meta description</div>
                      <div className="text-ink mt-1">{pageAudit.meta_description ?? "—"}</div>
                    </div>
                    <div className="border border-border rounded-md p-3 bg-card">
                      <div className="text-xs text-muted-foreground uppercase tracking-wider">H1</div>
                      <div className="text-ink mt-1">{pageAudit.h1 ?? "—"}</div>
                    </div>
                    <div className="border border-border rounded-md p-3 bg-card">
                      <div className="text-xs text-muted-foreground uppercase tracking-wider">Woorden</div>
                      <div className="text-ink mt-1">{pageAudit.word_count}</div>
                    </div>
                  </div>
                  {pageAudit.issues.length > 0 ? (
                    <ul className="mt-4 space-y-1.5 text-sm">
                      {pageAudit.issues.map((iss, i) => (
                        <li key={i} className="flex gap-2 text-ink"><span className="text-wine">•</span>{iss}</li>
                      ))}
                    </ul>
                  ) : <p className="text-sm text-muted-foreground mt-3">Geen kritieke on-page problemen gevonden.</p>}
                </Section>
              ) : null}

              {contentGaps.length > 0 ? (
                <Section title="Content-gaten — blogonderwerpen om te schrijven" subtitle="Onderwerpen waar zoekvraag bestaat en je nu nog niet over publiceert." icon={TrendingUp}>
                  <ul className="grid sm:grid-cols-2 gap-2 text-sm">
                    {contentGaps.map((g, i) => (
                      <li key={i} className="border border-border rounded-md p-3 bg-card text-ink">{g}</li>
                    ))}
                  </ul>
                </Section>
              ) : null}

              {quickWins.length > 0 ? (
                <Section title="Quick wins" subtitle="Keywords op positie 4–20 met goed volume — kleine optimalisatie kan ze de top-3 in duwen." icon={Lightbulb}>
                  <KeywordTable rows={quickWins} highlight />
                </Section>
              ) : null}





              <Section title="Top organische keywords" subtitle="Waar je nu al op rankt." icon={TrendingUp}>
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

      {/* ──────────────── Ranglijst ──────────────── */}
      {tab === "ranglijst" ? (
        <div className="space-y-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h2 className="font-heading text-2xl text-ink">Rankings</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Live posities op Google.{database} (mobile).
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={exportRankingsCsv} disabled={tracked.length === 0}>
                <ExternalLink className="h-4 w-4" /> Export CSV
              </Button>
              <Button onClick={() => void refreshDfs()} disabled={dfsRefreshing} className="bg-wine text-white hover:bg-wine/90">
                {dfsRefreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Refresh nu
              </Button>
            </div>
          </div>

          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            <StatCard icon={Crosshair} label="Actieve keywords" value={String(tracked.filter((r) => (r as SeoRow & { is_active?: boolean }).is_active !== false).length)} />
            <StatCard icon={Trophy} label="In top 10" value={String(trackedStats.top10)} accent="green" />
            <StatCard icon={Target} label="In top 100" value={String(tracked.filter((t) => (t.current_rank ?? 999) <= 100).length)} />
            <StatCard
              icon={RefreshCw}
              label="Laatste refresh"
              value={
                tracked.reduce((max, r) => {
                  const ts = r.last_checked_at ? +new Date(r.last_checked_at) : 0;
                  return ts > max ? ts : max;
                }, 0)
                  ? new Date(
                      tracked.reduce((max, r) => {
                        const ts = r.last_checked_at ? +new Date(r.last_checked_at) : 0;
                        return ts > max ? ts : max;
                      }, 0),
                    ).toLocaleString("nl-NL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
                  : "—"
              }
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {([
              { id: "all", label: "Alle" },
              { id: "top3", label: "Top 3" },
              { id: "top10", label: "Top 10" },
              { id: "top100", label: "Top 100" },
              { id: "none", label: "Niet rankend" },
            ] as const).map((f) => (
              <button
                key={f.id}
                onClick={() => setRankFilter(f.id)}
                className={`text-sm px-3 py-1.5 rounded-md transition-colors ${
                  rankFilter === f.id ? "bg-ink text-white" : "bg-card border border-border text-muted-foreground hover:bg-secondary/40"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="rounded-xl border border-border bg-card overflow-hidden">
            {(() => {
              const rows = tracked
                .filter((r) => (r as SeoRow & { is_active?: boolean }).is_active !== false)
                .filter((r) => {
                  const p = r.current_rank;
                  if (rankFilter === "top3") return p != null && p <= 3;
                  if (rankFilter === "top10") return p != null && p <= 10;
                  if (rankFilter === "top100") return p != null && p <= 100;
                  if (rankFilter === "none") return p == null;
                  return true;
                });
              if (rows.length === 0) {
                return <p className="p-8 text-sm text-muted-foreground text-center">Geen keywords in dit filter.</p>;
              }
              return (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40">
                      <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                        <th className="py-3 pl-4 pr-4">Keyword</th>
                        <th className="py-3 pr-4 text-right">Volume</th>
                        <th className="py-3 pr-4">Positie</th>
                        <th className="py-3 pr-4 text-right">Verandering</th>
                        <th className="py-3 pr-4">Rankt op</th>
                        <th className="py-3 pr-4">Laatst gemeten</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {rows.map((row) => {
                        const hist = history
                          .filter((h) => h.keyword === row.keyword && h.domain === row.domain)
                          .sort((a, b) => +new Date(b.checked_at) - +new Date(a.checked_at));
                        const prev = hist[1];
                        const rankDelta =
                          prev?.rank != null && row.current_rank != null ? prev.rank - row.current_rank : null;
                        return (
                          <tr key={row.id} className="hover:bg-secondary/30">
                            <td className="py-2 pl-4 pr-4 font-medium text-ink">{row.keyword}</td>
                            <td className="py-2 pr-4 text-right tabular-nums">{fmtNum(row.search_volume)}</td>
                            <td className="py-2 pr-4">
                              {row.current_rank != null ? (
                                positionBadge(row.current_rank)
                              ) : row.last_checked_at ? (
                                <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">Niet rankend</span>
                              ) : (
                                <span className="text-xs px-2 py-0.5 rounded bg-secondary text-muted-foreground">Nog niet gemeten</span>
                              )}
                            </td>
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
                            </td>
                            <td className="py-2 pr-4 text-xs text-muted-foreground max-w-[20rem] truncate">
                              {row.position_url ? (
                                <a href={row.position_url} target="_blank" rel="noreferrer" className="hover:text-wine">
                                  {row.position_url.replace(/^https?:\/\//, "")}
                                </a>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td className="py-2 pr-4 text-xs text-muted-foreground">
                              {row.last_checked_at
                                ? new Date(row.last_checked_at).toLocaleString("nl-NL", {
                                    day: "numeric",
                                    month: "numeric",
                                    year: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })
                                : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </div>
        </div>
      ) : null}

      {/* ──────────────── Research ──────────────── */}
      {tab === "research" ? (
        <div className="space-y-6">
          <Section title="Keyword-onderzoek" subtitle="Vind koopkeywords, vragen en blogonderwerpen met echte volumes via DataForSEO." icon={Lightbulb}>
            <div className="flex flex-wrap gap-2 mb-4">
              <Input
                value={seed}
                onChange={(e) => setSeed(e.target.value)}
                placeholder="bv. bijenhotel, wilde bijen, insectenhotel…"
                onKeyDown={(e) => {
                  if (e.key === "Enter") void runDfsResearch();
                }}
                className="flex-1 min-w-[14rem]"
              />
              <Button onClick={() => void runDfsResearch()} disabled={researching} className="bg-wine text-white hover:bg-wine/90">
                {researching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} DataForSEO
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
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h2 className="font-heading text-2xl text-ink">Keywords</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Voeg keywords toe — volume, CPC en intent worden automatisch verrijkt via DataForSEO.
              </p>
            </div>
            <div className="flex gap-2">
              {selectedKwIds.size > 0 ? (
                <Button variant="outline" onClick={() => void bulkDeleteTracked()} className="border-destructive/40 text-destructive">
                  <Trash2 className="h-4 w-4" /> Verwijder {selectedKwIds.size}
                </Button>
              ) : null}
              <Button onClick={() => void enrichAll()} disabled={enriching} variant="outline" className="border-wine text-wine">
                {enriching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Verrijk alle
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <textarea
              value={bulkKw}
              onChange={(e) => setBulkKw(e.target.value)}
              placeholder={"Plak keywords, één per regel\nbv.:\nbijenhotel kopen\nwilde bijen huis\ninsectenhotel groot"}
              className="w-full min-h-[9rem] rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-wine"
            />
            <div className="flex justify-end">
              <Button
                onClick={() => void addBulkKeywords()}
                disabled={trackingBusy || bulkKw.trim().length === 0}
                className="bg-wine text-white hover:bg-wine/90"
              >
                {trackingBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crosshair className="h-4 w-4" />}{" "}
                Voeg {bulkKw.split(/[\n,]+/).map((s) => s.trim()).filter((s) => s.length >= 2).length} keywords toe
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card overflow-hidden">
            {tracked.length === 0 ? (
              <p className="p-8 text-sm text-muted-foreground text-center">
                Nog geen keywords. Plak een lijstje hierboven of "volg" een idee uit Research.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40">
                    <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                      <th className="py-3 pl-4 pr-2 w-8">
                        <input
                          type="checkbox"
                          checked={selectedKwIds.size > 0 && selectedKwIds.size === tracked.length}
                          onChange={(e) =>
                            setSelectedKwIds(e.target.checked ? new Set(tracked.map((t) => t.id)) : new Set())
                          }
                          className="h-4 w-4 accent-wine"
                        />
                      </th>
                      <th className="py-3 pr-4">Keyword</th>
                      <th className="py-3 pr-4 text-right">Volume</th>
                      <th className="py-3 pr-4 text-right">CPC</th>
                      <th className="py-3 pr-4">Intent</th>
                      <th className="py-3 pr-4 text-right">Positie</th>
                      <th className="py-3 pr-4 text-center">Actief</th>
                      <th className="py-3 pr-4">Toegevoegd</th>
                      <th className="py-3 pr-4 text-right">Acties</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {tracked.map((row) => {
                      const rowExt = row as SeoRow & { is_active?: boolean };
                      const active = rowExt.is_active !== false;
                      const checked = selectedKwIds.has(row.id);
                      return (
                        <tr key={row.id} className="hover:bg-secondary/30">
                          <td className="py-2 pl-4 pr-2">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) =>
                                setSelectedKwIds((prev) => {
                                  const n = new Set(prev);
                                  if (e.target.checked) n.add(row.id);
                                  else n.delete(row.id);
                                  return n;
                                })
                              }
                              className="h-4 w-4 accent-wine"
                            />
                          </td>
                          <td className="py-2 pr-4 font-medium text-ink">{row.keyword}</td>
                          <td className="py-2 pr-4 text-right tabular-nums">{fmtNum(row.search_volume)}</td>
                          <td className="py-2 pr-4 text-right tabular-nums">
                            {row.cpc != null ? `€${Number(row.cpc).toFixed(2)}` : "—"}
                          </td>
                          <td className="py-2 pr-4">{intentBadge(row.intent)}</td>
                          <td className="py-2 pr-4 text-right">{positionBadge(row.current_rank)}</td>
                          <td className="py-2 pr-4 text-center">
                            <button
                              onClick={() => void toggleKeywordActive(row)}
                              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                                active ? "bg-wine" : "bg-muted"
                              }`}
                              aria-label={active ? "Uitzetten" : "Aanzetten"}
                            >
                              <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                  active ? "translate-x-4" : "translate-x-0.5"
                                }`}
                              />
                            </button>
                          </td>
                          <td className="py-2 pr-4 text-xs text-muted-foreground">
                            {new Date(row.created_at).toLocaleDateString("nl-NL")}
                          </td>
                          <td className="py-2 pr-4 text-right">
                            <div className="inline-flex gap-2">
                              <button
                                onClick={() => void refreshKeyword(row)}
                                disabled={trackingBusy}
                                className="text-muted-foreground hover:text-wine"
                                title="Ververs positie"
                              >
                                <RefreshCw className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => void removeTracked(row.id)}
                                className="text-muted-foreground hover:text-destructive"
                                title="Verwijder"
                              >
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
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Snel toevoegen</p>
            <div className="flex flex-wrap gap-2">
              <Input
                value={newKw}
                onChange={(e) => setNewKw(e.target.value)}
                placeholder="Eén keyword toevoegen + direct rank checken"
                onKeyDown={(e) => {
                  if (e.key === "Enter") void addTracked(newKw);
                }}
                className="flex-1 min-w-[14rem]"
              />
              <Button onClick={() => void addTracked(newKw)} disabled={trackingBusy} className="bg-wine text-white hover:bg-wine/90">
                {trackingBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crosshair className="h-4 w-4" />} Voeg toe & check
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ──────────────── Audit ──────────────── */}
      {tab === "audit" ? (
        <div className="space-y-6">
          <div>
            <h2 className="font-heading text-2xl text-ink">On-page Audit</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Analyseer meta, content, techniek, snelheid en Core Web Vitals.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
              <Input
                value={auditUrl}
                onChange={(e) => setAuditUrl(e.target.value)}
                placeholder="https://voorbeeld.nl/pagina"
              />
              <Input
                value={auditKw}
                onChange={(e) => setAuditKw(e.target.value)}
                placeholder="Focus keyword"
              />
              <Button onClick={runAudit} disabled={auditing} className="bg-wine text-white hover:bg-wine/90">
                {auditing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Run audit
              </Button>
            </div>
          </div>

          {audits.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
              <Eye className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="font-heading text-lg text-ink">Nog geen audits</p>
              <p className="text-sm text-muted-foreground mt-1">
                Vul een URL + focus keyword in hierboven en klik Run audit.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {audits.map((a) => (
                <AuditCard key={a.id} audit={a} />
              ))}
            </div>
          )}
        </div>
      ) : null}

      {/* ──────────────── Competitors ──────────────── */}
      {tab === "competitors" ? (
        <div className="space-y-6">
          <Section title="Beheer concurrenten" subtitle="Volg de posities van je concurrenten op dezelfde keywords via DataForSEO." icon={Compass}>
            <div className="flex flex-wrap items-end gap-3 mb-4">
              <div className="flex-1 min-w-[14rem] space-y-1.5">
                <Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Concurrent domein</Label>
                <Input value={newCompetitor} onChange={(e) => setNewCompetitor(e.target.value)} placeholder="bijv. concurrent.nl" />
              </div>
              <div className="flex-1 min-w-[10rem] space-y-1.5">
                <Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Label (optioneel)</Label>
                <Input value={newCompetitorLabel} onChange={(e) => setNewCompetitorLabel(e.target.value)} placeholder="bijv. grootste speler" />
              </div>
              <Button onClick={addCompetitor} disabled={dfsBusy} className="bg-signal text-white hover:bg-signal/90">
                {dfsBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Toevoegen"}
              </Button>
              <Button variant="outline" onClick={refreshDfs} disabled={dfsRefreshing || dfsCompetitors.length === 0 && tracked.length === 0}>
                {dfsRefreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Ververs rankings
              </Button>
            </div>

            {dfsCompetitors.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nog geen concurrenten. Voeg er hierboven één toe om posities per keyword te vergelijken.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {dfsCompetitors.map((c) => (
                  <div key={c.id} className="border border-border rounded-lg p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-heading text-base text-ink truncate">{c.competitor_domain}</p>
                        {c.label ? <p className="text-xs text-muted-foreground mt-0.5">{c.label}</p> : null}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <a href={`https://${c.competitor_domain}`} target="_blank" rel="noreferrer" className="text-signal p-1">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                        <button onClick={() => delCompetitor(c.id)} className="text-muted-foreground hover:text-destructive p-1">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {dfsCompetitors.length > 0 && tracked.length > 0 ? (
            <Section title="Positie-matrix" subtitle="Laatste bekende ranking per keyword, jij vs concurrenten." icon={Trophy}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th className="py-2 pr-4 font-medium text-muted-foreground">Keyword</th>
                      <th className="py-2 px-2 font-medium text-ink">Jij</th>
                      {dfsCompetitors.map((c) => (
                        <th key={c.id} className="py-2 px-2 font-medium text-muted-foreground truncate max-w-[10rem]">{c.competitor_domain}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tracked.map((row) => {
                      const latestByComp: Record<string, number | null> = {};
                      for (const c of dfsCompetitors) {
                        const hit = dfsCompHist.find((h) => h.keyword === row.keyword && h.competitor_domain === c.competitor_domain);
                        latestByComp[c.competitor_domain] = hit?.rank ?? null;
                      }
                      return (
                        <tr key={row.id} className="border-b border-border/50">
                          <td className="py-2 pr-4">{row.keyword}</td>
                          <td className="py-2 px-2">{positionBadge(row.current_rank)}</td>
                          {dfsCompetitors.map((c) => (
                            <td key={c.id} className="py-2 px-2">{positionBadge(latestByComp[c.competitor_domain])}</td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                Positie = laatste check. Klik op "Ververs rankings" of laat de dagelijkse cron alle keywords bijhouden.
              </p>
            </Section>
          ) : null}

          {competitors.length > 0 ? (
            <Section title="Concurrent-suggesties" subtitle="Domeinen die op dezelfde keywords ranken." icon={Compass}>
              <div className="grid gap-3 sm:grid-cols-2">
                {competitors.map((c) => (
                  <div key={c.domain} className="border border-border rounded-lg p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-heading text-base text-ink">{c.domain}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{fmtNum(c.common_keywords)} gedeelde keywords · {fmtNum(c.organic_traffic)} verkeer</p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setNewCompetitor(c.domain);
                          void addCompetitor();
                        }}
                      >
                        Volg
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          ) : null}
        </div>
      ) : null}


      {/* ──────────────── Backlinks ──────────────── */}
      {tab === "backlinks" ? (
        <div className="bg-card border border-dashed border-border rounded-lg p-10 text-center">
          <ExternalLink className="h-8 w-8 text-muted-foreground/60 mx-auto mb-3" />
          <p className="font-medium text-ink">Backlinks — binnenkort</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
            Overzicht van verwijzende domeinen, anker-teksten en autoriteit via DataForSEO. Deze module wordt in een volgende stap ingeschakeld.
          </p>
        </div>
      ) : null}

      {/* ──────────────── Instellingen ──────────────── */}
      {tab === "settings" ? (
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-card p-4 text-sm text-foreground/80">
            <p className="font-medium text-ink mb-1">Rank-tracking cadans</p>
            <p className="text-muted-foreground">
              De dagelijkse DataForSEO-verversing draait via <code className="text-xs bg-muted px-1.5 py-0.5 rounded">/api/public/cron/seo-tracking</code>. Activeer een pg_cron-job om dit dagelijks te triggeren.
            </p>
          </div>
        </div>
      ) : null}

          <p className="mt-8 text-xs text-muted-foreground border-t border-border pt-4">
            Exacte volumes, posities en concurrentiecijfers komen uit DataForSEO. AI vult aan met keywordplanning en actiepunten.
          </p>
        </div>
      </div>
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

function intentBadge(intent: string | null | undefined): React.ReactNode {
  if (!intent) return <span className="text-muted-foreground text-xs">—</span>;
  const map: Record<string, { label: string; cls: string }> = {
    informational: { label: "informatief", cls: "bg-blue-100 text-blue-800" },
    navigational: { label: "navigatie", cls: "bg-secondary text-muted-foreground" },
    commercial: { label: "commercieel", cls: "bg-honey/40 text-ink" },
    transactional: { label: "koop", cls: "bg-green-100 text-green-800" },
  };
  const m = map[intent.toLowerCase()] ?? { label: intent, cls: "bg-secondary text-muted-foreground" };
  return <span className={`text-xs px-2 py-0.5 rounded font-medium ${m.cls}`}>{m.label}</span>;
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
  snaps: ExtendedSnapshot[],
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

function buildFallbackSeoPlan(domain: string, rows: TopKw[]): { actions: SeoAction[]; contentGaps: string[] } {
  const keywords = rows.map((r) => r.keyword).filter(Boolean);
  const primary = keywords[0] ?? "bijenhotel";
  const domainLabel = normalizeDomainLabel(domain);
  return {
    actions: [
      {
        priority: "hoog",
        action: `Maak één sterke hoofdpagina rond “${primary} kopen” met duidelijke keuzehulp, voordelen en plaatsingsadvies.`,
        why: "Dit vangt bezoekers met koopintentie en geeft Google één duidelijke pagina om op commerciële zoekwoorden te ranken.",
        where: "productpagina",
      },
      {
        priority: "hoog",
        action: "Schrijf een complete gids: waar hang je een bijenhotel op, welke richting, welke hoogte en welk onderhoud?",
        why: "Veel klanten zoeken eerst praktische zekerheid. Die informatieve zoekvraag kun je later doorsturen naar aankoop of nieuwsbrief.",
        where: "blog",
      },
      {
        priority: "hoog",
        action: "Voeg op de homepage een korte SEO-sectie toe met wilde bijen, metselbijen, biodiversiteit en bijvriendelijke tuin. ",
        why: "Extra context op de homepage helpt Google beter begrijpen waarvoor HappyBeez relevant is.",
        where: "homepage",
      },
      {
        priority: "midden",
        action: "Maak vergelijkingscontent: bijenhotel vs insectenhotel, bamboe vs hout, goedkoop vs duurzaam.",
        why: "Vergelijkingen scoren vaak goed omdat bezoekers vlak voor een keuze zitten.",
        where: "blog",
      },
      {
        priority: "midden",
        action: `Gebruik interne links vanaf ${domainLabel} naar elke gids met ankerteksten zoals “bijenhotel plaatsen” en “wilde bijen helpen”.`,
        why: "Interne links vertellen zoekmachines welke pagina’s belangrijk zijn en verdelen autoriteit over je site.",
        where: "technisch",
      },
      {
        priority: "laag",
        action: "Maak FAQ-blokken met echte klantvragen en voeg Product/FAQ JSON-LD toe waar logisch.",
        why: "Dit verhoogt de kans op rich snippets en maakt pagina’s bruikbaarder voor AI-zoekresultaten.",
        where: "technisch",
      },
    ],
    contentGaps: [
      "Wanneer hang je een bijenhotel op? Complete seizoensgids voor voorjaar en najaar",
      "Waar plaats je een bijenhotel: zon, regen, hoogte en windrichting uitgelegd",
      "Bijenhotel schoonmaken: wat wel en niet doen voor metselbijen",
      "Welke wilde bijen gebruiken een bijenhotel in Nederland?",
      "Bijenhotel op balkon: zo help je bestuivers zonder grote tuin",
      "Waarom een goedkoop insectenhotel vaak niet goed werkt voor wilde bijen",
      "Bijvriendelijke tuin maken: planten, nestplekken en water in één plan",
      "Bijenhotel kopen: checklist voor veilige gangen, materiaal en formaat",
    ],
  };
}

function normalizeDomainLabel(value: string) {
  return value.replace(/^https?:\/\//, "").replace(/\/.*$/, "") || "de site";
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

function AuditCard({ audit }: { audit: Audit }) {
  const issues = (audit.issues ?? []) as string[];
  const recs = (audit.recommendations ?? []) as string[];
  const [open, setOpen] = useState(true);

  const titleLen = (audit.title ?? "").length;
  const descLen = (audit.meta_description ?? "").length;
  const words = audit.word_count ?? 0;
  const subs = [
    { label: "H1", score: audit.h1 ? 10 : 0, max: 10 },
    { label: "Title", score: titleLen >= 30 && titleLen <= 60 ? 5 : titleLen ? 3 : 0, max: 5 },
    { label: "Content", score: words >= 600 ? 10 : words >= 300 ? 5 : 0, max: 10 },
    { label: "Keyword", score: audit.target_keyword ? 15 : 0, max: 15 },
    { label: "Description", score: descLen >= 120 && descLen <= 160 ? 5 : descLen ? 3 : 0, max: 5 },
    { label: "Performance", score: audit.score != null ? Math.round(((audit.score ?? 0) / 100) * 15) : 0, max: 15 },
  ];

  const findings: Array<{ sev: "high" | "med" | "low"; text: string }> = [];
  if (titleLen && (titleLen < 30 || titleLen > 60))
    findings.push({ sev: "med", text: `Title lengte ${titleLen} tekens — mik op 30–60.` });
  if (descLen && (descLen < 120 || descLen > 160))
    findings.push({ sev: "med", text: `Description lengte ${descLen} tekens — mik op 120–160.` });
  if (!audit.h1) findings.push({ sev: "high", text: "Geen H1 gevonden op de pagina." });
  if (words > 0 && words < 300) findings.push({ sev: "high", text: `Slechts ${words} woorden — dunne content.` });
  for (const it of issues) findings.push({ sev: "med", text: it });
  for (const r of recs) findings.push({ sev: "low", text: `AI: ${r}` });

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-start justify-between gap-4 p-4 text-left hover:bg-secondary/20">
        <div className="min-w-0">
          <p className="font-heading text-lg text-ink truncate">{audit.url}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {audit.target_keyword ? `"${audit.target_keyword}" · ` : ""}
            {new Date(audit.created_at).toLocaleString("nl-NL")}
          </p>
          <div className="flex gap-2 mt-2">
            {findings.filter((f) => f.sev === "high").length > 0 ? (
              <span className="text-xs px-2 py-0.5 rounded border border-destructive text-destructive">
                {findings.filter((f) => f.sev === "high").length} kritiek
              </span>
            ) : null}
            {findings.filter((f) => f.sev === "med").length > 0 ? (
              <span className="text-xs px-2 py-0.5 rounded border border-honey text-honey">
                {findings.filter((f) => f.sev === "med").length} verbeterpunten
              </span>
            ) : null}
            {findings.filter((f) => f.sev === "low").length > 0 ? (
              <span className="text-xs px-2 py-0.5 rounded border border-border text-muted-foreground">
                {findings.filter((f) => f.sev === "low").length} suggesties
              </span>
            ) : null}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className={`text-3xl font-heading font-bold tabular-nums ${scoreColor(audit.score)}`}>
            {audit.score ?? "—"}
            <span className="text-sm text-muted-foreground font-normal">/100</span>
          </div>
          <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Score</div>
        </div>
      </button>

      {open ? (
        <div className="grid gap-6 md:grid-cols-2 border-t border-border p-5">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground mb-3">Deelscores</p>
            <div className="space-y-2 text-sm">
              {subs.map((s) => (
                <div key={s.label} className="flex items-center justify-between border-b border-border/60 py-1.5">
                  <span className="text-foreground/80">{s.label}</span>
                  <span className="tabular-nums font-medium text-ink">{s.score}</span>
                </div>
              ))}
            </div>
            {audit.ai_summary ? (
              <div className="mt-4 rounded-md bg-honey/10 border border-honey/40 p-3 text-xs text-foreground/85 whitespace-pre-line">
                {audit.ai_summary}
              </div>
            ) : null}
          </div>

          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground mb-3">Bevindingen ({findings.length})</p>
            {findings.length === 0 ? (
              <p className="text-sm text-muted-foreground inline-flex items-center gap-1">
                <CheckCircle2 className="h-4 w-4 text-green-700" /> Geen bevindingen — keurig.
              </p>
            ) : (
              <ul className="space-y-2 text-sm">
                {findings.map((f, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span
                      className={`text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded border ${
                        f.sev === "high"
                          ? "border-destructive text-destructive"
                          : f.sev === "med"
                            ? "border-honey text-honey"
                            : "border-border text-muted-foreground"
                      }`}
                    >
                      {f.sev === "high" ? "high" : f.sev === "med" ? "med" : "low"}
                    </span>
                    <span className="text-foreground/85">{f.text}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
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

type RankedRowUI = {
  keyword: string;
  rank: number | null;
  previous_rank: number | null;
  search_volume: number | null;
  cpc: number | null;
  competition: number | null;
  traffic_share: number | null;
  url: string | null;
};

function RankedKeywordsView({
  domain,
  ranked,
  history,
  loading,
  filter,
  setFilter,
  sort,
  setSort,
  checkedAt,
  onRefresh,
  onAddTrack,
}: {
  domain: string;
  ranked: RankedRowUI[];
  history: KwHistory[];
  loading: boolean;
  filter: "all" | "top3" | "top10" | "p11_20" | "p21" | "quickwins";
  setFilter: (v: "all" | "top3" | "top10" | "p11_20" | "p21" | "quickwins") => void;
  sort: "rank" | "volume" | "delta";
  setSort: (v: "rank" | "volume" | "delta") => void;
  checkedAt: string | null;
  onRefresh: () => unknown;
  onAddTrack: (kw: string) => unknown;
}) {
  const filtered = useMemo(() => {
    const inBand = (r: RankedRowUI) => {
      const p = r.rank ?? 999;
      if (filter === "top3") return p >= 1 && p <= 3;
      if (filter === "top10") return p >= 1 && p <= 10;
      if (filter === "p11_20") return p >= 11 && p <= 20;
      if (filter === "p21") return p >= 21;
      if (filter === "quickwins") return p >= 4 && p <= 20 && (r.search_volume ?? 0) >= 50;
      return true;
    };
    const rows = ranked.filter(inBand);
    rows.sort((a, b) => {
      if (sort === "volume") return (b.search_volume ?? 0) - (a.search_volume ?? 0);
      if (sort === "delta") {
        const da = (a.previous_rank ?? a.rank ?? 0) - (a.rank ?? 0);
        const db = (b.previous_rank ?? b.rank ?? 0) - (b.rank ?? 0);
        return db - da;
      }
      return (a.rank ?? 999) - (b.rank ?? 999);
    });
    return rows;
  }, [ranked, filter, sort]);

  const counts = useMemo(() => ({
    all: ranked.length,
    top3: ranked.filter((r) => (r.rank ?? 999) <= 3).length,
    top10: ranked.filter((r) => (r.rank ?? 999) <= 10).length,
    p11_20: ranked.filter((r) => (r.rank ?? 999) >= 11 && (r.rank ?? 999) <= 20).length,
    p21: ranked.filter((r) => (r.rank ?? 999) >= 21).length,
    quickwins: ranked.filter((r) => (r.rank ?? 999) >= 4 && (r.rank ?? 999) <= 20 && (r.search_volume ?? 0) >= 50).length,
  }), [ranked]);

  return (
    <div className="space-y-6">
      <div className="bg-card border border-border rounded-lg p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="font-heading text-lg font-semibold text-ink flex items-center gap-2">
              <Trophy className="h-4 w-4 text-gold" /> Waar rankt {domain}?
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Alle organische keywords waarop dit domein in Google's top-100 staat, met positie, vorige meting en volume. Elke vernieuwing wordt bewaard voor trendanalyse.
            </p>
            {checkedAt ? (
              <p className="text-xs text-muted-foreground mt-1">Laatst opgehaald: {new Date(checkedAt).toLocaleString("nl-NL")}</p>
            ) : null}
          </div>
          <Button onClick={() => void onRefresh()} disabled={loading} className="bg-wine text-white hover:bg-wine/90">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {loading ? "Ophalen…" : "Vernieuw ranglijst"}
          </Button>
        </div>

        <div className="flex flex-wrap gap-1.5 mb-3">
          {([
            ["all", `Alle (${counts.all})`],
            ["top3", `Top 3 (${counts.top3})`],
            ["top10", `Top 10 (${counts.top10})`],
            ["p11_20", `Pos 11-20 (${counts.p11_20})`],
            ["p21", `Pos 21+ (${counts.p21})`],
            ["quickwins", `Quick wins (${counts.quickwins})`],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setFilter(id)}
              className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                filter === id ? "bg-wine text-white border-wine" : "bg-secondary text-foreground border-border hover:bg-secondary/70"
              }`}
            >
              {label}
            </button>
          ))}
          <span className="ml-auto text-xs text-muted-foreground self-center">Sorteer:</span>
          {([
            ["rank", "positie"],
            ["volume", "volume"],
            ["delta", "Δ"],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setSort(id)}
              className={`text-xs px-2.5 py-1 rounded border ${
                sort === id ? "border-wine text-wine" : "border-border text-muted-foreground hover:text-ink"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {ranked.length === 0 ? (
          <div className="rounded-md border border-dashed border-border p-8 text-center">
            <Trophy className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-ink font-medium">Nog geen ranglijst opgehaald</p>
            <p className="text-xs text-muted-foreground mt-1">Klik op "Vernieuw ranglijst" om alle keywords te zien waar {domain} op rankt.</p>
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">Geen keywords in deze categorie.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                  <th className="py-2 pr-4">Keyword</th>
                  <th className="py-2 pr-4 text-right">Positie</th>
                  <th className="py-2 pr-4 text-right">Δ</th>
                  <th className="py-2 pr-4 text-right">Volume</th>
                  <th className="py-2 pr-4 text-right">CPC</th>
                  <th className="py-2 pr-4 text-right">Verkeer %</th>
                  <th className="py-2 pr-4">URL</th>
                  <th className="py-2 pr-4">Trend</th>
                  <th className="py-2 pr-4 text-right">Actie</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((r, i) => {
                  const delta = r.previous_rank != null && r.rank != null ? r.previous_rank - r.rank : null;
                  const trend = history
                    .filter((h) => h.keyword === r.keyword && h.domain === domain && h.rank != null)
                    .sort((a, b) => +new Date(a.checked_at) - +new Date(b.checked_at))
                    .slice(-10)
                    .map((h) => h.rank as number);
                  return (
                    <tr key={`${r.keyword}-${i}`} className="hover:bg-secondary/30">
                      <td className="py-2 pr-4 font-medium text-ink">{r.keyword}</td>
                      <td className="py-2 pr-4 text-right">{positionBadge(r.rank)}</td>
                      <td className="py-2 pr-4 text-right">
                        {delta == null || delta === 0 ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : delta > 0 ? (
                          <span className="text-xs text-green-700 inline-flex items-center gap-0.5">
                            <TrendingUp className="h-3 w-3" /> +{delta}
                          </span>
                        ) : (
                          <span className="text-xs text-destructive inline-flex items-center gap-0.5">
                            <TrendingDown className="h-3 w-3" /> {delta}
                          </span>
                        )}
                      </td>
                      <td className="py-2 pr-4 text-right tabular-nums">{fmtNum(r.search_volume)}</td>
                      <td className="py-2 pr-4 text-right tabular-nums">{r.cpc ? `€${r.cpc.toFixed(2)}` : "—"}</td>
                      <td className="py-2 pr-4 text-right tabular-nums">{r.traffic_share != null ? `${r.traffic_share.toFixed(1)}%` : "—"}</td>
                      <td className="py-2 pr-4 text-xs text-muted-foreground max-w-[16rem] truncate">
                        {r.url ? (
                          <a href={r.url} target="_blank" rel="noreferrer" className="hover:text-wine">{r.url.replace(/^https?:\/\//, "")}</a>
                        ) : "—"}
                      </td>
                      <td className="py-2 pr-4">{trend.length > 1 ? <Sparkline values={trend} /> : <span className="text-xs text-muted-foreground">—</span>}</td>
                      <td className="py-2 pr-4 text-right">
                        <button
                          onClick={() => void onAddTrack(r.keyword)}
                          className="text-xs text-wine hover:underline inline-flex items-center gap-1"
                          title="Voeg toe aan tracking"
                        >
                          <Crosshair className="h-3 w-3" /> Volg
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const w = 80;
  const h = 22;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(1, max - min);
  // lager = beter, dus inverteren zodat top-positie boven staat
  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = ((v - min) / range) * h;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const last = values[values.length - 1];
  const first = values[0];
  const better = last < first;
  const color = better ? "#15803d" : last > first ? "#b91c1c" : "#737373";
  return (
    <svg width={w} height={h} className="overflow-visible">
      <polyline fill="none" stroke={color} strokeWidth="1.5" points={points} />
    </svg>
  );
}

