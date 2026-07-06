import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { uploadUserPhoto } from "@/lib/image.functions";
import { watermarkImage } from "@/lib/watermark";
import { useCurrentOrg } from "@/hooks/use-current-org";

type Props = {
  onUploaded?: () => void;
  compact?: boolean;
};

const ACCEPT = "image/png,image/jpeg,image/jpg,image/webp";
const MAX_BYTES = 15 * 1024 * 1024; // 15 MB source

export function PhotoUploadButton({ onUploaded, compact }: Props) {
  const { currentOrgId } = useCurrentOrg();
  const upload = useServerFn(uploadUserPhoto);
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    if (!currentOrgId) {
      toast.error("Geen organisatie gekozen.");
      return;
    }
    setBusy(true);
    let ok = 0;
    let fail = 0;
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) {
        fail++;
        toast.error(`${file.name}: geen afbeelding.`);
        continue;
      }
      if (file.size > MAX_BYTES) {
        fail++;
        toast.error(`${file.name}: te groot (max 15 MB).`);
        continue;
      }
      try {
        const { b64, contentType, filename } = await watermarkImage(file);
        await upload({
          data: {
            org_id: currentOrgId,
            filename,
            content_type: contentType,
            b64,
            title: file.name.replace(/\.[^.]+$/, "").slice(0, 120) || "Upload",
          },
        });
        ok++;
      } catch (err) {
        fail++;
        toast.error(err instanceof Error ? err.message : `Upload van ${file.name} mislukt.`);
      }
    }
    setBusy(false);
    if (ok > 0) {
      toast.success(
        ok === 1
          ? "Foto geüpload met HappyBeez-watermerk."
          : `${ok} foto's geüpload met watermerk.`,
      );
      onUploaded?.();
    }
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        className="hidden"
        onChange={(e) => void handleFiles(e.target.files)}
      />
      <Button
        type="button"
        size={compact ? "sm" : "default"}
        variant="outline"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? (
          <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
        ) : (
          <Upload className="h-4 w-4 mr-1.5" />
        )}
        {busy ? "Uploaden…" : compact ? "Upload foto" : "Foto uploaden"}
      </Button>
    </>
  );
}
