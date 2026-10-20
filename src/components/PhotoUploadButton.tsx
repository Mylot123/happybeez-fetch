import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { uploadUserPhoto } from "@/lib/image.functions";
import { watermarkImage } from "@/lib/watermark";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { speciesFromPath } from "@/lib/photo-taxonomy";
import { FolderUp } from "lucide-react";

type Props = {
  onUploaded?: () => void;
  compact?: boolean;
  folderId?: string | null;
};

const ACCEPT = "image/png,image/jpeg,image/jpg,image/webp";
const MAX_BYTES = 15 * 1024 * 1024; // 15 MB source

const STOP = new Set(["img", "dsc", "dscn", "jpg", "jpeg", "png", "webp", "foto", "photo", "kopie", "copy", "final", "edit", "def", "van", "de", "het", "een", "en"]);

/** Turn a filename (and folder names) into search tags, e.g. "witbaardzandbij_Andrena-barbilabris_03.jpg". */
export function tagsFromFilename(name: string, folderPath = ""): string[] {
  const raw = `${folderPath} ${name.replace(/\.[^.]+$/, "")}`
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(/[^a-zà-ÿ]+/i);
  const out: string[] = [];
  for (const w of raw) {
    if (w.length < 3 || STOP.has(w) || out.includes(w)) continue;
    out.push(w.slice(0, 40));
    if (out.length >= 10) break;
  }
  return out;
}

export function PhotoUploadButton({ onUploaded, compact, folderId }: Props) {
  const { currentOrgId } = useCurrentOrg();
  const upload = useServerFn(uploadUserPhoto);
  const inputRef = useRef<HTMLInputElement>(null);
  const dirRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    if (!currentOrgId) {
      toast.error("Geen organisatie gekozen.");
      return;
    }
    const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (!list.length) return toast.error("Geen foto's gevonden in deze selectie.");
    setBusy(true);
    setProgress({ done: 0, total: list.length });
    let ok = 0;
    let fail = 0;
    const newIds: string[] = [];
    for (const file of list) {
      try {
        if (!file.type.startsWith("image/")) throw new Error(`${file.name}: geen afbeelding.`);
        if (file.size > MAX_BYTES) throw new Error(`${file.name}: te groot (max 15 MB).`);
        const rel = (file as File & { webkitRelativePath?: string }).webkitRelativePath ?? "";
        const segs = rel.split("/").slice(1, -1); // zonder hoofdmap en bestandsnaam
        const species = speciesFromPath(segs);
        const deepest = segs[segs.length - 1]?.replace(/\b(19|20)\d{2}\b/g, "").replace(/\s+/g, " ").trim();
        const base = file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ");
        const tags = [...species, ...tagsFromFilename(file.name, segs.join(" "))].filter(
          (t, i, a) => a.indexOf(t) === i,
        ).slice(0, 14);
        const { b64, contentType, filename } = await watermarkImage(file);
        const row = await upload({
          data: {
            org_id: currentOrgId,
            filename,
            content_type: contentType,
            b64,
            title: (deepest ? `${deepest} · ${base}` : base).slice(0, 120) || "Upload",
            folder_id: folderId ?? null,
            extra_tags: tags,
          },
        });
        if (row?.id) newIds.push(row.id);
        ok++;
      } catch (err) {
        fail++;
        if (fail <= 5) toast.error(err instanceof Error ? err.message : `Upload van ${file.name} mislukt.`);
      }
      setProgress({ done: ok + fail, total: list.length });
    }
    setBusy(false);
    setProgress(null);
    if (inputRef.current) inputRef.current.value = "";
    if (dirRef.current) dirRef.current.value = "";
    if (ok > 0) {
      // Geen automatische AI-tagging meer: tags komen gratis uit map- en bestandsnamen.
      toast.success(`${ok} foto('s) geüpload met watermerk${fail ? `, ${fail} mislukt` : ""}.`);
      onUploaded?.();

    } else if (fail) {
      toast.error(`${fail} foto('s) konden niet worden geüpload.`);
    }
  }

  return (
    <div className="inline-flex flex-col gap-1.5 min-w-[180px]">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        className="hidden"
        onChange={(e) => void handleFiles(e.target.files)}
      />
      <input
        ref={dirRef}
        type="file"
        multiple
        className="hidden"
        {...({ webkitdirectory: "", directory: "" } as Record<string, string>)}
        onChange={(e) => void handleFiles(e.target.files)}
      />
      <div className="flex gap-2 flex-wrap">
      <Button
        type="button"
        size={compact ? "sm" : "default"}
        variant="outline"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Upload className="h-4 w-4 mr-1.5" />}
        {busy && progress
          ? `Foto ${Math.min(progress.done + 1, progress.total)} van ${progress.total}…`
          : compact
            ? "Upload foto's"
            : "Foto's uploaden"}
      </Button>
      {!busy && (
        <Button type="button" size={compact ? "sm" : "default"} variant="outline" onClick={() => dirRef.current?.click()}>
          <FolderUp className="h-4 w-4 mr-1.5" /> Hele map uploaden
        </Button>
      )}
      </div>
      {progress && progress.total > 1 && (
        <Progress value={(progress.done / progress.total) * 100} className="h-1.5" />
      )}
    </div>
  );
}
