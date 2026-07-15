import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ingestBook } from "@/lib/library.functions";

type Chunk = {
  section_number: number;
  title: string;
  content: string;
  page_start: number | null;
};

function chunkPageText(pageText: string, page: number, startIndex: number): Chunk[] {
  const clean = pageText.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  const MAX = 1500;
  const chunks: Chunk[] = [];
  let i = 0;
  let n = 0;
  while (i < clean.length) {
    let end = Math.min(i + MAX, clean.length);
    if (end < clean.length) {
      // try to break on sentence
      const dot = clean.lastIndexOf(". ", end);
      if (dot > i + 500) end = dot + 1;
    }
    const slice = clean.slice(i, end).trim();
    const first = slice.split(/[.!?]/)[0].slice(0, 120);
    chunks.push({
      section_number: startIndex + n,
      title: `p.${page} — ${first || "fragment"}`,
      content: slice,
      page_start: page,
    });
    i = end;
    n += 1;
  }
  return chunks;
}

export function BookPdfUpload({ onDone }: { onDone?: () => void }) {
  const ingest = useServerFn(ingestBook);
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [year, setYear] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string>("");

  async function extractPdf(f: File): Promise<Chunk[]> {
    setProgress("PDF laden…");
    const pdfjs = await import("pdfjs-dist");
    // Use worker as URL (Vite handles this)
    const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
    (pdfjs as unknown as { GlobalWorkerOptions: { workerSrc: string } }).GlobalWorkerOptions.workerSrc = workerUrl;
    const buf = await f.arrayBuffer();
    const doc = await pdfjs.getDocument({ data: buf }).promise;
    const all: Chunk[] = [];
    let counter = 0;
    for (let p = 1; p <= doc.numPages; p++) {
      setProgress(`Pagina ${p} / ${doc.numPages} lezen…`);
      const page = await doc.getPage(p);
      const text = await page.getTextContent();
      const str = text.items
        .map((it) => ("str" in it ? (it as { str: string }).str : ""))
        .join(" ");
      const cs = chunkPageText(str, p, counter);
      counter += cs.length;
      all.push(...cs);
    }
    return all;
  }

  async function handleUpload() {
    if (!file || !title.trim()) {
      toast.error("Kies een PDF en geef een titel op.");
      return;
    }
    setBusy(true);
    try {
      const chunks = await extractPdf(file);
      if (chunks.length === 0) {
        toast.error("Geen tekst in PDF gevonden (mogelijk een gescande PDF zonder OCR).");
        return;
      }
      setProgress(`${chunks.length} fragmenten opslaan…`);
      const res = await ingest({
        data: {
          title: title.trim(),
          author: author.trim() || undefined,
          year: year ? Number(year) : undefined,
          chunks,
        },
      });
      toast.success(`Boek geüpload: ${res.inserted} fragmenten.`);
      setFile(null);
      setTitle("");
      setAuthor("");
      setYear("");
      if (inputRef.current) inputRef.current.value = "";
      onDone?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload mislukt.");
    } finally {
      setBusy(false);
      setProgress("");
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <Upload className="h-4 w-4 text-gold" />
        <h2 className="font-heading text-lg font-semibold text-ink">Boek uploaden (PDF)</h2>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        De tekst wordt per pagina uit de PDF gehaald, in fragmenten opgesplitst en
        doorzoekbaar gemaakt. Gescande PDF's zonder tekstlaag werken niet — gebruik
        eerst OCR.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          placeholder="Titel (verplicht)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={busy}
        />
        <Input
          placeholder="Auteur"
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          disabled={busy}
        />
        <Input
          placeholder="Jaar"
          type="number"
          value={year}
          onChange={(e) => setYear(e.target.value)}
          disabled={busy}
        />
        <Input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          disabled={busy}
        />
      </div>
      <div className="mt-4 flex items-center gap-3">
        <Button onClick={handleUpload} disabled={busy || !file || !title.trim()}>
          {busy ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Verwerken…
            </>
          ) : (
            <>
              <Upload className="h-4 w-4 mr-2" /> Uploaden & indexeren
            </>
          )}
        </Button>
        {progress ? <span className="text-xs text-muted-foreground">{progress}</span> : null}
      </div>
    </div>
  );
}
