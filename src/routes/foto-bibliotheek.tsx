import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { BookOpen, Copy, Download, ExternalLink, Images, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { PhotoUploadButton } from "@/components/PhotoUploadButton";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useAuth } from "@/lib/auth";

type Book = Database["public"]["Tables"]["library_books"]["Row"];
type Section = Database["public"]["Tables"]["library_book_sections"]["Row"];
type Photo = Database["public"]["Tables"]["library_photos"]["Row"];

export const Route = createFileRoute("/foto-bibliotheek")({
  head: () => ({
    meta: [
      { title: "Kennisbank & Foto's — HappyBeez" },
      {
        name: "description",
        content:
          "Gedeelde fotobibliotheek en boekkennis voor je social content over bijen en bijenhotels.",
      },
    ],
  }),
  component: KennisbankPage,
});

function KennisbankPage() {
  return (
    <ProtectedRoute>
      <Kennisbank />
    </ProtectedRoute>
  );
}

function Kennisbank() {
  const [books, setBooks] = useState<Book[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    const [b, s, p] = await Promise.all([
      supabase.from("library_books").select("*"),
      supabase
        .from("library_book_sections")
        .select("*")
        .order("section_number", { ascending: true }),
      supabase
        .from("library_photos")
        .select("*")
        .order("created_at", { ascending: true }),
    ]);
    setLoading(false);
    if (b.error || s.error || p.error) {
      toast.error(
        b.error?.message ?? s.error?.message ?? p.error?.message ?? "Fout bij laden",
      );
      return;
    }
    const photoRows = (p.data ?? []) as Photo[];
    setBooks((b.data ?? []) as Book[]);
    setSections((s.data ?? []) as Section[]);
    setPhotos(photoRows);

    const paths = photoRows
      .map((row) => row.storage_path)
      .filter((path): path is string => Boolean(path));
    if (paths.length > 0) {
      const { data: signed, error: signErr } = await supabase.storage
        .from("library-photos")
        .createSignedUrls(paths, 60 * 60 * 8);
      if (signErr) {
        toast.error(`Foto-URL's konden niet worden opgehaald: ${signErr.message}`);
      } else if (signed) {
        const map: Record<string, string> = {};
        signed.forEach((entry, i) => {
          const path = paths[i];
          if (path && entry.signedUrl) map[path] = entry.signedUrl;
        });
        setSignedUrls(map);
      }
    }
  }

  const filteredPhotos = useMemo(() => {
    if (!query.trim()) return photos;
    const q = query.toLowerCase();
    return photos.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        (p.caption ?? "").toLowerCase().includes(q) ||
        p.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }, [photos, query]);

  const filteredSections = useMemo(() => {
    if (!query.trim()) return sections;
    const q = query.toLowerCase();
    return sections.filter(
      (s) => s.title.toLowerCase().includes(q) || s.content.toLowerCase().includes(q),
    );
  }, [sections, query]);

  return (
    <div className="px-4 py-8 sm:px-8 max-w-6xl mx-auto">
      <div className="mb-6">
        <span className="text-xs tracking-[0.2em] uppercase text-muted-foreground font-medium">
          Kennisbank
        </span>
        <h1 className="font-heading font-bold text-ink text-3xl mt-1 ruled-heading">
          Foto's &amp; gedeelde boeken
        </h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
          Gedeelde bronnen die door iedereen in het team gebruikt mogen worden voor
          social media posts. Foto's en boekfragmenten uit{" "}
          <em>Gasten van bijenhotels</em> (P. van Breugel, 2023).
        </p>
      </div>

      <div className="mb-5 relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Zoek op tag, hoofdstuk of trefwoord…"
          className="pl-9"
        />
      </div>

      <Tabs defaultValue="photos" className="w-full">
        <TabsList>
          <TabsTrigger value="photos">
            <Images className="h-4 w-4" /> Foto's ({photos.length})
          </TabsTrigger>
          <TabsTrigger value="book">
            <BookOpen className="h-4 w-4" /> Boek ({sections.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="photos" className="mt-5">
          <div className="mb-4 flex items-center justify-between gap-3 flex-wrap rounded-lg border border-border bg-card px-4 py-3">
            <div className="text-xs text-muted-foreground max-w-xl">
              Upload je eigen foto's naar de gedeelde bibliotheek. Er wordt
              automatisch een licht <span className="font-semibold text-ink">HappyBeez</span>-watermerk
              rechtsonder toegevoegd voordat de foto wordt opgeslagen.
            </div>
            <PhotoUploadButton onUploaded={() => void load()} />
          </div>
          {loading ? (
            <p className="text-sm text-muted-foreground">Foto's laden…</p>
          ) : filteredPhotos.length === 0 ? (
            <div className="border border-dashed border-border rounded-lg p-8 text-center text-sm text-muted-foreground">
              Geen foto's gevonden.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
              {filteredPhotos.map((photo) => (
                <PhotoCard
                  key={photo.id}
                  photo={photo}
                  displayUrl={
                    (photo.storage_path && signedUrls[photo.storage_path]) ||
                    photo.image_url
                  }
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="book" className="mt-5">
          {books[0] ? (
            <div className="mb-5 bg-card border border-border rounded-lg p-5 shadow-sm">
              <h2 className="font-heading text-lg font-semibold text-ink">
                {books[0].title}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {books[0].author} · {books[0].year}
              </p>
              {books[0].description ? (
                <p className="text-sm mt-3 leading-relaxed">{books[0].description}</p>
              ) : null}
              {books[0].source_url ? (
                <a
                  href={books[0].source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-wine font-medium mt-3"
                >
                  <ExternalLink className="h-3 w-3" /> Bron-PDF openen
                </a>
              ) : null}
            </div>
          ) : null}

          {loading ? (
            <p className="text-sm text-muted-foreground">Hoofdstukken laden…</p>
          ) : filteredSections.length === 0 ? (
            <div className="border border-dashed border-border rounded-lg p-8 text-center text-sm text-muted-foreground">
              Geen hoofdstukken gevonden.
            </div>
          ) : (
            <div className="space-y-3">
              {filteredSections.map((s) => (
                <SectionCard key={s.id} section={s} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PhotoCard({ photo, displayUrl }: { photo: Photo; displayUrl: string }) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);

  async function copyUrl() {
    await navigator.clipboard.writeText(displayUrl);
    toast.success("URL gekopieerd.");
  }

  async function addToCalendar() {
    if (!user) return toast.error("Log eerst in.");
    setSaving(true);
    const { error } = await supabase.from("content_calendar_items").insert({
      user_id: user.id,
      title: photo.title,
      channel: "instagram",
      content_type: "foto",
      status: "idee",
      notes: `Foto: ${displayUrl}\nBron: ${photo.credit ?? ""}`,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Toegevoegd aan kalender als idee.");
  }

  return (
    <article className="bg-card border border-border rounded-lg overflow-hidden shadow-sm flex flex-col">
      <a
        href={displayUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block aspect-[4/3] bg-muted overflow-hidden"
      >
        <img
          src={displayUrl}
          alt={photo.title}
          loading="lazy"
          className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
        />
      </a>
      <div className="p-3 flex flex-col gap-2 flex-1">
        <h3 className="font-heading text-sm font-semibold text-ink">{photo.title}</h3>
        {photo.caption ? (
          <p className="text-xs text-muted-foreground line-clamp-2">{photo.caption}</p>
        ) : null}
        <div className="flex flex-wrap gap-1">
          {photo.tags.slice(0, 3).map((t) => (
            <span
              key={t}
              className="rounded-sm bg-secondary px-1.5 py-0.5 text-[10px] text-secondary-foreground"
            >
              {t}
            </span>
          ))}
        </div>
        <div className="flex gap-2 mt-auto pt-2">
          <Button size="sm" variant="outline" onClick={copyUrl} className="flex-1">
            <Copy className="h-3 w-3" /> URL
          </Button>
          <Button size="sm" variant="outline" asChild>
            <a href={displayUrl} download>
              <Download className="h-3 w-3" />
            </a>
          </Button>
          <Button size="sm" onClick={addToCalendar} disabled={saving} className="flex-1">
            +Kal
          </Button>
        </div>
      </div>
    </article>
  );
}

function SectionCard({ section }: { section: Section }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  async function copyContent() {
    await navigator.clipboard.writeText(section.content);
    toast.success("Tekst gekopieerd.");
  }

  async function addToOwnLibrary() {
    if (!user) return toast.error("Log eerst in.");
    setSaving(true);
    const { error } = await supabase.from("book_contents").insert({
      user_id: user.id,
      title: section.title,
      type: "hoofdstuk",
      chapter: `Hoofdstuk ${section.section_number}`,
      page_number: section.page_start,
      tags: ["bijen", "bijenhotel"],
      suggested_channels: ["instagram", "facebook"],
      content: section.content,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Toegevoegd aan jouw boekbibliotheek.");
  }

  return (
    <article className="bg-card border border-border rounded-lg p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs text-muted-foreground mb-1">
            {section.section_number > 0
              ? `Hoofdstuk ${section.section_number}`
              : "Inleiding"}
            {section.page_start ? ` · p. ${section.page_start}` : ""}
          </div>
          <h3 className="font-heading text-lg font-semibold text-ink">
            {section.title}
          </h3>
        </div>
        <button
          onClick={() => setOpen((o) => !o)}
          className="text-xs text-wine font-medium underline-offset-2 hover:underline"
        >
          {open ? "Inklappen" : "Lezen"}
        </button>
      </div>

      {open ? (
        <>
          <p className="text-sm leading-relaxed text-foreground/80 whitespace-pre-line mt-3">
            {section.content}
          </p>
          <div className="flex gap-2 mt-4">
            <Button size="sm" variant="outline" onClick={copyContent}>
              <Copy className="h-4 w-4" /> Kopieer
            </Button>
            <Button size="sm" onClick={addToOwnLibrary} disabled={saving}>
              <BookOpen className="h-4 w-4" /> Naar mijn boekbib
            </Button>
          </div>
        </>
      ) : (
        <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
          {section.content.slice(0, 220)}…
        </p>
      )}
    </article>
  );
}
