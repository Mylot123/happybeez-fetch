import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Sparkles, Loader2, CalendarRange, Check, Archive, History, RotateCcw, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { generateCampaignPlan, setCampaignPlanStatus, restoreCampaignPlanVersion } from "@/lib/campaigns.functions";


export const Route = createFileRoute("/campagnes")({
  head: () => ({
    meta: [
      { title: "Campagnes — SocialMotor" },
      { name: "description", content: "Maandelijkse campagneplanner: thema, doel en contentblokken per week." },
    ],
  }),
  component: () => (
    <ProtectedRoute>
      <CampagnesPage />
    </ProtectedRoute>
  ),
});

const MONTHS = [
  "januari", "februari", "maart", "april", "mei", "juni",
  "juli", "augustus", "september", "oktober", "november", "december",
];

const STATUS_LABEL: Record<string, string> = {
  concept: "Concept",
  approved: "Goedgekeurd",
  active: "Actief",
  archived: "Archief",
};

function CampagnesPage() {
  const { currentOrgId } = useCurrentOrg();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [extra, setExtra] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const gen = useServerFn(generateCampaignPlan);
  const setStatus = useServerFn(setCampaignPlanStatus);
  const restoreFn = useServerFn(restoreCampaignPlanVersion);
  const qc = useQueryClient();

  const planQuery = useQuery({
    queryKey: ["campaign-plan", currentOrgId, year, month],
    enabled: !!currentOrgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaign_plans")
        .select("id, theme, goal, summary, status, month, year")
        .eq("org_id", currentOrgId!)
        .eq("year", year)
        .eq("month", month)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const blocksQuery = useQuery({
    queryKey: ["campaign-blocks", planQuery.data?.id],
    enabled: !!planQuery.data?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaign_blocks")
        .select("id, name, pillar, week, hook, platforms, notes, sort_order")
        .eq("plan_id", planQuery.data!.id)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const versionsQuery = useQuery({
    queryKey: ["campaign-plan-versions", planQuery.data?.id],
    enabled: !!planQuery.data?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaign_plan_versions")
        .select("id, created_at, prev_status, snapshot")
        .eq("plan_id", planQuery.data!.id)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
  });

  const years = useMemo(() => {
    const y = now.getFullYear();
    return [y - 1, y, y + 1];
  }, [now]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["campaign-plan", currentOrgId, year, month] });
    qc.invalidateQueries({ queryKey: ["campaign-blocks"] });
    qc.invalidateQueries({ queryKey: ["campaign-plan-versions"] });
  };

  const runGenerate = async () => {
    if (!currentOrgId) return;
    setBusy(true);
    try {
      await gen({ data: { org_id: currentOrgId, month, year, extraContext: extra || undefined } });
      toast.success("Maandplan gegenereerd");
      setExtra("");
      invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Genereren mislukt");
    } finally {
      setBusy(false);
    }
  };

  const onGenerateClick = () => {
    const status = planQuery.data?.status;
    if (status === "approved" || status === "active") {
      setConfirmOpen(true);
      return;
    }
    void runGenerate();
  };

  const onConfirmRegenerate = async () => {
    setConfirmOpen(false);
    await runGenerate();
  };

  const changeStatus = async (status: "concept" | "approved" | "active" | "archived") => {
    if (!planQuery.data?.id) return;
    try {
      await setStatus({ data: { plan_id: planQuery.data.id, status } });
      toast.success(`Status: ${STATUS_LABEL[status]}`);
      invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Kon status niet wijzigen");
    }
  };

  const onRestore = async (versionId: string) => {
    setRestoringId(versionId);
    try {
      await restoreFn({ data: { version_id: versionId } });
      toast.success("Vorige versie hersteld");
      invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Herstellen mislukt");
    } finally {
      setRestoringId(null);
    }
  };

  const plan = planQuery.data;
  const blocks = blocksQuery.data ?? [];
  const versions = versionsQuery.data ?? [];

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <header className="mb-8 flex items-start justify-between gap-6 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
            <CalendarRange className="w-3.5 h-3.5" /> Strategie
          </div>
          <h1 className="text-3xl font-heading font-bold text-ink mt-2">Campagneplanner</h1>
          <p className="text-muted-foreground text-sm mt-2 max-w-xl">
            Elke maand een thema en 4 contentblokken. Josef gebruikt jullie merkprofiel en de kalender om suggesties te doen.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="h-10 px-3 rounded-md border border-border bg-background text-sm capitalize"
          >
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>{m}</option>
            ))}
          </select>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="h-10 px-3 rounded-md border border-border bg-background text-sm"
          >
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </header>

      {/* Generator */}
      <section className="bg-card border border-border/60 rounded-lg p-6 mb-6">
        <Label htmlFor="extra">Extra context (optioneel)</Label>
        <Textarea
          id="extra"
          rows={2}
          value={extra}
          onChange={(e) => setExtra(e.target.value)}
          placeholder="Bv. Introductie nieuwe honingsoort, marktdag op 14e, focus op cadeautips."
          className="mt-2"
        />
        <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-xs text-muted-foreground">
            Bouwt of vervangt het plan voor <span className="capitalize font-medium">{MONTHS[month - 1]} {year}</span>.
          </p>
          <Button onClick={onGenerateClick} disabled={busy || !currentOrgId}>
            {busy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1" />}
            {plan ? "Opnieuw genereren" : "Genereer maandplan"}
          </Button>
        </div>
      </section>

      {/* Plan */}
      {planQuery.isLoading ? (
        <p className="text-muted-foreground text-sm">Laden…</p>
      ) : !plan ? (
        <div className="text-center py-16 border border-dashed border-border rounded-lg">
          <Sparkles className="w-8 h-8 text-muted-foreground/60 mx-auto mb-3" />
          <p className="font-medium text-ink">Nog geen plan voor deze maand</p>
          <p className="text-sm text-muted-foreground mt-1">Klik op "Genereer maandplan" om te starten.</p>
        </div>
      ) : (
        <>
          <section className="bg-card border border-border/60 rounded-lg p-6 mb-6">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  Maandthema
                </p>
                <h2 className="text-2xl font-heading font-bold text-ink mt-1">{plan.theme}</h2>
                {plan.goal && <p className="text-sm text-foreground/80 mt-2"><span className="font-semibold">Doel:</span> {plan.goal}</p>}
                {plan.summary && <p className="text-sm text-muted-foreground mt-2 whitespace-pre-line">{plan.summary}</p>}
              </div>
              <div className="flex flex-col items-end gap-2">
                <Badge variant={plan.status === "approved" || plan.status === "active" ? "default" : "secondary"}>
                  {STATUS_LABEL[plan.status] ?? plan.status}
                </Badge>
                <div className="flex gap-2">
                  {plan.status !== "approved" && (
                    <Button size="sm" variant="outline" onClick={() => changeStatus("approved")}>
                      <Check className="w-3.5 h-3.5 mr-1" /> Keur goed
                    </Button>
                  )}
                  {plan.status !== "archived" && (
                    <Button size="sm" variant="ghost" onClick={() => changeStatus("archived")}>
                      <Archive className="w-3.5 h-3.5 mr-1" /> Archief
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </section>

          <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {blocks.map((b) => (
              <article key={b.id} className="bg-card border border-border/60 rounded-lg p-5">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {b.week && <span className="font-semibold text-wine">Week {b.week}</span>}
                  {b.pillar && <span className="uppercase tracking-widest">· {b.pillar}</span>}
                </div>
                <h3 className="text-lg font-heading font-semibold text-ink mt-1">{b.name}</h3>
                {b.hook && <p className="text-sm text-foreground/80 mt-2 italic">"{b.hook}"</p>}
                {b.notes && <p className="text-sm text-muted-foreground mt-2 whitespace-pre-line">{b.notes}</p>}
                {b.platforms && b.platforms.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {b.platforms.map((p) => (
                      <span key={p} className="px-2 py-0.5 rounded-full bg-muted text-[10px] uppercase tracking-widest font-semibold text-foreground/70">
                        {p}
                      </span>
                    ))}
                  </div>
                )}
              </article>
            ))}
          </section>

          {versions.length > 0 && (
            <section className="mt-8">
              <div className="flex items-center gap-2 mb-3">
                <History className="w-4 h-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold text-ink uppercase tracking-widest">Vorige versies</h3>
              </div>
              <ul className="divide-y divide-border/60 border border-border/60 rounded-lg overflow-hidden">
                {versions.map((v) => {
                  const snap = (v.snapshot ?? {}) as { theme?: string; blocks?: unknown[] };
                  const blockCount = Array.isArray(snap.blocks) ? snap.blocks.length : 0;
                  return (
                    <li key={v.id} className="flex items-center justify-between gap-4 px-4 py-3 bg-card">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-ink truncate">{snap.theme ?? "Onbekend thema"}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {new Date(v.created_at).toLocaleString("nl-NL", { dateStyle: "short", timeStyle: "short" })}
                          {" · "}{blockCount} blokken
                          {v.prev_status ? ` · was ${STATUS_LABEL[v.prev_status] ?? v.prev_status}` : ""}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onRestore(v.id)}
                        disabled={restoringId === v.id}
                      >
                        {restoringId === v.id ? (
                          <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                        ) : (
                          <RotateCcw className="w-3.5 h-3.5 mr-1" />
                        )}
                        Herstel
                      </Button>
                    </li>
                  );
                })}
              </ul>
              <p className="text-xs text-muted-foreground mt-2">
                Bij herstel wordt het huidige plan ook opgeslagen als versie, zodat je altijd terug kunt.
              </p>
            </section>
          )}
        </>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              Bestaand plan overschrijven?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Het huidige maandplan heeft status <span className="font-semibold">{STATUS_LABEL[plan?.status ?? ""] ?? plan?.status}</span>.
              Opnieuw genereren vervangt het thema en alle contentblokken. De huidige versie wordt bewaard onder "Vorige versies" zodat je hem kunt herstellen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction onClick={onConfirmRegenerate}>Ja, overschrijf</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
