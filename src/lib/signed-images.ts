import { supabase } from "@/integrations/supabase/client";

const BUCKET = "library-photos";
const TTL = 60 * 60 * 8;

/** Maakt verse signed URL's voor storage-paden (opgeslagen URL's verlopen). */
export async function signPaths(paths: string[]): Promise<Record<string, string>> {
  const unique = Array.from(new Set(paths.filter(Boolean)));
  if (unique.length === 0) return {};
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(unique, TTL);
  if (error || !data) return {};
  const map: Record<string, string> = {};
  data.forEach((entry, i) => {
    const path = unique[i];
    if (path && entry.signedUrl) map[path] = entry.signedUrl;
  });
  return map;
}

/** Vervangt verlopen image_url's door verse signed URL's op basis van image_storage_path. */
export async function withFreshImageUrls<
  T extends { image_url?: string | null; image_storage_path?: string | null },
>(rows: T[]): Promise<T[]> {
  const map = await signPaths(
    rows.map((r) => r.image_storage_path ?? "").filter((p): p is string => Boolean(p)),
  );
  if (Object.keys(map).length === 0) return rows;
  return rows.map((r) =>
    r.image_storage_path && map[r.image_storage_path]
      ? { ...r, image_url: map[r.image_storage_path] }
      : r,
  );
}

/** Verse signed URL voor één pad. */
export async function signOne(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  const map = await signPaths([path]);
  return map[path] ?? null;
}
