import watermarkAsset from "@/assets/happybeez-watermark.png";

const WM_URL = watermarkAsset as unknown as string;
const MAX_DIM = 2400; // downscale huge photos before watermarking

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

function loadFileImage(file: File): Promise<HTMLImageElement> {
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

/**
 * Bakes the HappyBeez logo as a light watermark into a photo, bottom-right.
 * Returns a base64-encoded JPEG (without the data-url prefix) plus its mime.
 */
export async function watermarkImage(file: File): Promise<{
  b64: string;
  contentType: "image/jpeg";
  filename: string;
}> {
  const [photo, logo] = await Promise.all([loadFileImage(file), loadLogo()]);

  // Downscale if huge
  let { width, height } = photo;
  const scale = Math.min(1, MAX_DIM / Math.max(width, height));
  width = Math.round(width * scale);
  height = Math.round(height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas niet beschikbaar in deze browser.");

  ctx.drawImage(photo, 0, 0, width, height);

  // Logo width ~28% of shorter dim, min 140px
  const wmTargetW = Math.max(140, Math.round(Math.min(width, height) * 0.28));
  const wmRatio = logo.naturalHeight / logo.naturalWidth;
  const wmW = wmTargetW;
  const wmH = Math.round(wmW * wmRatio);
  const margin = Math.round(Math.min(width, height) * 0.025);
  const x = width - wmW - margin;
  const y = height - wmH - margin;

  // Subtle dark scrim behind the logo for legibility on light photos
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

  const base = file.name.replace(/\.[^.]+$/, "") || "foto";
  return { b64, contentType: "image/jpeg", filename: `${base}.jpg` };
}
