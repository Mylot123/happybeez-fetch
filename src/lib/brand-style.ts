/**
 * Merk-typografie en kleurenpalet.
 * Rollen bepalen waar welk lettertype gebruikt wordt in posts en beeldteksten.
 */

export type BrandColor = { hex: string; label: string };
export type BrandFontRole = { role: FontRoleKey; family: string };

export type FontRoleKey = "heading" | "body" | "overlay" | "accent";

export const FONT_ROLES: { key: FontRoleKey; label: string; hint: string }[] = [
  { key: "heading", label: "Koppen / titels", hint: "Titels van posts, blogkoppen" },
  { key: "body", label: "Bodytekst", hint: "Lopende tekst in posts en blogs" },
  { key: "overlay", label: "Tekst in de afbeelding", hint: "Hook of titel die in het beeld gebrand wordt" },
  { key: "accent", label: "Accent / quote", hint: "Citaten, call-to-action, uitgelichte regels" },
];

export const DEFAULT_FONT_ROLES: BrandFontRole[] = [
  { role: "heading", family: "Playfair Display" },
  { role: "body", family: "Inter" },
  { role: "overlay", family: "Playfair Display" },
  { role: "accent", family: "Inter" },
];

const GENERIC_FALLBACK = 'Georgia, "Times New Roman", serif';

export function isHex(v: string) {
  return /^#[0-9a-f]{6}$/i.test(v.trim());
}

export function normalizeColors(raw: unknown): BrandColor[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((c) => {
      if (typeof c === "string") return { hex: c.toLowerCase(), label: "" };
      if (c && typeof c === "object") {
        const o = c as Record<string, unknown>;
        return {
          hex: typeof o.hex === "string" ? o.hex.toLowerCase() : "",
          label: typeof o.label === "string" ? o.label : "",
        };
      }
      return { hex: "", label: "" };
    })
    .filter((c) => isHex(c.hex))
    .slice(0, 12);
}

export function normalizeFontRoles(raw: unknown): BrandFontRole[] {
  const known = new Set(FONT_ROLES.map((r) => r.key));
  const found = new Map<FontRoleKey, string>();
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (!item || typeof item !== "object") continue;
      const o = item as Record<string, unknown>;
      const role = typeof o.role === "string" ? (o.role as FontRoleKey) : null;
      const family = typeof o.family === "string" ? o.family.trim() : "";
      if (role && known.has(role) && family) found.set(role, family.slice(0, 80));
    }
  }
  return FONT_ROLES.map((r) => ({
    role: r.key,
    family: found.get(r.key) ?? DEFAULT_FONT_ROLES.find((d) => d.role === r.key)!.family,
  }));
}

export function fontFor(roles: BrandFontRole[] | null | undefined, role: FontRoleKey): string {
  const list = normalizeFontRoles(roles ?? []);
  return list.find((r) => r.role === role)?.family ?? "Playfair Display";
}

/** CSS font-family string, inclusief fallbacks. */
export function fontStack(family: string): string {
  return `"${family}", ${GENERIC_FALLBACK}`;
}

const loaded = new Set<string>();

/** Laadt merk-lettertypen via Google Fonts zodat previews en downloads kloppen. */
export function ensureFontsLoaded(families: string[]) {
  if (typeof document === "undefined") return;
  for (const family of families) {
    const name = family.trim();
    if (!name || loaded.has(name.toLowerCase())) continue;
    loaded.add(name.toLowerCase());
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(
      name,
    ).replace(/%20/g, "+")}:wght@400;600;700&display=swap`;
    document.head.appendChild(link);
  }
}
