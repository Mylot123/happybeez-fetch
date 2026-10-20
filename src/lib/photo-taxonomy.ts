/** Bijengroepen herkend uit tags (geslacht of Nederlandse groepsnaam). */
export const BEE_GROUPS: { label: string; keys: string[] }[] = [
  { label: "Zandbijen", keys: ["andrena", "zandbij", "zandbijen"] },
  { label: "Metselbijen", keys: ["osmia", "metselbij", "metselbijen"] },
  { label: "Hommels", keys: ["bombus", "hommel", "hommels"] },
  { label: "Groefbijen", keys: ["lasioglossum", "halictus", "groefbij", "groefbijen"] },
  { label: "Maskerbijen", keys: ["hylaeus", "maskerbij", "maskerbijen"] },
  { label: "Behangersbijen", keys: ["megachile", "behangersbij", "behangersbijen"] },
  { label: "Wespbijen", keys: ["nomada", "wespbij", "wespbijen"] },
  { label: "Sachembijen", keys: ["anthophora", "sachembij", "sachembijen"] },
  { label: "Wolbijen", keys: ["anthidium", "wolbij", "wolbijen"] },
  { label: "Honingbij", keys: ["apis", "honingbij"] },
  { label: "Bijenhotels", keys: ["bijenhotel", "bijenhotels", "insectenhotel"] },
  { label: "Werkplaats", keys: ["werkplaats", "ambacht"] },
];

export function groupsForTags(tags: string[]): string[] {
  const set = new Set(tags.map((t) => t.toLowerCase()));
  return BEE_GROUPS.filter((g) => g.keys.some((k) => set.has(k) || [...set].some((t) => t.startsWith(k + " ")))).map(
    (g) => g.label,
  );
}

/** Latijnse soortnamen ("Andrena barbilabris") uit mapnamen. */
export function speciesFromPath(segments: string[]): string[] {
  const out: string[] = [];
  for (const s of segments) {
    const m = s.match(/\b([A-Z][a-z]{3,})\s+([a-z]{4,})\b/);
    if (m) out.push(`${m[1]} ${m[2]}`.toLowerCase());
  }
  return out;
}
