/** Robuuste afbeelding-download: juiste extensie, veilige bestandsnaam, fallback. */
import { watermarkBlob } from "@/lib/watermark";





function safeBase(name: string) {
  const base = (name || "post")
    .replace(/\.[^.]+$/, "")
    .replace(/[\\/:*?"<>|#]+/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  return base || "post";
}

function extFromUrl(url: string) {
  const m = url.split("?")[0].match(/\.(jpe?g|png|webp|gif|avif)$/i);
  return m ? m[1].toLowerCase().replace("jpeg", "jpg") : null;
}

function triggerDownload(href: string, filename: string, revoke: boolean) {
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  if (revoke) {
    // Pas opruimen nadat de browser de download echt heeft opgepakt.
    setTimeout(() => URL.revokeObjectURL(href), 60_000);
  }
}

/**
 * Downloadt een afbeelding als JPEG met HappyBeez-watermerk en (optioneel)
 * de tekst-overlay ingebrand, zoals in de preview.
 */
export async function downloadImage(
  url: string,
  nameHint: string,
  overlayText?: string,
) {
  const base = safeBase(nameHint);

  let blob: Blob;
  try {
    if (url.startsWith("data:")) {
      blob = await (await fetch(url)).blob();
    } else {
      const res = await fetch(url, { mode: "cors", cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      blob = await res.blob();
      if (!blob.size) throw new Error("leeg bestand");
    }
  } catch {
    // CORS of netwerkfout: open de afbeelding zodat de gebruiker kan opslaan.
    window.open(url, "_blank", "noopener");
    throw new Error("open-fallback");
  }

  // Altijd watermerk + tekst inbranden bij downloaden.
  const marked = await watermarkBlob(blob, overlayText);
  triggerDownload(URL.createObjectURL(marked), `${base}.jpg`, true);
}


