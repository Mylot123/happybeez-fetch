import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { BarChart3, Eye, Heart, MessageCircle, Share2 } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics — SocialMotor" },
      { name: "description", content: "Bereik, engagement en beste posting-momenten per kanaal." },
    ],
  }),
  component: () => (
    <ProtectedRoute>
      <Analytics />
    </ProtectedRoute>
  ),
});

type MetricRow = {
  id: string;
  post_id: string;
  platform: string;
  reach: number;
  impressions: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  engagement_rate: number;
  recorded_at: string;
};

const channelDot: Record<string, string> = {
  instagram: "bg-pink-400",
  linkedin: "bg-blue-500",
  facebook: "bg-indigo-500",
  youtube: "bg-red-500",
};

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Eye;
  label: string;
  value: string | number;
}) {
  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-center gap-2 text-muted-foreground text-xs">
        <Icon className="w-3.5 h-3.5" />
        <span>{label}</span>
      </div>
      <div className="font-heading text-2xl font-bold text-ink mt-1">{value}</div>
    </div>
  );
}

function Analytics() {
  const { currentOrgId } = useCurrentOrg();

  const { data: metrics = [], isLoading } = useQuery({
    queryKey: ["metrics", currentOrgId],
    enabled: !!currentOrgId,
    queryFn: async () => {
      const since = new Date(Date.now() - 30 * 86400_000).toISOString();
      const { data, error } = await supabase
        .from("post_metrics")
        .select("id, post_id, platform, reach, impressions, likes, comments, shares, saves, engagement_rate, recorded_at")
        .eq("org_id", currentOrgId!)
        .gte("recorded_at", since)
        .order("recorded_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as MetricRow[];
    },
  });

  // Totals
  const totals = metrics.reduce(
    (acc, m) => {
      acc.reach += m.reach;
      acc.impressions += m.impressions;
      acc.likes += m.likes;
      acc.comments += m.comments;
      acc.shares += m.shares;
      return acc;
    },
    { reach: 0, impressions: 0, likes: 0, comments: 0, shares: 0 },
  );
  const avgEngagement = metrics.length
    ? metrics.reduce((s, m) => s + Number(m.engagement_rate), 0) / metrics.length
    : 0;

  // Per platform breakdown
  const byPlatform = metrics.reduce<Record<string, { reach: number; er: number; n: number }>>(
    (acc, m) => {
      const k = m.platform;
      if (!acc[k]) acc[k] = { reach: 0, er: 0, n: 0 };
      acc[k].reach += m.reach;
      acc[k].er += Number(m.engagement_rate);
      acc[k].n += 1;
      return acc;
    },
    {},
  );

  const topPosts = [...metrics]
    .sort((a, b) => Number(b.engagement_rate) - Number(a.engagement_rate))
    .slice(0, 5);

  return (
    <div className="px-4 sm:px-8 py-8 max-w-6xl mx-auto">
      <div className="mb-6">
        <span className="text-xs tracking-[0.2em] uppercase text-muted-foreground font-medium">
          Groei
        </span>
        <h1 className="font-heading font-bold text-ink text-3xl mt-1 ruled-heading">Analytics</h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
          Laatste 30 dagen — dagelijks ververst via Ayrshare Analytics. Deze cijfers voeden
          automatisch de volgende campagne-generatie.
        </p>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cijfers laden…</p>
      ) : metrics.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Nog geen metrics. Zodra posts gepubliceerd zijn en de dagelijkse cron heeft gelopen,
          verschijnen ze hier.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
            <Stat icon={Eye} label="Bereik" value={totals.reach.toLocaleString("nl-NL")} />
            <Stat icon={BarChart3} label="Impressies" value={totals.impressions.toLocaleString("nl-NL")} />
            <Stat icon={Heart} label="Likes" value={totals.likes.toLocaleString("nl-NL")} />
            <Stat icon={MessageCircle} label="Reacties" value={totals.comments.toLocaleString("nl-NL")} />
            <Stat icon={Share2} label="Gem. engagement" value={`${(avgEngagement * 100).toFixed(1)}%`} />
          </div>

          <div className="bg-card border border-border rounded-lg p-5 mb-6">
            <h2 className="font-heading font-semibold text-ink mb-3">Per kanaal</h2>
            <div className="space-y-2">
              {Object.entries(byPlatform).map(([platform, v]) => (
                <div key={platform} className="flex items-center gap-3">
                  <div
                    className={cn(
                      "w-2.5 h-2.5 rounded-full",
                      channelDot[platform] ?? "bg-muted-foreground",
                    )}
                  />
                  <span className="capitalize text-sm text-ink w-24">{platform}</span>
                  <span className="text-xs text-muted-foreground w-24">
                    {v.reach.toLocaleString("nl-NL")} bereik
                  </span>
                  <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-wine"
                      style={{ width: `${Math.min(100, (v.er / Math.max(1, v.n)) * 500)}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground w-14 text-right">
                    {((v.er / Math.max(1, v.n)) * 100).toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg p-5">
            <h2 className="font-heading font-semibold text-ink mb-3">Top-5 posts (engagement)</h2>
            <div className="space-y-2">
              {topPosts.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between text-sm border-b border-border/50 last:border-0 pb-2 last:pb-0"
                >
                  <span className="capitalize text-muted-foreground">{p.platform}</span>
                  <span className="text-ink">{p.reach.toLocaleString("nl-NL")} bereik</span>
                  <span className="font-semibold text-wine">
                    {(Number(p.engagement_rate) * 100).toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
