import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ExternalLink, Newspaper, Plus, Save, Trash2, Sparkles, Loader2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useAuth } from "@/lib/auth";
import { fetchBeeNews } from "@/lib/news.functions";

type NewsRow = Database["public"]["Tables"]["news_items"]["Row"];

export const Route = createFileRoute("/nieuws")({
  head: () => ({
    meta: [
      { title: "Nieuws — HappyBeez" },
      { name: "description", content: "Bewaar nieuws en inspiratie voor social posts." },
    ],
  }),
  component: NieuwsPage,
});

function NieuwsPage() {
  return (
    <ProtectedRoute>
      <Nieuws />
    </ProtectedRoute>
  );
}

function Nieuws() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const runFetchNews = useServerFn(fetchBeeNews);
  const [items, setItems] = useState<NewsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fetchingNews, setFetchingNews] = useState(false);
  const [recency, setRecency] = useState<"day" | "week" | "month">("week");
  const [form, setForm] = useState({
    title: "",
    source: "",
    url: "",
    summary: "",
    relevance: "7",
  });

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("news_items")
      .select("*")
      .order("created_at", { ascending: false });
    setLoading(false);
    if (error) return toast.error(error.message);
    setItems((data ?? []) as NewsRow[]);
  }

  async function save() {
    if (!user || !form.title.trim()) return toast.error("Vul een titel in.");
    setSaving(true);
    const { error } = await supabase.from("news_items").insert({
      user_id: user.id,
      title: form.title.trim(),
      source: form.source || null,
      url: form.url || null,
      summary: form.summary || null,
      relevance: Number(form.relevance) || null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    setForm({ title: "", source: "", url: "", summary: "", relevance: "7" });
    toast.success("Nieuwsitem opgeslagen.");
    void load();
  }

  async function remove(id: string) {
    const { error } = await supabase.from("news_items").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Nieuwsitem verwijderd.");
    void load();
  }

  async function toggleUsed(item: NewsRow) {
    const { error } = await supabase
      .from("news_items")
      .update({ used: !item.used })
      .eq("id", item.id);
    if (error) return toast.error(error.message);
    void load();
  }

  async function fetchFromPerplexity() {
    if (!user) return;
    setFetchingNews(true);
    try {
      const { items: newItems } = await runFetchNews({ data: { recency } });
      if (!newItems.length) {
        toast.info("Geen nieuws gevonden.");
        return;
      }
      const existingUrls = new Set(items.map((i) => i.url).filter(Boolean));
      const fresh = newItems.filter((i) => !i.url || !existingUrls.has(i.url));
      if (!fresh.length) {
        toast.info("Niets nieuws — alles staat er al.");
        return;
      }
      const { error } = await supabase.from("news_items").insert(
        fresh.map((i) => ({
          user_id: user.id,
          title: i.title,
          source: i.source,
          url: i.url,
          summary: i.summary,
          relevance: i.relevance,
        })),
      );
      if (error) throw error;
      toast.success(`${fresh.length} nieuwsitems opgehaald.`);
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ophalen mislukt.");
    } finally {
      setFetchingNews(false);
    }
  }

  function makeContent(item: NewsRow) {
    const topic = item.title;
    const keywords = item.summary?.slice(0, 200) ?? "";
    void navigate({
      to: "/content-studio",
      search: { topic, keywords, source: item.url ?? "" } as never,
    });
  }

  return (
    <div className="px-4 py-8 sm:px-8 max-w-6xl mx-auto">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span className="text-xs tracking-[0.2em] uppercase text-muted-foreground font-medium">
            Inspiratie
          </span>
          <h1 className="font-heading font-bold text-ink text-3xl mt-1 ruled-heading">
            Nieuws
          </h1>
        </div>
        <div className="flex items-end gap-2">
          <div className="space-y-1">
            <Label htmlFor="recency" className="text-xs">Periode</Label>
            <select
              id="recency"
              value={recency}
              onChange={(e) => setRecency(e.target.value as "day" | "week" | "month")}
              className="h-9 rounded-md border border-border bg-background px-2 text-sm"
            >
              <option value="day">Laatste 24u</option>
              <option value="week">Afgelopen week</option>
              <option value="month">Afgelopen maand</option>
            </select>
          </div>
          <Button onClick={fetchFromPerplexity} disabled={fetchingNews}>
            {fetchingNews ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {fetchingNews ? "Ophalen…" : "Haal bijennieuws op"}
          </Button>
        </div>
      </div>


      <div className="grid gap-6 lg:grid-cols-[22rem_1fr]">
        <section className="bg-card border border-border rounded-lg p-5 shadow-sm h-fit">
          <h2 className="font-heading text-lg font-semibold text-ink mb-4 flex items-center gap-2">
            <Plus className="h-4 w-4 text-gold" /> Nieuw item
          </h2>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="news-title">Titel</Label>
              <Input id="news-title" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="news-source">Bron</Label>
                <Input id="news-source" value={form.source} onChange={(e) => setForm((p) => ({ ...p, source: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="news-score">Score</Label>
                <Input id="news-score" type="number" min="1" max="10" value={form.relevance} onChange={(e) => setForm((p) => ({ ...p, relevance: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="news-url">Link</Label>
              <Input id="news-url" type="url" value={form.url} onChange={(e) => setForm((p) => ({ ...p, url: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="news-summary">Samenvatting</Label>
              <Textarea id="news-summary" rows={5} value={form.summary} onChange={(e) => setForm((p) => ({ ...p, summary: e.target.value }))} />
            </div>
            <Button onClick={save} disabled={saving} className="w-full">
              <Save className="h-4 w-4" /> {saving ? "Opslaan…" : "Opslaan"}
            </Button>
          </div>
        </section>

        <section className="space-y-3">
          {loading ? (
            <p className="text-sm text-muted-foreground">Nieuws laden…</p>
          ) : items.length === 0 ? (
            <div className="border border-dashed border-border rounded-lg p-8 text-center text-sm text-muted-foreground">
              Nog geen nieuwsitems.
            </div>
          ) : (
            items.map((item) => (
              <article key={item.id} className="bg-card border border-border rounded-lg p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                      <Newspaper className="h-3.5 w-3.5" />
                      <span>{item.source || "Eigen bron"}</span>
                      {item.relevance ? <span>Score {item.relevance}/10</span> : null}
                    </div>
                    <h2 className="font-heading text-xl font-semibold text-ink">{item.title}</h2>
                    {item.summary ? <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{item.summary}</p> : null}
                  </div>
                  <button onClick={() => remove(item.id)} className="text-muted-foreground hover:text-destructive" aria-label="Verwijder nieuwsitem">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => makeContent(item)}>
                    <Wand2 className="h-4 w-4" /> Maak post
                  </Button>
                  <Button size="sm" variant={item.used ? "secondary" : "outline"} onClick={() => toggleUsed(item)}>
                    {item.used ? "Gebruikt" : "Markeer gebruikt"}
                  </Button>
                  {item.url ? (
                    <Button size="sm" variant="outline" asChild>
                      <a href={item.url} target="_blank" rel="noreferrer">
                        <ExternalLink className="h-4 w-4" /> Open bron
                      </a>
                    </Button>
                  ) : null}
                </div>
              </article>
            ))
          )}
        </section>
      </div>
    </div>
  );
}