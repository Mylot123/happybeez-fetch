import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Film, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { listVideoTemplates, renderVideo } from "@/lib/video.functions";

export const Route = createFileRoute("/videostudio")({
  head: () => ({
    meta: [
      { title: "Videostudio — SocialMotor" },
      { name: "description", content: "Genereer video's op basis van bureau-templates via Creatomate." },
    ],
  }),
  component: () => (
    <ProtectedRoute>
      <VideoStudio />
    </ProtectedRoute>
  ),
});

type Template = {
  id: string;
  name: string;
  description: string | null;
  thumbnail_url: string | null;
  aspect_ratio: string;
  variables_schema: unknown;
};

function VideoStudio() {
  const { currentOrgId } = useCurrentOrg();
  const listTpl = useServerFn(listVideoTemplates);
  const render = useServerFn(renderVideo);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["video-templates"],
    queryFn: () => listTpl(),
  });

  const { data: recent = [] } = useQuery({
    queryKey: ["media-videos", currentOrgId],
    enabled: !!currentOrgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("media_assets")
        .select("id, url, render_status, template_id, created_at, meta")
        .eq("org_id", currentOrgId!)
        .eq("type", "video")
        .order("created_at", { ascending: false })
        .limit(12);
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 8000,
  });

  const [active, setActive] = useState<Template | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});

  const mutation = useMutation({
    mutationFn: async () => {
      if (!currentOrgId || !active) throw new Error("Geen org of template.");
      return render({
        data: { org_id: currentOrgId, template_id: active.id, variables: values },
      });
    },
    onSuccess: () => {
      toast.success("Render gestart — verschijnt hieronder zodra klaar.");
      setActive(null);
      setValues({});
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Render mislukt"),
  });

  const varSchema: Array<{ key: string; label?: string }> = Array.isArray(
    active?.variables_schema,
  )
    ? (active!.variables_schema as any)
    : [];

  return (
    <div className="px-4 sm:px-8 py-8 max-w-6xl mx-auto">
      <div className="mb-6">
        <span className="text-xs tracking-[0.2em] uppercase text-muted-foreground font-medium">
          Media
        </span>
        <h1 className="font-heading font-bold text-ink text-3xl mt-1 ruled-heading">
          Videostudio
        </h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
          Kies een bureau-template en vul de variabelen in — Creatomate rendert de video en meldt
          hem hier terug.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="w-4 h-4 animate-spin" /> Templates laden…
        </div>
      ) : templates.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Nog geen video-templates geconfigureerd. Voeg templates toe in de video_templates-tabel
          (agency-breed).
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((t: Template) => (
            <button
              key={t.id}
              onClick={() => {
                setActive(t);
                setValues({});
              }}
              className="text-left bg-card border border-border rounded-lg overflow-hidden hover:border-wine transition-colors group"
            >
              <div className="aspect-video bg-muted flex items-center justify-center">
                {t.thumbnail_url ? (
                  <img src={t.thumbnail_url} alt={t.name} className="w-full h-full object-cover" />
                ) : (
                  <Film className="w-8 h-8 text-muted-foreground" />
                )}
              </div>
              <div className="p-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-ink text-sm">{t.name}</h3>
                  <span className="text-[10px] text-muted-foreground">{t.aspect_ratio}</span>
                </div>
                {t.description && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {t.description}
                  </p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {active && (
        <div
          className="fixed inset-0 z-40 bg-ink/40 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setActive(null)}
        >
          <div
            className="bg-card rounded-lg border border-border max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-heading text-xl font-bold text-ink mb-1">{active.name}</h2>
            <p className="text-xs text-muted-foreground mb-4">
              {active.aspect_ratio} • vul variabelen in
            </p>
            <div className="space-y-3">
              {varSchema.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Geen variabelen — druk direct op Render.
                </p>
              )}
              {varSchema.map((v) => (
                <div key={v.key}>
                  <Label className="text-xs">{v.label ?? v.key}</Label>
                  <Input
                    value={values[v.key] ?? ""}
                    onChange={(e) =>
                      setValues((p) => ({ ...p, [v.key]: e.target.value }))
                    }
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <Button variant="ghost" onClick={() => setActive(null)}>
                Annuleer
              </Button>
              <Button
                className="bg-wine text-primary-foreground hover:bg-wine/90"
                onClick={() => mutation.mutate()}
                disabled={mutation.isPending}
              >
                {mutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Play className="w-4 h-4 mr-2" />
                )}
                Render video
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-10">
        <h2 className="font-heading text-lg font-semibold text-ink mb-3">Recent gerenderd</h2>
        {recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nog geen video's gerenderd voor deze organisatie.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {recent.map((a: any) => (
              <div key={a.id} className="bg-card border border-border rounded-md overflow-hidden">
                <div className="aspect-video bg-muted flex items-center justify-center">
                  {a.render_status === "ready" && a.url ? (
                    <video src={a.url} controls className="w-full h-full object-cover" />
                  ) : a.render_status === "failed" ? (
                    <span className="text-xs text-destructive">Mislukt</span>
                  ) : (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin" /> Renderen…
                    </div>
                  )}
                </div>
                <div className="p-2 text-[10px] text-muted-foreground">
                  {new Date(a.created_at).toLocaleString("nl-NL")}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
