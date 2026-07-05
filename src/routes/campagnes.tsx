import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Sparkles, Loader2, CalendarRange, Check, Archive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { generateCampaignPlan, setCampaignPlanStatus } from "@/lib/campaigns.functions";

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
  const gen = useServerFn(generateCampaignPlan);
  const setStatus = useServerFn(setCampaignPlanStatus);
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

  const years = useMemo(() => {
    const y = now.getFullYear();
    return [y - 1, y, y + 1];
  }, [now]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["campaign-plan", currentOrgId, year, month] });
    qc.invalidateQueries({ queryKey: ["campaign-blocks"] });
  };

  const onGenerate = async () => {
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

  const plan = planQuery.data;
  const blocks = blocksQuery.data ?? [];

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
          <Button onClick={onGenerate} disabled={busy || !currentOrgId}>
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
        </>
      )}
    </div>
  );
}
