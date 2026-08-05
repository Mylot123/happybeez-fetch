/** Robuuste afbeelding-download: juiste extensie, veilige bestandsnaam, fallback. */

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};

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
 * Downloadt een afbeelding als echt bestand met correcte extensie.
 * Valt bij CORS-problemen terug op het openen van de afbeelding in een tab.
 */
export async function downloadImage(url: string, nameHint: string) {
  const base = safeBase(nameHint);

  // data:-URL's kunnen direct.
  if (url.startsWith("data:")) {
    const mime = url.slice(5, url.indexOf(";")) || "image/jpeg";
    const ext = EXT_BY_MIME[mime] ?? "jpg";
    triggerDownload(url, `${base}.${ext}`, false);
    return;
  }

  try {
    const res = await fetch(url, { mode: "cors", cache: "no-store" });
    if (!res.ok) throw new Error(String(res.status));
    const blob = await res.blob();
    if (!blob.size) throw new Error("leeg bestand");

    const mime = blob.type && blob.type.startsWith("image/") ? blob.type : null;
    const ext = (mime && EXT_BY_MIME[mime]) || extFromUrl(url) || "jpg";
    const typed = mime ? blob : new Blob([blob], { type: "image/jpeg" });
    triggerDownload(URL.createObjectURL(typed), `${base}.${ext}`, true);
  } catch {
    // CORS of netwerkfout: open de afbeelding zodat de gebruiker kan opslaan.
    window.open(url, "_blank", "noopener");
    throw new Error("open-fallback");
  }
}
