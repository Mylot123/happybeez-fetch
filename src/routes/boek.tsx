import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
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

      {/* Google-stijl Q&A zoekbalk */}
      <div className="mb-8 bg-card border border-border rounded-2xl p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="h-4 w-4 text-gold" />
          <h2 className="font-heading text-lg font-semibold text-ink">Vraag het de boekbibliotheek</h2>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Antwoorden komen uit de inhoud van de boeken en fragmenten in deze bibliotheek. Inclusief bronvermelding.
        </p>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void runAsk(); }}
              placeholder="Bijv: welke nestgangdiameters zijn ideaal voor metselbijen?"
              className="pl-9 h-11 rounded-full"
            />
          </div>
          <Button onClick={runAsk} disabled={asking || !question.trim()} className="rounded-full h-11 px-5">
            {asking ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Zoeken…</> : <>Zoek</>}
          </Button>
        </div>

        {(answer || sources.length > 0) && (
          <div className="mt-5 space-y-4">
            {answer && (
              <div className="rounded-xl bg-secondary/50 border border-border p-4">
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Antwoord</div>
                <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground">{answer}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      const keywords = sources.slice(0, 3).map((s) => s.title).join(", ");
                      const source = `Boekbibliotheek — vraag: ${question}\n\n${answer}\n\nBronnen:\n${sources
                        .map((s, i) => `[${i + 1}] ${s.title}${s.page ? ` (p. ${s.page})` : ""}: ${s.snippet.slice(0, 240)}`)
                        .join("\n")}`;
                      navigate({
                        to: "/content-studio",
                        search: { topic: question, keywords, source },
                      });
                    }}
                  >
                    <Sparkles className="h-4 w-4" /> Maak post van dit antwoord
                  </Button>
                </div>
              </div>
            )}
            {sources.length > 0 && (
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Bronnen</div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {sources.map((s, i) => (
                    <div key={s.id} className="rounded-lg border border-border p-3 text-xs bg-background">
                      <div className="flex items-center gap-1 font-semibold text-ink mb-1">
                        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-gold/20 text-[10px] text-ink">{i + 1}</span>
                        <span className="truncate">{s.title}</span>
                        {s.page ? <span className="text-muted-foreground font-normal">· p. {s.page}</span> : null}
                      </div>
                      <p className="text-muted-foreground line-clamp-4">{s.snippet}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>



      <div>
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