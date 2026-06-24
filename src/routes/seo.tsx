import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, Save, Search, Trash2, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useAuth } from "@/lib/auth";

type SeoRow = Database["public"]["Tables"]["seo_keywords"]["Row"];

export const Route = createFileRoute("/seo")({
  head: () => ({
    meta: [
      { title: "SEO & Ranking — HappyBeez" },
      { name: "description", content: "Volg SEO-keywords, ranking en contentkansen." },
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

function Seo() {
  const { user } = useAuth();
  const [items, setItems] = useState<SeoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ keyword: "", current_rank: "", search_volume: "", difficulty: "", notes: "" });

  useEffect(() => {
    void load();
  }, []);

  const stats = useMemo(() => {
    const ranked = items.filter((i) => i.current_rank != null);
    const avgRank = ranked.length
      ? Math.round(ranked.reduce((sum, i) => sum + (i.current_rank ?? 0), 0) / ranked.length)
      : null;
    const totalVolume = items.reduce((sum, i) => sum + (i.search_volume ?? 0), 0);
    return { avgRank, totalVolume };
  }, [items]);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("seo_keywords")
      .select("*")
      .order("created_at", { ascending: false });
    setLoading(false);
    if (error) return toast.error(error.message);
    setItems((data ?? []) as SeoRow[]);
  }

  async function save() {
    if (!user || !form.keyword.trim()) return toast.error("Vul een keyword in.");
    setSaving(true);
    const { error } = await supabase.from("seo_keywords").insert({
      user_id: user.id,
      keyword: form.keyword.trim(),
      current_rank: form.current_rank ? Number(form.current_rank) : null,
      search_volume: form.search_volume ? Number(form.search_volume) : null,
      difficulty: form.difficulty ? Number(form.difficulty) : null,
      notes: form.notes || null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    setForm({ keyword: "", current_rank: "", search_volume: "", difficulty: "", notes: "" });
    toast.success("Keyword opgeslagen.");
    void load();
  }

  async function remove(id: string) {
    const { error } = await supabase.from("seo_keywords").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Keyword verwijderd.");
    void load();
  }

  return (
    <div className="px-4 py-8 sm:px-8 max-w-6xl mx-auto">
      <div className="mb-6">
        <span className="text-xs tracking-[0.2em] uppercase text-muted-foreground font-medium">
          Vindbaarheid
        </span>
        <h1 className="font-heading font-bold text-ink text-3xl mt-1 ruled-heading">
          SEO & Ranking
        </h1>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 mb-6">
        <div className="bg-card border border-border rounded-lg p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-md bg-wine/10 text-wine flex items-center justify-center">
              <Search className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Keywords</p>
              <p className="font-heading text-3xl font-semibold text-ink">{items.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-card border border-border rounded-lg p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-md bg-secondary text-foreground flex items-center justify-center">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Gem. rank / volume</p>
              <p className="font-heading text-3xl font-semibold text-ink">{stats.avgRank ?? "—"} / {stats.totalVolume}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[22rem_1fr]">
        <section className="bg-card border border-border rounded-lg p-5 shadow-sm h-fit">
          <h2 className="font-heading text-lg font-semibold text-ink mb-4 flex items-center gap-2">
            <Plus className="h-4 w-4 text-gold" /> Keyword toevoegen
          </h2>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="seo-keyword">Keyword</Label>
              <Input id="seo-keyword" value={form.keyword} onChange={(e) => setForm((p) => ({ ...p, keyword: e.target.value }))} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label htmlFor="seo-rank">Rank</Label>
                <Input id="seo-rank" type="number" value={form.current_rank} onChange={(e) => setForm((p) => ({ ...p, current_rank: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="seo-volume">Volume</Label>
                <Input id="seo-volume" type="number" value={form.search_volume} onChange={(e) => setForm((p) => ({ ...p, search_volume: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="seo-difficulty">KD</Label>
                <Input id="seo-difficulty" type="number" value={form.difficulty} onChange={(e) => setForm((p) => ({ ...p, difficulty: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="seo-notes">Notities</Label>
              <Textarea id="seo-notes" rows={5} value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} />
            </div>
            <Button onClick={save} disabled={saving} className="w-full">
              <Save className="h-4 w-4" /> {saving ? "Opslaan…" : "Opslaan"}
            </Button>
          </div>
        </section>

        <section className="bg-card border border-border rounded-lg shadow-sm overflow-hidden">
          {loading ? (
            <p className="p-5 text-sm text-muted-foreground">Keywords laden…</p>
          ) : items.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Nog geen SEO-keywords.</div>
          ) : (
            <div className="divide-y divide-border">
              {items.map((item) => (
                <div key={item.id} className="p-5 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h2 className="font-heading text-xl font-semibold text-ink">{item.keyword}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Rank {item.current_rank ?? "—"} · Volume {item.search_volume ?? "—"} · KD {item.difficulty ?? "—"}
                    </p>
                    {item.notes ? <p className="mt-2 text-sm text-foreground/75">{item.notes}</p> : null}
                  </div>
                  <button onClick={() => remove(item.id)} className="text-muted-foreground hover:text-destructive" aria-label="Verwijder keyword">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}