import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { BookOpen, Copy, Plus, Save, Trash2, Search, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useAuth } from "@/lib/auth";
import { askBook } from "@/lib/book.functions";

type BookRow = Database["public"]["Tables"]["book_contents"]["Row"];
type AskSource = {
  id: string;
  title: string;
  snippet: string;
  page: number | null;
  chapter: string | null;
  origin: string;
};


export const Route = createFileRoute("/boek")({
  head: () => ({
    meta: [
      { title: "Boekbibliotheek — HappyBeez" },
      { name: "description", content: "Citaten, fragmenten en boekcontent voor social media." },
    ],
  }),
  component: BoekPage,
});

function BoekPage() {
  return (
    <ProtectedRoute>
      <Boekbibliotheek />
    </ProtectedRoute>
  );
}

function Boekbibliotheek() {
  const { user } = useAuth();
  const ask = useServerFn(askBook);
  const [items, setItems] = useState<BookRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [answer, setAnswer] = useState<string>("");
  const [sources, setSources] = useState<AskSource[]>([]);
  const [form, setForm] = useState({
    title: "",
    type: "citaat",
    chapter: "",
    page_number: "",
    tags: "",
    content: "",
  });

  useEffect(() => {
    void load();
  }, []);

  async function runAsk() {
    if (!question.trim() || asking) return;
    setAsking(true);
    setAnswer("");
    setSources([]);
    try {
      const res = await ask({ data: { question: question.trim() } });
      setAnswer(res.answer);
      setSources(res.sources);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Zoekfout");
    } finally {
      setAsking(false);
    }
  }


  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("book_contents")
      .select("*")
      .order("created_at", { ascending: false });
    setLoading(false);
    if (error) return toast.error(error.message);
    setItems((data ?? []) as BookRow[]);
  }

  async function save() {
    if (!user || !form.title.trim() || !form.content.trim()) {
      return toast.error("Vul titel en content in.");
    }
    setSaving(true);
    const { error } = await supabase.from("book_contents").insert({
      user_id: user.id,
      title: form.title.trim(),
      type: form.type,
      chapter: form.chapter || null,
      page_number: form.page_number ? Number(form.page_number) : null,
      tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
      suggested_channels: ["instagram", "linkedin"],
      content: form.content.trim(),
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    setForm({ title: "", type: "citaat", chapter: "", page_number: "", tags: "", content: "" });
    toast.success("Boekfragment opgeslagen.");
    void load();
  }

  async function remove(id: string) {
    const { error } = await supabase.from("book_contents").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Fragment verwijderd.");
    void load();
  }

  async function copyText(text: string) {
    await navigator.clipboard.writeText(text);
    toast.success("Gekopieerd.");
  }

  return (
    <div className="px-4 py-8 sm:px-8 max-w-6xl mx-auto">
      <div className="mb-6">
        <span className="text-xs tracking-[0.2em] uppercase text-muted-foreground font-medium">
          Bronnen
        </span>
        <h1 className="font-heading font-bold text-ink text-3xl mt-1 ruled-heading">
          Boekbibliotheek
        </h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-[22rem_1fr]">
        <section className="bg-card border border-border rounded-lg p-5 shadow-sm h-fit">
          <h2 className="font-heading text-lg font-semibold text-ink mb-4 flex items-center gap-2">
            <Plus className="h-4 w-4 text-gold" /> Fragment toevoegen
          </h2>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="book-title">Titel</Label>
              <Input id="book-title" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="book-type">Type</Label>
                <Input id="book-type" value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="book-page">Pagina</Label>
                <Input id="book-page" type="number" value={form.page_number} onChange={(e) => setForm((p) => ({ ...p, page_number: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="book-chapter">Hoofdstuk</Label>
              <Input id="book-chapter" value={form.chapter} onChange={(e) => setForm((p) => ({ ...p, chapter: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="book-tags">Tags</Label>
              <Input id="book-tags" value={form.tags} onChange={(e) => setForm((p) => ({ ...p, tags: e.target.value }))} placeholder="bijen, biodiversiteit" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="book-content">Content</Label>
              <Textarea id="book-content" rows={7} value={form.content} onChange={(e) => setForm((p) => ({ ...p, content: e.target.value }))} />
            </div>
            <Button onClick={save} disabled={saving} className="w-full">
              <Save className="h-4 w-4" /> {saving ? "Opslaan…" : "Opslaan"}
            </Button>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          {loading ? (
            <p className="text-sm text-muted-foreground">Bibliotheek laden…</p>
          ) : items.length === 0 ? (
            <div className="sm:col-span-2 border border-dashed border-border rounded-lg p-8 text-center text-sm text-muted-foreground">
              Nog geen boekfragmenten.
            </div>
          ) : (
            items.map((item) => (
              <article key={item.id} className="bg-card border border-border rounded-lg p-5 shadow-sm flex flex-col gap-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                      <BookOpen className="h-3.5 w-3.5" />
                      <span>{item.type}</span>
                      {item.page_number ? <span>p. {item.page_number}</span> : null}
                    </div>
                    <h2 className="font-heading text-xl font-semibold text-ink">{item.title}</h2>
                    {item.chapter ? <p className="text-xs text-muted-foreground mt-1">{item.chapter}</p> : null}
                  </div>
                  <button onClick={() => remove(item.id)} className="text-muted-foreground hover:text-destructive" aria-label="Verwijder fragment">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <p className="text-sm leading-relaxed text-foreground/80 whitespace-pre-line">{item.content}</p>
                <div className="flex flex-wrap gap-2 mt-auto">
                  {item.tags.map((tag) => (
                    <span key={tag} className="rounded-sm bg-secondary px-2 py-1 text-xs text-secondary-foreground">{tag}</span>
                  ))}
                </div>
                <Button size="sm" variant="outline" onClick={() => copyText(item.content)}>
                  <Copy className="h-4 w-4" /> Kopieer
                </Button>
              </article>
            ))
          )}
        </section>
      </div>
    </div>
  );
}