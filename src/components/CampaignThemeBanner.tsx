import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { CalendarRange, ArrowRight, Megaphone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrg } from "@/hooks/use-current-org";

const MONTHS_NL = [
  "januari", "februari", "maart", "april", "mei", "juni",
  "juli", "augustus", "september", "oktober", "november", "december",
];

const STATUS_LABEL: Record<string, string> = {
  concept: "Concept",
  approved: "Goedgekeurd",
  active: "Actief",
  archived: "Archief",
};

/**
 * Toont het campagnethema van de zichtbare maand boven de kalender,
 * plus (in weekweergave) het contentblok van die week.
 */
export function CampaignThemeBanner({
  year,
  month,
  weekOfMonth,
}: {
  year: number;
  /** 0-based */
  month: number;
  /** 1-based weeknummer binnen de maand; alleen in weekweergave */
  weekOfMonth?: number;
}) {
  const { currentOrgId } = useCurrentOrg();

  const planQuery = useQuery({
    queryKey: ["calendar-campaign-plan", currentOrgId, year, month],
    enabled: !!currentOrgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaign_plans")
        .select("id, theme, goal, summary, status")
        .eq("org_id", currentOrgId!)
        .eq("year", year)
        .eq("month", month + 1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const blocksQuery = useQuery({
    queryKey: ["calendar-campaign-blocks", planQuery.data?.id],
    enabled: !!planQuery.data?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaign_blocks")
        .select("id, name, pillar, week, hook, platforms")
        .eq("plan_id", planQuery.data!.id)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const plan = planQuery.data;
  const blocks = blocksQuery.data ?? [];
  const weekBlock =
    weekOfMonth != null ? blocks.find((b) => b.week === weekOfMonth) : undefined;

  if (!plan) {
    return (
      <div className="mb-5 rounded-lg border border-dashed border-border bg-card px-5 py-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <Megaphone className="w-4 h-4 mt-0.5 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium text-ink">
              Nog geen campagnethema voor {MONTHS_NL[month]} {year}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              De campagneplanner bepaalt <em>waarover</em> je die maand post; de kalender
              bepaalt <em>wanneer</em>. Maak eerst een maandplan.
            </p>
          </div>
        </div>
        <Link
          to="/campagnes"
          className="text-xs font-semibold text-wine hover:underline inline-flex items-center gap-1"
        >
          Naar campagneplanner <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    );
  }

  return (
    <div className="mb-5 rounded-lg border border-border bg-secondary/40 px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            <CalendarRange className="w-3.5 h-3.5" />
            Campagne · {MONTHS_NL[month]} {year}
            <span className="px-1.5 py-0.5 rounded-full bg-muted text-[10px] tracking-normal font-semibold">
              {STATUS_LABEL[plan.status] ?? plan.status}
            </span>
          </div>
          <h3 className="font-heading text-lg font-bold text-ink mt-1">{plan.theme}</h3>
          {plan.goal && (
            <p className="text-xs text-muted-foreground mt-1">
              <span className="font-medium text-ink">Doel:</span> {plan.goal}
            </p>
          )}
        </div>
        <Link
          to="/campagnes"
          className="text-xs font-semibold text-wine hover:underline inline-flex items-center gap-1 shrink-0"
        >
          Bekijk campagne <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {weekBlock ? (
        <div className="mt-3 pt-3 border-t border-border/60">
          <p className="text-xs text-muted-foreground">
            <span className="font-semibold text-wine">Deze week (week {weekBlock.week})</span>
            {weekBlock.pillar ? ` · ${weekBlock.pillar}` : ""}
          </p>
          <p className="text-sm font-medium text-ink mt-0.5">{weekBlock.name}</p>
          {weekBlock.hook && (
            <p className="text-xs text-muted-foreground italic mt-0.5">"{weekBlock.hook}"</p>
          )}
        </div>
      ) : blocks.length > 0 ? (
        <div className="mt-3 pt-3 border-t border-border/60 flex flex-wrap gap-1.5">
          {blocks.map((b) => (
            <span
              key={b.id}
              className="px-2 py-0.5 rounded-full bg-card border border-border/60 text-[11px] text-foreground/80"
            >
              {b.week ? `W${b.week} · ` : ""}
              {b.name}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
