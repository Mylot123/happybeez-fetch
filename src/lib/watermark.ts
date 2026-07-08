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

async function renderWatermarked(
  photo: HTMLImageElement,
  filenameBase: string,
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

  const wmTargetW = Math.max(140, Math.round(Math.min(width, height) * 0.28));
  const wmRatio = logo.naturalHeight / logo.naturalWidth;
  const wmW = wmTargetW;
  const wmH = Math.round(wmW * wmRatio);
  const margin = Math.round(Math.min(width, height) * 0.025);
  const x = width - wmW - margin;
  const y = height - wmH - margin;

  ctx.save();
  ctx.globalAlpha = 0.18;
  const pad = Math.round(wmH * 0.25);
  ctx.fillStyle = "#000";
  ctx.filter = "blur(8px)";
  ctx.fillRect(x - pad, y - pad, wmW + pad * 2, wmH + pad * 2);
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = 0.55;
  ctx.drawImage(logo, x, y, wmW, wmH);
  ctx.restore();

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
