import watermarkAsset from "@/assets/happybeez-watermark.png";

const WM_URL = watermarkAsset as unknown as string;
const MAX_DIM = 2400;

let cachedLogo: Promise<HTMLImageElement> | null = null;
function loadLogo() {
  if (cachedLogo) return cachedLogo;
  cachedLogo = new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Watermerk-logo kon niet worden geladen."));
    img.src = WM_URL;
  });
  return cachedLogo;
}

function loadFileImage(file: File | Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Afbeelding kon niet worden gelezen."));
    };
    img.src = url;
  });
}

function drawOverlayText(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  text: string,
) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return;

  const fontSize = Math.round(Math.min(width, height) * 0.062);
  const lineHeight = Math.round(fontSize * 1.2);
  const margin = Math.round(Math.min(width, height) * 0.06);
  const maxWidth = width - margin * 2;

  ctx.font = `700 ${fontSize}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  ctx.textBaseline = "alphabetic";

  // Woorden afbreken over maximaal 3 regels.
  const words = clean.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const w of words) {
    const test = current ? `${current} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = w;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  const shown = lines.slice(0, 3);
  if (lines.length > 3) shown[2] = `${shown[2].slice(0, -1)}…`;

  const blockH = shown.length * lineHeight;
  const gradTop = Math.max(0, height - blockH - margin * 2.4);
  const grad = ctx.createLinearGradient(0, gradTop, 0, height);
  grad.addColorStop(0, "rgba(0,0,0,0)");
  grad.addColorStop(0.55, "rgba(0,0,0,0.42)");
  grad.addColorStop(1, "rgba(0,0,0,0.72)");
  ctx.save();
  ctx.fillStyle = grad;
  ctx.fillRect(0, gradTop, width, height - gradTop);
  ctx.restore();

  ctx.save();
  ctx.fillStyle = "#fff";
  ctx.shadowColor = "rgba(0,0,0,0.55)";
  ctx.shadowBlur = Math.round(fontSize * 0.35);
  let y = height - margin - (shown.length - 1) * lineHeight;
  for (const line of shown) {
    ctx.fillText(line, margin, y);
    y += lineHeight;
  }
  ctx.restore();
}

async function renderWatermarked(
  photo: HTMLImageElement,
  filenameBase: string,
  overlayText?: string,
): Promise<{ b64: string; contentType: "image/jpeg"; filename: string }> {

  const logo = await loadLogo();

  let width = photo.naturalWidth || photo.width;
  let height = photo.naturalHeight || photo.height;
  const scale = Math.min(1, MAX_DIM / Math.max(width, height));
  width = Math.round(width * scale);
  height = Math.round(height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas niet beschikbaar in deze browser.");

  ctx.drawImage(photo, 0, 0, width, height);

  // Plaats het watermerk binnen het gecentreerde vierkant, zodat het ook
  // zichtbaar blijft als een feed (Instagram/Facebook) de foto vierkant bijsnijdt.
  const safe = Math.min(width, height);
  const safeLeft = Math.round((width - safe) / 2);
  const safeTop = Math.round((height - safe) / 2);

  const wmTargetW = Math.max(160, Math.round(safe * 0.36));
  const wmRatio = logo.naturalHeight / logo.naturalWidth;
  const wmW = wmTargetW;
  const wmH = Math.round(wmW * wmRatio);
  const margin = Math.round(safe * 0.04);
  const x = safeLeft + safe - wmW - margin;
  const y = safeTop + safe - wmH - margin;

  // Donkere, zachte plaat achter het logo zodat het witte merk altijd leesbaar is.
  ctx.save();
  ctx.globalAlpha = 0.32;
  const pad = Math.round(wmH * 0.35);
  ctx.fillStyle = "#000";
  ctx.filter = "blur(14px)";
  ctx.fillRect(x - pad, y - pad, wmW + pad * 2, wmH + pad * 2);
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = 0.95;
  ctx.shadowColor = "rgba(0,0,0,0.6)";
  ctx.shadowBlur = Math.round(wmH * 0.25);
  ctx.drawImage(logo, x, y, wmW, wmH);
  ctx.restore();

  if (overlayText) drawOverlayText(ctx, width, height, overlayText);

  const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
  const b64 = dataUrl.split(",")[1] ?? "";
  const base = filenameBase.replace(/\.[^.]+$/, "") || "foto";
  return { b64, contentType: "image/jpeg", filename: `${base}.jpg` };
}

/** Watermarks a user-uploaded File and returns base64 JPEG. */
export async function watermarkImage(file: File) {
  const photo = await loadFileImage(file);
  return renderWatermarked(photo, file.name);
}

/** Watermarks any image Blob and returns a JPEG Blob (voor downloads). */
export async function watermarkBlob(blob: Blob, overlayText?: string): Promise<Blob> {
  const photo = await loadFileImage(blob);
  const { b64 } = await renderWatermarked(photo, "foto", overlayText);
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: "image/jpeg" });
}


/** Watermarks a base64 image (any mime) and returns base64 JPEG. */
export async function watermarkBase64(
  b64: string,
  mime: string,
  filenameBase: string,
) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const blob = new Blob([bytes], { type: mime });
  const photo = await loadFileImage(blob);
  return renderWatermarked(photo, filenameBase);
}
