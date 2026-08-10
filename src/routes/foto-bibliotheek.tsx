import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { BookOpen, Copy, Download, ExternalLink, FolderPlus, Images, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { PhotoUploadButton } from "@/components/PhotoUploadButton";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useAuth } from "@/lib/auth";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { downloadImage } from "@/lib/download";

type Book = Database["public"]["Tables"]["library_books"]["Row"];
type Section = Database["public"]["Tables"]["library_book_sections"]["Row"];
type Photo = Database["public"]["Tables"]["library_photos"]["Row"];
type Folder = Database["public"]["Tables"]["library_folders"]["Row"];

export const Route = createFileRoute("/foto-bibliotheek")({
  head: () => ({
    meta: [
      { title: "Kennisbank & Foto's — Happybeez" },
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
  const [folders, setFolders] = useState<Folder[]>([]);
  const [activeFolder, setActiveFolder] = useState<string | "all" | "none">("all");
  const [newFolder, setNewFolder] = useState("");
  const { currentOrgId } = useCurrentOrg();
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    const [b, s, p, f] = await Promise.all([
      supabase.from("library_books").select("*"),
      supabase
        .from("library_book_sections")
        .select("*")
        .order("section_number", { ascending: true }),
      supabase
        .from("library_photos")
        .select("*")
        .order("created_at", { ascending: true }),
      supabase.from("library_folders").select("*").order("name", { ascending: true }),
    ]);
    setLoading(false);
    if (b.error || s.error || p.error) {
      toast.error(
        b.error?.message ?? s.error?.message ?? p.error?.message ?? "Fout bij laden",
      );
      return;
    }
    const photoRows = (p.data ?? []) as Photo[];
    setFolders((f.data ?? []) as Folder[]);
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
    const q = query.trim().toLowerCase();
    return photos.filter((p) => {
      if (activeFolder === "none" && p.folder_id) return false;
      if (activeFolder !== "all" && activeFolder !== "none" && p.folder_id !== activeFolder)
        return false;
      if (!q) return true;
      return (
        p.title.toLowerCase().includes(q) ||
        (p.caption ?? "").toLowerCase().includes(q) ||
        p.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [photos, query, activeFolder]);

  async function createFolder() {
    const name = newFolder.trim();
    if (!name) return;
    if (!currentOrgId) return toast.error("Geen organisatie gekozen.");
    const { error } = await supabase
      .from("library_folders")
      .insert({ org_id: currentOrgId, name });
    if (error) return toast.error(error.message);
    setNewFolder("");
    toast.success(`Mapje "${name}" aangemaakt.`);
    void load();
  }

  async function deleteFolder(folder: Folder) {
    if (!window.confirm(`Mapje "${folder.name}" verwijderen? De foto's blijven bestaan.`)) return;
    const { error } = await supabase.from("library_folders").delete().eq("id", folder.id);
    if (error) return toast.error(error.message);
    if (activeFolder === folder.id) setActiveFolder("all");
    toast.success("Mapje verwijderd.");
    void load();
  }

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
              automatisch een licht <span className="font-semibold text-ink">Happybeez</span>-watermerk
              rechtsonder toegevoegd voordat de foto wordt opgeslagen.
            </div>
            <PhotoUploadButton
              folderId={activeFolder !== "all" && activeFolder !== "none" ? activeFolder : null}
              onUploaded={() => void load()}
            />
          </div>
          <div className="mb-4 rounded-lg border border-border bg-card px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <FolderChip
                active={activeFolder === "all"}
                label={`Alle foto's (${photos.length})`}
                onClick={() => setActiveFolder("all")}
              />
              <FolderChip
                active={activeFolder === "none"}
                label={`Zonder mapje (${photos.filter((p) => !p.folder_id).length})`}
                onClick={() => setActiveFolder("none")}
              />
              {folders.map((f) => (
                <FolderChip
                  key={f.id}
                  active={activeFolder === f.id}
                  label={`${f.name} (${photos.filter((p) => p.folder_id === f.id).length})`}
                  onClick={() => setActiveFolder(f.id)}
                  onDelete={() => void deleteFolder(f)}
                />
              ))}
            </div>
            <div className="mt-3 flex items-center gap-2 max-w-sm">
              <Input
                value={newFolder}
                onChange={(e) => setNewFolder(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void createFolder();
                }}
                placeholder="Naam nieuw mapje…"
                className="h-9"
              />
              <Button size="sm" variant="outline" onClick={() => void createFolder()}>
                <FolderPlus className="h-4 w-4" /> Mapje
              </Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Kies eerst een mapje, dan komen nieuwe uploads daar automatisch in terecht.
            </p>
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
                  folders={folders}
                  onDeleted={() => void load()}
                  displayUrl={
                    (photo.storage_path && signedUrls[photo.storage_path]) ||
                    photo.image_url ||
                    ""
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

function FolderChip({
  label,
  active,
  onClick,
  onDelete,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  onDelete?: () => void;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs ${
        active ? "border-transparent bg-primary text-primary-foreground" : "border-border bg-background"
      }`}
    >
      <button type="button" onClick={onClick} className="font-medium">
        {label}
      </button>
      {onDelete ? (
        <button
          type="button"
          onClick={onDelete}
          title="Mapje verwijderen"
          className="opacity-60 hover:opacity-100"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      ) : null}
    </span>
  );
}

function PhotoCard({
  photo,
  displayUrl,
  folders,
  onDeleted,
}: {
  photo: Photo;
  displayUrl: string;
  folders: Folder[];
  onDeleted: () => void;
}) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function removePhoto() {
    if (!window.confirm(`Foto "${photo.title}" definitief verwijderen?`)) return;
    setDeleting(true);
    if (photo.storage_path) {
      await supabase.storage.from("library-photos").remove([photo.storage_path]);
    }
    const { error } = await supabase.from("library_photos").delete().eq("id", photo.id);
    setDeleting(false);
    if (error) return toast.error(error.message);
    toast.success("Foto verwijderd.");
    onDeleted();
  }

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
      content_type: "behind_scenes",
      status: "draft",
      notes: `Foto: ${displayUrl}\nBron: ${photo.credit ?? ""}`,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Toegevoegd aan kalender als idee.");
  }

  return (
    <article className="bg-card border border-border rounded-lg overflow-hidden shadow-sm flex flex-col">
      {displayUrl ? (
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
      ) : (
        <div className="block aspect-[4/3] bg-muted flex items-center justify-center text-xs text-muted-foreground">
          Foto laden…
        </div>
      )}
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
        <select
          value={photo.folder_id ?? ""}
          onChange={async (e) => {
            const value = e.target.value || null;
            const { error } = await supabase
              .from("library_photos")
              .update({ folder_id: value })
              .eq("id", photo.id);
            if (error) return toast.error(error.message);
            toast.success("Mapje bijgewerkt.");
            onDeleted();
          }}
          className="h-8 rounded-md border border-border bg-background px-2 text-xs"
        >
          <option value="">Geen mapje</option>
          {folders.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
        <div className="flex gap-2 mt-auto pt-2">
          <Button
            size="sm"
            variant="outline"
            onClick={copyUrl}
            className="flex-1"
            disabled={!displayUrl}
          >
            <Copy className="h-3 w-3" /> URL
          </Button>
          {displayUrl ? (
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                try {
                  await downloadImage(displayUrl, photo.title || "foto");
                  toast.success("Afbeelding gedownload.");
                } catch {
                  toast.info(
                    "Afbeelding geopend in nieuw tabblad — rechtsklik en 'Afbeelding opslaan als'.",
                  );
                }
              }}
            >
              <Download className="h-3 w-3" />
            </Button>
          ) : (
            <Button size="sm" variant="outline" disabled>
              <Download className="h-3 w-3" />
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={removePhoto}
            disabled={deleting}
            title="Foto verwijderen uit de bibliotheek"
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
          <Button
            size="sm"
            onClick={addToCalendar}
            disabled={saving}
            className="flex-1"
            title="Voeg deze foto als concept-item toe aan de content-kalender"
          >
            + Kalender
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
