import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Toont de merknaam altijd als "Happybeez", ongeacht hoe hij is opgeslagen. */
export function brandName(name?: string | null) {
  return (name ?? "").replace(/happy\s*beez/gi, "Happybeez");
}
