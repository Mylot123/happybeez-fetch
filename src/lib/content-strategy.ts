export type Channel = "instagram" | "linkedin" | "facebook" | "blog" | "website";

export type ChannelRules = {
  label: string;
  emoji: string;
  goal: string;
  format: string;
  bestTimes: string;
  bestDays: string;
  wordRange: [number, number];
  hookMaxWords: number;
  hashtagRange: [number, number];
  ctaExamples: string[];
  tone: string;
  tips: string[];
  avoid: string[];
};

export const CHANNEL_RULES: Record<Channel, ChannelRules> = {
  instagram: {
    label: "Instagram",
    emoji: "📸",
    goal: "Saves, shares en profielbezoeken",
    format: "Reel 9:16 of carrousel 4:5",
    bestTimes: "12:00–16:00 en 18:00–21:00",
    bestDays: "maandag t/m donderdag",
    wordRange: [80, 160],
    hookMaxWords: 12,
    hashtagRange: [3, 5],
    ctaExamples: [
      "Sla deze tip op 🐝",
      "Deel dit met een tuinliefhebber",
      "Stuur dit door naar iemand met een bijenhotel",
    ],
    tone: "Persoonlijk, visueel, herkenbaar",
    tips: [
      "Eén hoofdboodschap per post",
      "Hook in de eerste regel",
      "Gebruik 1–4 functionele emoji's",
      "Vermijd holle 'like & follow'",
    ],
    avoid: ["meer dan 5 hashtags", "markdown/sterretjes", "algemene 'bijen' — zeg 'wilde bijen'"],
  },
  facebook: {
    label: "Facebook",
    emoji: "👥",
    goal: "Reacties, shares en community-gevoel",
    format: "Native afbeelding of Reel 9:16",
    bestTimes: "12:00–14:00 en 19:00–21:00",
    bestDays: "dinsdag t/m donderdag",
    wordRange: [120, 220],
    hookMaxWords: 15,
    hashtagRange: [0, 3],
    ctaExamples: [
      "Herken jij dit in jouw tuin?",
      "Deel dit met iemand met een tuin",
      "Welke bloemen doen het goed bij jou?",
    ],
    tone: "Warm, sociaal, community-first",
    tips: [
      "Open met een herkenbare vraag of observatie",
      "Lokale trots werkt sterk (handgemaakt in Boekel)",
      "Educatie eerst, product als oplossing",
      "Reageer binnen het eerste uur",
    ],
    avoid: ["'sla op'", "meer dan 3 hashtags", "harde verkoop"],
  },
  linkedin: {
    label: "LinkedIn",
    emoji: "💼",
    goal: "Meaningful comments, reposts en profielbezoeken",
    format: "Tekst + beeld, document of native video",
    bestTimes: "11:00–17:00 (test 12–14u en 15–17u)",
    bestDays: "dinsdag, woensdag, donderdag",
    wordRange: [120, 220], // prompt uses 900-1400 chars; words are rough
    hookMaxWords: 12,
    hashtagRange: [2, 4],
    ctaExamples: [
      "Wat is jouw ervaring met groen op het werk?",
      "Waar ben je het niet mee eens?",
      "Met welk misverstand over bijenhotels kom jij het vaakst in aanraking?",
    ],
    tone: "Professioneel, deskundig, menselijk",
    tips: [
      "Eén scherpe stelling of observatie",
      "Korte alinea's met witregels",
      "Subtiele HappyBeez-koppeling pas ná de waarde",
      "Richt je op bedrijven, scholen, gemeenten, hoveniers",
    ],
    avoid: ["engagement farming", "clickbait", "overdreven claims", "generieke 'bijen'"],
  },
  blog: {
    label: "Blog",
    emoji: "✍️",
    goal: "Search, Discover, backlinks, nieuwsbriefinschrijvingen",
    format: "Long-form + structured data + social snippets",
    bestTimes: "06:00–10:00 publiceren",
    bestDays: "dinsdag, donderdag, vrijdag",
    wordRange: [400, 1200],
    hookMaxWords: 20,
    hashtagRange: [0, 0],
    ctaExamples: [
      "Meld je aan voor de nieuwsbrief",
      "Lees ook: [gerelateerd artikel]",
      "Deel dit artikel met een groen professional",
    ],
    tone: "People-first, bewijsgericht, helder",
    tips: [
      "Unieke titel + meta description",
      "Tussenkoppen, bullets en tabellen",
      "Interne links en beschrijvende alt-teksten",
      "Distributeer via social snippets en nieuwsbrief",
    ],
    avoid: ["dunne content", "geen structuur", "keyword-stuffing"],
  },
  website: {
    label: "Website",
    emoji: "🌐",
    goal: "Conversie en duidelijke call-to-actions",
    format: "Beknopt, productgericht, visueel",
    bestTimes: "n.v.t.",
    bestDays: "n.v.t.",
    wordRange: [50, 200],
    hookMaxWords: 15,
    hashtagRange: [0, 0],
    ctaExamples: ["Bekijk het assortiment", "Vraag een offerte aan", "Lees meer over bijenhotels"],
    tone: "Helder, betrouwbaar, beknopt",
    tips: ["Eén duidelijke CTA", "Korte zinnen", "Productdetails pas na het voordeel"],
    avoid: ["lange lappen tekst", "meerdere CTA's tegelijk"],
  },
};

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function countHashtags(text: string): number {
  return (text.match(/#[\p{L}\p{N}_]+/gu) ?? []).length;
}

export function firstLine(text: string): string {
  return text.split(/\n/)[0]?.trim() ?? "";
}

export function firstLineWordCount(text: string): number {
  return countWords(firstLine(text));
}

export type FeedbackLevel = "good" | "warning" | "bad";

export function wordFeedback(channel: Channel, text: string): {
  level: FeedbackLevel;
  message: string;
} {
  const n = countWords(text);
  const [min, max] = CHANNEL_RULES[channel].wordRange;
  if (n === 0) return { level: "good", message: "" };
  if (n < min) return { level: "warning", message: `Tekst is kort (${n} woorden). Aangeraden: ${min}-${max}.` };
  if (n > max) return { level: "warning", message: `Tekst is lang (${n} woorden). Aangeraden: ${min}-${max}.` };
  return { level: "good", message: `${n} woorden — binnen het ideale bereik` };
}

export function hookFeedback(channel: Channel, text: string): {
  level: FeedbackLevel;
  message: string;
} {
  const line = firstLine(text);
  const n = countWords(line);
  const max = CHANNEL_RULES[channel].hookMaxWords;
  if (n === 0) return { level: "good", message: "" };
  if (n > max) return { level: "bad", message: `Eerste regel is ${n} woorden. Maximaal ${max} voor ${CHANNEL_RULES[channel].label}.` };
  return { level: "good", message: `Sterke opening (${n} woorden)` };
}

export function hashtagFeedback(channel: Channel, text: string): {
  level: FeedbackLevel;
  message: string;
} {
  const n = countHashtags(text);
  const [min, max] = CHANNEL_RULES[channel].hashtagRange;
  if (n === 0 && max === 0) return { level: "good", message: "Geen hashtags nodig" };
  if (n === 0 && max > 0) return { level: "warning", message: `Geen hashtags. Aangeraden: ${min}-${max}.` };
  if (n > max) return { level: "bad", message: `${n} hashtags — maximaal ${max} voor ${CHANNEL_RULES[channel].label}.` };
  if (n < min) return { level: "warning", message: `${n} hashtags — aangeraden: ${min}-${max}.` };
  return { level: "good", message: `${n} hashtags — prima` };
}

export function levelColor(level: FeedbackLevel): string {
  switch (level) {
    case "good":
      return "var(--hb-green)";
    case "warning":
      return "var(--hb-honey)";
    case "bad":
      return "#c45a44";
    default:
      return "var(--hb-dark)";
  }
}

export function levelBg(level: FeedbackLevel): string {
  switch (level) {
    case "good":
      return "rgba(111, 138, 58, 0.10)";
    case "warning":
      return "rgba(217, 161, 58, 0.12)";
    case "bad":
      return "rgba(196, 90, 68, 0.10)";
    default:
      return "transparent";
  }
}
