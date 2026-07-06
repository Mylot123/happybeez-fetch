import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Kanban,
  Loader2,
  Send,
  Check,
  Undo2,
  CalendarClock,
  Rocket,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { cn } from "@/lib/utils";
import {
  approvePost,
  markPostPublished,
  rejectPost,
  revertPostToDraft,
  schedulePost,
  submitPostForReview,
} from "@/lib/posts.functions";

export const Route = createFileRoute("/planning")({
  head: () => ({
    meta: [
      { title: "Planning & Approvals — SocialMotor" },
      { name: "description", content: "Volg posts van concept naar publicatie: ter beoordeling, goedkeuring en inplannen." },
    ],
  }),
  component: () => (
    <ProtectedRoute>
      <PlanningPage />
    </ProtectedRoute>
  ),
});

type Status = "draft" | "review" | "approved" | "scheduled" | "published" | "failed";

const COLUMNS: { key: Status; label: string; hint: string; accent: string }[] = [
  { key: "draft",     label: "Concept",       hint: "In bewerking",           accent: "border-l-muted-foreground/40" },
  { key: "review",    label: "Ter beoordeling", hint: "Wacht op goedkeuring", accent: "border-l-amber-400" },
  { key: "approved",  label: "Goedgekeurd",   hint: "Klaar om in te plannen", accent: "border-l-forest" },
  { key: "scheduled", label: "Ingepland",     hint: "Wordt gepubliceerd",     accent: "border-l-blue-500" },
  { key: "published", label: "Gepubliceerd",  hint: "Live",                   accent: "border-l-emerald-500" },
  { key: "failed",    label: "Mislukt",       hint: "Handmatige actie nodig", accent: "border-l-destructive" },
];

type PostRow = {
  id: string;
  title: string;
  channel: string;
  status: Status;
  publish_date: string | null;
  scheduled_at: string | null;
  content_text: string | null;
  review_notes: string | null;
  failure_reason: string | null;
  hashtags: string[] | null;
};

