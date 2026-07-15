import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Upload, FileText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { analyzeBrandDocument } from "@/lib/brand-doc.functions";

type Analysis = {
  summary: string;
  tone_of_voice: string;
  style_keywords: string[];
  visual_direction: string;
  suggested_primary: string;
  suggested_secondary: string;
  palette: string[];
  fonts: string[];
  meta: { title: string; description: string; ogImage: string };
};

const ACCEPT =
  "application/pdf,image/png,image/jpeg,image/jpg,image/webp";
const MAX_BYTES = 15 * 1024 * 1024;

async function extractPdfText(file: File, setProgress: (s: string) => void): Promise<string> {
  setProgress("PDF laden…");
  const pdfjs = await import("pdfjs-dist");
  const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  (pdfjs as unknown as { GlobalWorkerOptions: { workerSrc: string } }).GlobalWorkerOptions.workerSrc =
    workerUrl;
  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  const maxPages = Math.min(doc.numPages, 20);
  const parts: string[] = [];
  for (let p = 1; p <= maxPages; p++) {
    setProgress(`Pagina ${p} / ${maxPages}…`);
    const page = await doc.getPage(p);
    const text = await page.getTextContent();
    parts.push(
      text.items.map((it) => ("str" in it ? (it as { str: string }).str : "")).join(" "),
    );
  }
  return parts.join("\n\n").replace(/\s+/g, " ").trim();
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = String(r.result ?? "");
      resolve(s.replace(/^data:[^;]+;base64,/, ""));
    };
    r.onerror = () => reject(new Error("Bestand kon niet gelezen worden."));
    r.readAsDataURL(file);
  });
}

export function BrandDocumentUpload({
  onAnalyzed,
}: {
  onAnalyzed: (analysis: Analysis) => void;
}) {
  const analyze = useServerFn(analyzeBrandDocument);
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);

  async function handleFile(file: File) {
    if (file.size > MAX_BYTES) {
      toast.error("Bestand te groot (max 15 MB).");
      return;
    }
    setBusy(true);
    setFileName(file.name);
    try {
      let payload: {
        filename: string;
        text?: string;
        imageB64?: string;
        contentType?: "image/png" | "image/jpeg" | "image/webp";
      };
      if (file.type === "application/pdf") {
        const text = await extractPdfText(file, setProgress);
        if (text.length < 30) {
          toast.error("Geen tekst in PDF gevonden (gescande PDF zonder OCR?).");
          return;
        }
        payload = { filename: file.name, text: text.slice(0, 55_000) };
      } else if (file.type.startsWith("image/")) {
        setProgress("Afbeelding voorbereiden…");
        const b64 = await fileToBase64(file);
        payload = {
          filename: file.name,
          imageB64: b64,
          contentType: file.type as "image/png" | "image/jpeg" | "image/webp",
        };
      } else {
        toast.error("Alleen PDF of afbeelding (PNG/JPG/WebP).");
        return;
      }
      setProgress("AI analyseert het document…");
      const result = await analyze({ data: payload });
      onAnalyzed(result);
      toast.success("Merkdocument geanalyseerd");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Analyse mislukt.");
    } finally {
      setBusy(false);
      setProgress("");
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="border-t border-border pt-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-ink">
            <FileText className="w-4 h-4 text-wine" />
            Merkdocument uploaden
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Upload een brandbook, huisstijlgids, logo of moodboard (PDF of afbeelding, max 15 MB).
            AI leest kleuren, typografie en tone-of-voice uit en vult je merkprofiel aan.
          </p>
          {fileName && (
            <p className="text-xs text-muted-foreground mt-1">
              Bestand: <span className="text-ink font-medium">{fileName}</span>
              {progress && <> — {progress}</>}
            </p>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFile(f);
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? (
            <>
              <Loader2 className="w-4 h-4 mr-1 animate-spin" /> Analyseren…
            </>
          ) : (
            <>
              <Upload className="w-4 h-4 mr-1" /> Kies bestand
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