function PlanningPage() {
  const { currentOrgId, currentRole } = useCurrentOrg();
  const qc = useQueryClient();

  const isAdmin = currentRole === "org_admin" || currentRole === "agency_admin";

  const submit = useServerFn(submitPostForReview);
  const revert = useServerFn(revertPostToDraft);
  const approve = useServerFn(approvePost);
  const schedule = useServerFn(schedulePost);
  const publish = useServerFn(markPostPublished);
  const reject = useServerFn(rejectPost);

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ["planning-posts", currentOrgId],
    enabled: !!currentOrgId,
    queryFn: async (): Promise<PostRow[]> => {
      const { data, error } = await supabase
        .from("content_calendar_items")
        .select("id, title, channel, status, publish_date, scheduled_at, content_text, review_notes, failure_reason, hashtags")
        .eq("org_id", currentOrgId!)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PostRow[];
    },
  });

  const grouped = useMemo(() => {
    const map: Record<Status, PostRow[]> = {
      draft: [], review: [], approved: [], scheduled: [], published: [], failed: [],
    };
    for (const p of posts) {
      const s = (p.status ?? "draft") as Status;
      (map[s] ?? map.draft).push(p);
    }
    return map;
  }, [posts]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["planning-posts", currentOrgId] });

  const withToast = async (label: string, fn: () => Promise<unknown>) => {
    try {
      await fn();
      toast.success(label);
      invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Actie mislukt");
    }
  };

  return (
    <div className="px-6 py-10 max-w-[1600px] mx-auto">
      <header className="mb-8">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
          <Kanban className="w-3.5 h-3.5" /> Content
        </div>
        <h1 className="text-3xl font-heading font-bold text-ink mt-2">Planning &amp; goedkeuring</h1>
        <p className="text-muted-foreground text-sm mt-2 max-w-2xl">
          Beweeg posts door de flow: concept → ter beoordeling → goedgekeurd → ingepland → gepubliceerd.
          {!isAdmin && (
            <> Als editor kun je posts ter beoordeling aanbieden of terug naar concept zetten. Goedkeuren en inplannen is voor beheerders.</>
          )}
        </p>
      </header>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Laden…</p>
      ) : posts.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-border rounded-lg">
          <Kanban className="w-8 h-8 text-muted-foreground/60 mx-auto mb-3" />
          <p className="font-medium text-ink">Nog geen posts</p>
          <p className="text-sm text-muted-foreground mt-1">
            Maak een post aan in de{" "}
            <Link to="/content-studio" className="text-wine underline">Content Studio</Link>{" "}
            of de <Link to="/kalender" className="text-wine underline">Kalender</Link>.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-4">
          {COLUMNS.map((col) => (
            <section key={col.key} className="min-w-0">
              <header className="mb-3">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold text-ink">{col.label}</h2>
                  <span className="text-xs text-muted-foreground">{grouped[col.key].length}</span>
                </div>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground/70">{col.hint}</p>
              </header>
              <div className="space-y-3">
                {grouped[col.key].map((p) => (
                  <PostCard
                    key={p.id}
                    post={p}
                    accent={col.accent}
                    isAdmin={isAdmin}
                    onSubmit={() => withToast("Ter beoordeling", () => submit({ data: { id: p.id } }))}
                    onRevert={() => withToast("Terug naar concept", () => revert({ data: { id: p.id } }))}
                    onApprove={() => withToast("Goedgekeurd", () => approve({ data: { id: p.id } }))}
                    onSchedule={(iso) => withToast("Ingepland", () => schedule({ data: { id: p.id, scheduled_at: iso } }))}
                    onPublish={() => withToast("Gepubliceerd", () => publish({ data: { id: p.id } }))}
                    onReject={(notes) => withToast("Afgewezen", () => reject({ data: { id: p.id, notes } }))}
                  />
                ))}
                {grouped[col.key].length === 0 && (
                  <div className="rounded-md border border-dashed border-border/60 p-4 text-center text-xs text-muted-foreground">
                    Leeg
                  </div>
                )}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function PostCard({
  post,
  accent,
  isAdmin,
  onSubmit,
  onRevert,
  onApprove,
  onSchedule,
  onPublish,
  onReject,
}: {
  post: PostRow;
  accent: string;
  isAdmin: boolean;
  onSubmit: () => Promise<void>;
  onRevert: () => Promise<void>;
  onApprove: () => Promise<void>;
  onSchedule: (iso: string) => Promise<void>;
  onPublish: () => Promise<void>;
  onReject: (notes: string) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [when, setWhen] = useState<string>("");
  const [rejecting, setRejecting] = useState(false);
  const [notes, setNotes] = useState("");

  const wrap = async (fn: () => Promise<void>) => {
    setBusy(true);
    try { await fn(); } finally { setBusy(false); }
  };

  return (
    <article className={cn("bg-card border border-border/60 border-l-4 rounded-md p-3 space-y-2", accent)}>
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-ink line-clamp-2 min-w-0">{post.title}</h3>
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground shrink-0">{post.channel}</span>
      </div>
      {post.content_text && (
        <p className="text-xs text-muted-foreground line-clamp-3">{post.content_text}</p>
      )}
      {post.publish_date && (
        <p className="text-[11px] text-muted-foreground">Streefdatum: {post.publish_date}</p>
      )}
      {post.scheduled_at && (
        <p className="text-[11px] text-blue-600">
          Ingepland: {new Date(post.scheduled_at).toLocaleString("nl-NL", { dateStyle: "short", timeStyle: "short" })}
        </p>
      )}
      {post.review_notes && post.status === "draft" && (
        <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded p-1.5">
          ✎ {post.review_notes}
        </p>
      )}
      {post.failure_reason && (
        <p className="text-[11px] text-destructive bg-destructive/5 border border-destructive/20 rounded p-1.5">
          ⚠ {post.failure_reason}
        </p>
      )}

      {/* Actions per status */}
      <div className="flex flex-wrap gap-1.5 pt-1">
        {post.status === "draft" && (
          <ActionBtn busy={busy} variant="primary" onClick={() => wrap(onSubmit)} icon={<Send className="w-3 h-3" />} label="Ter beoordeling" />
        )}
        {post.status === "review" && (
          <>
            {isAdmin ? (
              <>
                <ActionBtn busy={busy} variant="primary" onClick={() => wrap(onApprove)} icon={<Check className="w-3 h-3" />} label="Keur goed" />
                {rejecting ? (
                  <div className="flex flex-col gap-1 w-full">
                    <Input
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Feedback voor de auteur…"
                      className="h-7 text-xs"
                      autoFocus
                    />
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="destructive"
                        className="h-7 px-2 text-xs flex-1"
                        disabled={busy}
                        onClick={() => wrap(async () => { await onReject(notes); setRejecting(false); setNotes(""); })}
                      >
                        <Undo2 className="w-3 h-3 mr-1" /> Terugsturen
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs"
                        onClick={() => { setRejecting(false); setNotes(""); }}
                      >
                        Annuleer
                      </Button>
                    </div>
                  </div>
                ) : (
                  <ActionBtn busy={busy} onClick={async () => setRejecting(true)} icon={<Undo2 className="w-3 h-3" />} label="Wijs af met feedback" />
                )}
              </>
            ) : (
              <p className="text-[11px] text-muted-foreground italic w-full">
                Wacht op beheerder voor goedkeuring.
              </p>
            )}
            <ActionBtn busy={busy} onClick={() => wrap(onRevert)} icon={<Undo2 className="w-3 h-3" />} label="Terug naar concept" />
          </>
        )}
        {post.status === "approved" && isAdmin && (
          scheduling ? (
            <div className="flex flex-col gap-1 w-full">
              <Input
                type="datetime-local"
                value={when}
                onChange={(e) => setWhen(e.target.value)}
                className="h-7 text-xs"
                autoFocus
              />
              <div className="flex gap-1">
                <Button
                  size="sm"
                  className="h-7 px-2 text-xs flex-1"
                  disabled={!when || busy}
                  onClick={() => wrap(async () => {
                    await onSchedule(new Date(when).toISOString());
                    setScheduling(false); setWhen("");
                  })}
                >
                  <CalendarClock className="w-3 h-3 mr-1" /> Bevestig
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs"
                  onClick={() => { setScheduling(false); setWhen(""); }}
                >
                  Annuleer
                </Button>
              </div>
            </div>
          ) : (
            <>
              <ActionBtn
                busy={busy}
                variant="primary"
                onClick={async () => {
                  if (!when && post.publish_date) {
                    // Prefill datetime-local with target date at 09:00 local
                    setWhen(`${post.publish_date}T09:00`);
                  }
                  setScheduling(true);
                }}
                icon={<CalendarClock className="w-3 h-3" />}
                label="Inplannen"
              />
              <ActionBtn busy={busy} onClick={() => wrap(onRevert)} icon={<Undo2 className="w-3 h-3" />} label="Terug naar concept" />
            </>
          )
        )}
        {post.status === "scheduled" && isAdmin && (
          <>
            <ActionBtn
              busy={busy}
              onClick={() => wrap(onPublish)}
              icon={<Rocket className="w-3 h-3" />}
              label="Handmatig als gepubliceerd markeren"
            />
            <ActionBtn busy={busy} onClick={() => wrap(onRevert)} icon={<Undo2 className="w-3 h-3" />} label="Annuleer inplanning" />
            <p className="text-[10px] text-muted-foreground w-full">
              Publiceert automatisch op het geplande tijdstip.
            </p>
          </>
        )}
        {post.status === "failed" && isAdmin && (
          <>
            {scheduling ? (
              <div className="flex flex-col gap-1 w-full">
                <Input
                  type="datetime-local"
                  value={when}
                  onChange={(e) => setWhen(e.target.value)}
                  className="h-7 text-xs"
                  autoFocus
                />
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    className="h-7 px-2 text-xs flex-1"
                    disabled={!when || busy}
                    onClick={() => wrap(async () => {
                      await onSchedule(new Date(when).toISOString());
                      setScheduling(false); setWhen("");
                    })}
                  >
                    <CalendarClock className="w-3 h-3 mr-1" /> Herplan
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs"
                    onClick={() => { setScheduling(false); setWhen(""); }}
                  >
                    Annuleer
                  </Button>
                </div>
              </div>
            ) : (
              <ActionBtn
                busy={busy}
                variant="primary"
                onClick={async () => setScheduling(true)}
                icon={<CalendarClock className="w-3 h-3" />}
                label="Herplan"
              />
            )}
            <ActionBtn busy={busy} onClick={() => wrap(onRevert)} icon={<Undo2 className="w-3 h-3" />} label="Terug naar concept" />
          </>
        )}
        {post.status === "published" && (
          <span className="text-[11px] text-emerald-700 flex items-center gap-1"><Check className="w-3 h-3" /> Live</span>
        )}
        <Link
          to="/kalender"
          className="text-[11px] text-muted-foreground hover:text-wine underline ml-auto self-center"
        >
          bewerken
        </Link>
      </div>
    </article>
  );
}

function ActionBtn({
  busy, onClick, icon, label, variant = "outline",
}: {
  busy: boolean;
  onClick: () => void | Promise<void>;
  icon: React.ReactNode;
  label: string;
  variant?: "outline" | "primary";
}) {
  return (
    <button
      disabled={busy}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-colors border",
        variant === "primary"
          ? "bg-wine text-wine-foreground border-wine hover:bg-wine/90"
          : "border-border/60 text-foreground/70 hover:bg-muted hover:text-foreground",
        busy && "opacity-50 cursor-not-allowed",
      )}
    >
      {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : icon}
      {label}
    </button>
  );
}
