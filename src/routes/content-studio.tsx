import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Wand2,
  Copy,
  CheckCheck,
  Save,
  Loader2,
  RefreshCw,
  Sparkles,
  Upload,
  Image as ImageIcon,
  Heart,
  MessageCircle,
  Send,
  Bookmark,
  MoreHorizontal,
  ThumbsUp,
  Globe,
  Share2,
  Lightbulb,
  Clock,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { generateText } from "@/lib/ai.functions";
import { generatePostImage, uploadUserPhoto } from "@/lib/image.functions";
import { watermarkImage, watermarkBase64 } from "@/lib/watermark";
import { generateContentIdeas } from "@/lib/ideas.functions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useCurrentOrg } from "@/hooks/use-current-org";
import {
  CHANNEL_RULES,
  countWords,
  firstLineWordCount,
  wordFeedback,
  hookFeedback,
  hashtagFeedback,
  levelColor,
  levelBg,
  type Channel as StrategyChannel,
} from "@/lib/content-strategy";


const CHANNEL_FORMAT: Record<string, "1:1" | "9:16" | "16:9" | "4:5"> = {
  instagram: "1:1",
  facebook: "1:1",
  linkedin: "16:9",
  blog: "16:9",
  website: "16:9",
};


type Channel = "instagram" | "linkedin" | "facebook" | "blog" | "website";
type ContentType =
  | "tip"
  | "citaat"
  | "educatief"
  | "product"
  | "seizoen"
  | "behind_scenes"
  | "nieuws"
  | "boekfragment";
type Tone =
  | "warm_educatief"
  | "enthousiast"
  | "persoonlijk"
  | "professioneel"
  | "poetisch";

type Photo = {
  id: string;
  title: string;
  caption: string | null;
  tags: string[];
  storage_path: string | null;
  image_url: string;
};

const CHANNELS: { value: Channel; label: string; hint: string }[] = [
  { value: "instagram", label: "📸 Instagram", hint: "Emoji, persoonlijk, hashtags, max 2200 tekens" },
  { value: "linkedin", label: "💼 LinkedIn", hint: "Professioneel maar warm, storytelling, geen hashtag-spam" },
  { value: "facebook", label: "👥 Facebook", hint: "Vriendelijk, uitnodigend, community-gericht" },
  { value: "blog", label: "✍️ Blog", hint: "Informatief, SEO-vriendelijk, subkoppen, diepgaand" },
  { value: "website", label: "🌐 Website", hint: "Heldere call-to-actions, productgericht, beknopt" },
];

const CONTENT_TYPES: { value: ContentType; label: string }[] = [
  { value: "tip", label: "💡 Praktische tip" },
  { value: "citaat", label: "💬 Inspirerend citaat" },
  { value: "educatief", label: "📚 Educatieve post" },
  { value: "product", label: "🛒 Productpost" },
  { value: "seizoen", label: "🌸 Seizoensbericht" },
  { value: "behind_scenes", label: "🎬 Behind the scenes" },
  { value: "nieuws", label: "📰 Nieuwspost" },
  { value: "boekfragment", label: "📖 Boekfragment" },
];

const TONES: { value: Tone; label: string }[] = [
  { value: "warm_educatief", label: "🌿 Warm & educatief" },
  { value: "enthousiast", label: "🔥 Enthousiast & energiek" },
  { value: "persoonlijk", label: "💛 Persoonlijk & authentiek" },
  { value: "professioneel", label: "🎯 Professioneel & betrouwbaar" },
  { value: "poetisch", label: "✨ Poëtisch & inspirerend" },
];

const STOPWORDS = new Set([
  "de","het","een","en","of","maar","in","op","aan","met","voor","van","te","is","zijn","was","ook","dit","dat","die","der","den","bij","uit","om","door","naar","als","dan","ja","nee","wel","niet","je","jij","we","wij","ze","zij","hij","u","mij","ons","onze","jouw","jullie","hun","er","wat","wie","hoe","waar","wanneer","want","dus","nog","heel","veel","meer","minder","hier","daar","zo","over","tot","bij","tussen","onder","boven","tegen","na","zonder","binnen","buiten","ieder","alle","geen","kan","kunt","gaan","gaat","heeft","hebben","worden","wordt","maakt","maken","hou","houdt","goed","beter","beste","echt","echte"
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !STOPWORDS.has(w));
}

function scorePhoto(photo: Photo, contextTokens: Set<string>): number {
  if (contextTokens.size === 0) return 0;
  const haystack = [
    photo.title,
    photo.caption ?? "",
    photo.tags.join(" "),
    photo.tags.join(" "), // tags weigh double
  ].join(" ");
  const photoTokens = tokenize(haystack);
  let score = 0;
  for (const tok of photoTokens) {
    if (contextTokens.has(tok)) score += 1;
    for (const ctx of contextTokens) {
      if (tok !== ctx && (tok.includes(ctx) || ctx.includes(tok)) && Math.min(tok.length, ctx.length) >= 5) {
        score += 0.5;
        break;
      }
    }
  }
  // tag exact matches extra boost
  for (const tag of photo.tags) {
    const t = tag.toLowerCase();
    if (contextTokens.has(t)) score += 2;
  }
  return score;
}

export const Route = createFileRoute("/content-studio")({
  validateSearch: (search: Record<string, unknown>) => ({
    topic: typeof search.topic === "string" ? search.topic : "",
    keywords: typeof search.keywords === "string" ? search.keywords : "",
    source: typeof search.source === "string" ? search.source : "",
    date: typeof search.date === "string" ? search.date : "",
    channel: typeof search.channel === "string" ? search.channel : "",
    type: typeof search.type === "string" ? search.type : "",
    item: typeof search.item === "string" ? search.item : "",
  }),
  head: () => ({
    meta: [
      { title: "Content Studio — HappyBeez" },
      {
        name: "description",
        content: "AI-ondersteund content schrijven voor al je kanalen.",
      },
    ],
  }),
  component: ContentStudioPage,
});


function ContentStudioPage() {
  return (
    <ProtectedRoute>
      <ContentStudio />
    </ProtectedRoute>
  );
}

function ContentStudio() {
  const { user } = useAuth();
  const { currentOrg } = useCurrentOrg();
  const generate = useServerFn(generateText);
  const generateImage = useServerFn(generatePostImage);
  const uploadPhoto = useServerFn(uploadUserPhoto);
  const search = Route.useSearch();

  const initialChannel: Channel =
    (["instagram","linkedin","facebook","blog","website"] as const).includes(search.channel as Channel)
      ? (search.channel as Channel)
      : "instagram";
  const initialType: ContentType =
    (["tip","citaat","educatief","product","seizoen","behind_scenes","nieuws","boekfragment"] as const)
      .includes(search.type as ContentType)
      ? (search.type as ContentType)
      : "tip";

  const [channel, setChannel] = useState<Channel>(initialChannel);
  const [contentType, setContentType] = useState<ContentType>(initialType);
  const [tone, setTone] = useState<Tone>("warm_educatief");
  const [topic, setTopic] = useState(search.topic ?? "");
  const [keywords, setKeywords] = useState(search.keywords ?? "");
  const [generated, setGenerated] = useState("");
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveDate, setSaveDate] = useState(
    search.date || new Date().toISOString().split("T")[0]!,
  );

  type IdeaItem = { title: string; hook: string; angle?: string };
  const [ideas, setIdeas] = useState<IdeaItem[]>([]);
  const [ideasLoading, setIdeasLoading] = useState(false);
  const [ideasCampaign, setIdeasCampaign] = useState<{ theme: string; goal: string | null; week: number; block: string | null } | null>(null);
  const fetchIdeas = useServerFn(generateContentIdeas);

  const [photos, setPhotos] = useState<Photo[]>([]);
  const [photoByChannel, setPhotoByChannel] = useState<Record<string, string>>({});
  const [recentByChannel, setRecentByChannel] = useState<Record<string, string[]>>({});
  const selectedPhotoId = photoByChannel[channel] ?? null;

  const [generatingImage, setGeneratingImage] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function setSelectedPhotoId(id: string) {
    setPhotoByChannel((prev) => ({ ...prev, [channel]: id }));
  }

  async function runFetchIdeas() {
    if (!currentOrg) {
      toast.error("Geen organisatie geselecteerd.");
      return;
    }
    setIdeasLoading(true);
    try {
      const toneLabel = TONES.find((t) => t.value === tone)?.label ?? "warm & educatief";
      const res = await fetchIdeas({
        data: {
          org_id: currentOrg.id,
          date: saveDate,
          channel,
          content_type: contentType,
          tone: toneLabel,
          extraContext: [topic, keywords].filter(Boolean).join(" — ") || undefined,
        },
      });
      setIdeas(res.ideas);
      setIdeasCampaign(res.campaign);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Kon geen ideeën genereren.");
    } finally {
      setIdeasLoading(false);
    }
  }

  // Auto-genereer ideeën als de gebruiker vanuit de kalender komt (date + channel + type in URL)
  const autoIdeasRef = useRef(false);
  useEffect(() => {
    if (autoIdeasRef.current) return;
    if (!currentOrg) return;
    if (!search.date || !search.channel || !search.type) return;
    autoIdeasRef.current = true;
    void runFetchIdeas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrg, search.date, search.channel, search.type]);

  useEffect(() => {
    void loadPhotos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  async function loadPhotos() {
    const { data, error } = await supabase
      .from("library_photos")
      .select("id,title,caption,tags,storage_path,image_url");
    if (error) return;
    const rows = (data ?? []) as Photo[];
    const paths = rows
      .map((r) => r.storage_path)
      .filter((p): p is string => Boolean(p));
    const urlMap: Record<string, string> = {};
    if (paths.length > 0) {
      const { data: signed } = await supabase.storage
        .from("library-photos")
        .createSignedUrls(paths, 60 * 60 * 8);
      signed?.forEach((entry, i) => {
        const path = paths[i];
        if (path && entry.signedUrl) urlMap[path] = entry.signedUrl;
      });
    }
    setPhotos(
      rows.map((r) => ({
        ...r,
        image_url: (r.storage_path && urlMap[r.storage_path]) || r.image_url,
      })),
    );
  }

  const rankedPhotos = useMemo(() => {
    const contextText = [topic, keywords, generated, channel].filter(Boolean).join(" ");
    const tokens = new Set(tokenize(contextText));
    if (photos.length === 0) return [];
    if (tokens.size === 0) return photos.slice(0, 6);
    const usedElsewhere = new Set(
      Object.entries(photoByChannel)
        .filter(([ch]) => ch !== channel)
        .map(([, id]) => id),
    );
    const recent = recentByChannel[channel] ?? [];
    return [...photos]
      .map((p) => {
        let s = scorePhoto(p, tokens);
        if (usedElsewhere.has(p.id)) s -= 3;
        // Recent posts in THIS channel get penalised, so each new post rotates
        const recentIdx = recent.indexOf(p.id);
        if (recentIdx >= 0) s -= 5 - recentIdx; // most recent = biggest penalty
        return { p, s };
      })
      .sort((a, b) => b.s - a.s)
      .filter((x) => x.s > -5)
      .slice(0, 6)
      .map((x) => x.p);
  }, [photos, topic, keywords, generated, channel, photoByChannel, recentByChannel]);


  // auto-select top-ranked when ranking changes and nothing selected for this channel
  useEffect(() => {
    if (rankedPhotos.length === 0) return;
    if (!selectedPhotoId || !rankedPhotos.some((p) => p.id === selectedPhotoId)) {
      setPhotoByChannel((prev) => ({ ...prev, [channel]: rankedPhotos[0]!.id }));
    }
  }, [rankedPhotos, selectedPhotoId, channel]);

  const selectedPhoto =
    photos.find((p) => p.id === selectedPhotoId) ?? rankedPhotos[0] ?? null;




  async function runGenerateImage() {
    if (!user) return;
    if (!currentOrg) {
      toast.error("Geen organisatie geselecteerd.");
      return;
    }
    const subject = [topic, keywords].filter(Boolean).join(", ");
    if (!subject && !generated) {
      toast.error("Vul eerst een onderwerp in of genereer eerst de tekst.");
      return;
    }
    setGeneratingImage(true);
    try {
      const prompt = subject
        ? `Een natuurfoto die past bij: ${subject}.`
        : `Een natuurfoto die past bij deze post: ${generated.slice(0, 400)}`;
      const format = CHANNEL_FORMAT[channel] ?? "1:1";
      const title = (topic || subject || "AI-beeld").slice(0, 120);
      const result = await generateImage({
        data: {
          prompt,
          format,
          org_id: currentOrg.id,
          channel,
          title,
          caption: subject || undefined,
          save: false,
        },
      });
      if (!result.b64) throw new Error("Geen beeld ontvangen.");
      const wm = await watermarkBase64(result.b64, "image/png", title);
      const photo = await uploadPhoto({
        data: {
          org_id: currentOrg.id,
          filename: wm.filename,
          content_type: wm.contentType,
          b64: wm.b64,
          title,
          caption: subject || undefined,
          channel,
          extra_tags: ["ai-gegenereerd"],
        },
      });
      const newPhoto: Photo = {
        id: photo.id,
        title: photo.title,
        caption: photo.caption,
        tags: (photo.tags as string[] | null) ?? [],
        storage_path: photo.storage_path,
        image_url: photo.image_url,
      };
      setPhotos((prev) => [newPhoto, ...prev.filter((p) => p.id !== newPhoto.id)]);
      setSelectedPhotoId(newPhoto.id);
      toast.success("Beeld gegenereerd, gewatermerkt en toegevoegd aan bibliotheek.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Beeldgeneratie mislukt.", {
        action: { label: "Probeer opnieuw", onClick: () => void runGenerateImage() },
      });
    } finally {
      setGeneratingImage(false);
    }
  }

  async function runUploadPhoto(file: File) {
    if (!currentOrg) {
      toast.error("Geen organisatie geselecteerd.");
      return;
    }
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      toast.error("Alleen JPG, PNG of WEBP toegestaan.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Bestand is te groot (max 10 MB).");
      return;
    }
    setUploading(true);
    try {
      const wm = await watermarkImage(file);
      const title = (topic || file.name.replace(/\.[^.]+$/, "")).slice(0, 120);
      const photo = await uploadPhoto({
        data: {
          org_id: currentOrg.id,
          filename: wm.filename,
          content_type: wm.contentType,
          b64: wm.b64,
          title,
          caption: [topic, keywords].filter(Boolean).join(", ") || undefined,
          channel,
        },
      });
      const newPhoto: Photo = {
        id: photo.id,
        title: photo.title,
        caption: photo.caption,
        tags: (photo.tags as string[] | null) ?? [],
        storage_path: photo.storage_path,
        image_url: photo.image_url,
      };
      setPhotos((prev) => [newPhoto, ...prev.filter((p) => p.id !== newPhoto.id)]);
      setSelectedPhotoId(newPhoto.id);
      toast.success("Foto geüpload en toegevoegd aan bibliotheek.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload mislukt.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }



  async function runGenerate() {
    if (generating) return;
    setGenerating(true);
    // Rotate: remember currently selected photo as "recent" for this channel,
    // and clear selection so the next ranking picks a different one.
    if (selectedPhotoId) {
      setRecentByChannel((prev) => {
        const list = prev[channel] ?? [];
        const next = [selectedPhotoId, ...list.filter((id) => id !== selectedPhotoId)].slice(0, 5);
        return { ...prev, [channel]: next };
      });
      setPhotoByChannel((prev) => {
        const copy = { ...prev };
        delete copy[channel];
        return copy;
      });
    }
    setGenerated("");


    try {
      const toneLabel = TONES.find((t) => t.value === tone)?.label ?? "warm en educatief";
      const channelHint = CHANNELS.find((c) => c.value === channel)?.hint ?? "";
      const instagramPlaybook = `
INSTAGRAM VIRAL-PLAYBOOK (verplicht volgen voor Instagram):
• Doel: saves + shares + profielbezoeken. "Slow virality" via educatie en herkenning, niet schreeuwerig.
• EÉN HOOFDBOODSCHAP per post: één probleem, één inzicht, één actie.
• HOOK (max 12 woorden, eerste regel): laat scrollen stoppen.
• DEELBAARHEID: concreet, praktisch inzicht.
• STRUCTUUR probleem → oplossing met korte alinea's.
• LENGTE: MAX 150 woorden (100–140). B1, "je/jij".
• GEEN MARKDOWN. Bullets = emoji vooraan.
• EMOJI: 1–4 functioneel.
• CTA: save/share/DM/profielbezoek.
• HASHTAGS: 3–5 onderaan, mix branded + niche.
• Vermijd absolute claims, generieke "bijen" (gebruik "wilde bijen").
`;
      const facebookPlaybook = `
FACEBOOK PLAYBOOK (verplicht volgen voor Facebook):
• Doel: reacties + delen + community-gevoel. Niet "stoppen met scrollen" maar "meedoen met gesprek".
• Persoonlijker dan Instagram. Open met een herkenbare vraag of observatie ("Heb jij vroeger ook meer bijen in de tuin gezien dan nu?").
• EÉN HOOFDBOODSCHAP per post.
• STRUCTUUR: herkenbare opening → kort probleem → praktische uitleg → HappyBeez-koppeling (zacht, pas ná de educatieve waarde) → één concrete vraag of deel-CTA.
• LENGTE: 120–220 woorden. Mag iets langer en persoonlijker dan Instagram, maar nooit wollig. B1, "je/jij".
• GEEN MARKDOWN. Geen sterretjes/bullets met * of -. Korte alinea's, witregels tussen blokken.
• TOON: rustig, deskundig, natuurvriendelijk, menselijk. Lokale trots ("handgemaakt in Boekel") werkt hier sterker dan op Instagram.
• WAARDEN die delen uitlokken: zorg voor natuur, tegen verstening, kinderen iets leren, ambacht, biodiversiteit dichtbij huis, kleine actie groot effect.
• CTA: reactievraag of deel-CTA — NOOIT "sla op". Voorbeelden: "Deel dit met iemand met een tuin.", "Herken jij dit in jouw tuin?", "Welke bloemen doen het goed bij jou?", "Tag iemand die zijn tuin bijvriendelijker wil maken."
• Vermijd te algemene vragen ("Wat vind jij hiervan?") — die leveren zwakke reacties.
• Vermijd harde verkoop. Educatie eerst, product als oplossing.
• HASHTAGS: maximaal 2–4 onderaan, of helemaal geen. Geen lijst van 10 hashtags — dat oogt als marketing.
• Vermijd absolute claims, generieke "bijen" (gebruik "wilde bijen" / "solitaire bijen").
`;
      const linkedinPlaybook = `
LINKEDIN PLAYBOOK (verplicht volgen voor LinkedIn):
• Doel: reacties, shares, profielbezoeken via professionele micro-inzichten. GEEN likes-jacht, GEEN engagement farming ("reageer BIJ als…"), GEEN harde verkoop.
• TOON: professioneel, deskundig, rustig, toegankelijk, menselijk. HappyBeez = betrouwbare expert in wilde bijen, biodiversiteit en natuurvriendelijke bijenhotels.
• EÉN HOOFDBOODSCHAP per post. Eén scherpe stelling, observatie of misverstand.
• STRUCTUUR (strikt):
  1. HOOK: sterke professionele observatie of stelling in MAX 12 woorden, als losse openingsregel.
  2. Korte uitleg van probleem of misverstand (1–2 zinnen).
  3. 2–4 praktische inzichten of tips, elk op een nieuwe regel met witregel ertussen. Mag een 🌿 / ☀️ / 🐝 / 📌 emoji vooraan, maximaal één per regel.
  4. Subtiele HappyBeez-koppeling, PAS NA de educatieve waarde. Productdetails alleen als inhoudelijk relevant: handgemaakt in Boekel, onbehandeld beukenhout, Douglas hout, geborsteld RVS, diepe gladde nestgangen, verschillende diameters, verwisselbare cassettes.
  5. Afsluitende INHOUDELIJKE vraag waarop professionals vanuit eigen ervaring kunnen reageren — concreet over tuin, werkplek, bedrijfsterrein, schoolplein of duurzaam/MVO-beleid. NIET "Wat vind jij hiervan?".
• LENGTE: 900–1400 tekens. Korte zinnen, korte alinea's, witregels tussen blokken.
• GEEN MARKDOWN, geen sterretjes, geen ###-koppen, geen lijsten met "-" of "*".
• EMOJI: maximaal 3, functioneel (🌿 biodiversiteit, 🐝 bijen, ☀️ zon, 🚫 gif, 📌 checklist). Niet elke regel een emoji.
• HASHTAGS: maximaal 3 onderaan, relevant (bv. #biodiversiteit #wildebijen #bijenhotel).
• Vermijd: clickbait, overdreven claims ("red de bijen", "perfecte oplossing"), generieke "bijen" — gebruik "wilde bijen" / "solitaire bijen". Benadruk dat een bijenhotel alleen werkt mét bloemen, zon, beschutting en gifvrije omgeving.
• Relevant voor: bedrijven met groen terrein, scholen, zorginstellingen, gemeenten, hoveniers, vastgoed, recreatieparken, duurzame ondernemers, HR/CSR/ESG-verantwoordelijken én tuinliefhebbers.
`;

      const blogPlaybook = `
BLOG PLAYBOOK (verplicht volgen voor Blog):
• Doel: organisch verkeer, Google Discover, backlinks, nieuwsbriefrecirculatie. "Viraal" = distributie-architectuur, geen social spike.
• TOON: people-first, bewijsgericht, helder, deskundig. Geen overtrokken claims.
• STRUCTUUR:
  1. TITEL: uniek, concreet, belofte aan lezer (max ~60 tekens).
  2. INTRO: vraag of probleem in 2-3 zinnen, beloof de oplossing.
  3. BODY: tussenkoppen (H2/H3), korte alinea's, bullets/tabellen, eigen inzichten of observaties.
  4. HappyBeez-koppeling: productdetails alleen waar relevant (handgemaakt in Boekel, materialen, nestgangen).
  5. CONCLUSIE: samenvatting + duidelijke CTA (nieuwsbrief, gerelateerd artikel, delen).
• SEO: gebruik kernwoord natuurlijk in titel, intro en tussenkoppen. Geen keyword-stuffing.
• META: unieke meta description (~150-160 tekens), beschrijvende alt-tekst voor beelden.
• INTERN: link naar 1-2 gerelateerde artikelen of productpagina's.
• DISTRIBUTIE: social snippets en quote-cards publiceren op dag van publicatie, push via nieuwsbrief.
• LENGTE: 600-1200 woorden. Elke zin moet waarde toevoegen.
• GEEN hashtags.
`;

      const prompt = `Je schrijft een ${contentType.replace("_", " ")} post voor ${channel} namens HappyBeez — handgemaakte natuurvriendelijke bijenhotels uit Boekel.

Toon: ${toneLabel}
Platform: ${channelHint}
${topic ? `Onderwerp: ${topic}` : ""}
${keywords ? `Kernwoorden: ${keywords}` : ""}

MERKSTIJL: rustig, deskundig, natuurvriendelijk. Gebruik termen: solitaire/wilde bijen, nestelgelegenheid, biodiversiteit, onbehandeld beukenhout/Douglas, diepe gladde nestgangen, handgemaakt in Boekel.

VERMIJD: absolute claims, generiek "bijen", suggestie dat een hotel voedsel biedt, garanties.

${channel === "instagram" ? instagramPlaybook : channel === "facebook" ? facebookPlaybook : channel === "linkedin" ? linkedinPlaybook : channel === "blog" ? blogPlaybook : `CTA kort en neutraal. Geen hashtags.`}

Geef ALLEEN de posttekst terug, in het Nederlands.`;
      const { text } = await generate({ data: { prompt } });
      setGenerated(text);
      toast.success("Content gegenereerd.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "AI-fout");
    } finally {
      setGenerating(false);
    }
  }

  async function copy() {
    await navigator.clipboard.writeText(generated);
    setCopied(true);
    toast.success("Gekopieerd.");
    setTimeout(() => setCopied(false), 1800);
  }

  async function saveToCalendar() {
    if (!generated || !user) return;
    if (!currentOrg) {
      toast.error("Geen actieve organisatie geselecteerd.");
      return;
    }
    setSaving(true);
    if (search.item) {
      // Update the existing calendar item the user came from.
      const { error } = await supabase
        .from("content_calendar_items")
        .update({
          title: topic || `${contentType} — ${channel}`,
          channel,
          content_type: contentType,
          publish_date: saveDate,
          content_text: generated,
          image_url: selectedPhoto?.image_url ?? null,
          image_storage_path: selectedPhoto?.storage_path ?? null,
        })
        .eq("id", search.item);
      setSaving(false);
      if (error) return toast.error(error.message);
      toast.success("Kalender-item bijgewerkt.");
      return;
    }
    const { error } = await supabase.from("content_calendar_items").insert({
      user_id: user.id,
      org_id: currentOrg.id,
      title: topic || `${contentType} — ${channel}`,
      channel,
      content_type: contentType,
      status: "draft",
      publish_date: saveDate,
      content_text: generated,
      image_url: selectedPhoto?.image_url ?? null,
      image_storage_path: selectedPhoto?.storage_path ?? null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Opgeslagen in kalender.");
  }

  const hasPreview = channel === "instagram" || channel === "linkedin" || channel === "facebook" || channel === "blog";

  return (
    <div
      className="min-h-full"
      style={{
        ["--hb-green" as string]: "#6F8A3A",
        ["--hb-green-dark" as string]: "#56702A",
        ["--hb-dark" as string]: "#263022",
        ["--hb-wood" as string]: "#B98549",
        ["--hb-honey" as string]: "#D2A13A",
        ["--hb-offwhite" as string]: "#F6F3EA",
        ["--hb-border" as string]: "#E5E2DA",
        background: "var(--hb-offwhite)",
        color: "var(--hb-dark)",
        fontFamily: 'Inter, "Helvetica Neue", Roboto, Arial, system-ui, sans-serif',
      }}
    >
      <div className="px-4 sm:px-8 py-8 max-w-7xl mx-auto">
        <div
          className="mb-6 rounded-2xl px-6 py-7 flex items-center justify-between gap-4 shadow-sm"
          style={{
            background: "linear-gradient(135deg, var(--hb-green) 0%, var(--hb-green-dark) 100%)",
            color: "#fff",
          }}
        >
          <div>
            <span className="text-[11px] tracking-[0.22em] uppercase opacity-80">
              HappyBeez · Social Studio
            </span>
            <h1 className="font-bold text-2xl sm:text-3xl mt-1" style={{ letterSpacing: "-0.01em" }}>
              Schrijf in onze stem
            </h1>
            <p className="text-sm mt-2 opacity-90 max-w-xl">
              Rustig, deskundig en natuurvriendelijk. Eerst helpen, daarna pas verkopen.
            </p>
          </div>
          <div
            className="hidden sm:flex h-14 w-14 rounded-full items-center justify-center shrink-0"
            style={{ background: "rgba(255,255,255,0.18)" }}
          >
            <Sparkles className="w-7 h-7" style={{ color: "#fff" }} />
          </div>
        </div>

        <div className={hasPreview ? "grid lg:grid-cols-3 gap-6" : "grid lg:grid-cols-2 gap-6"}>
          {/* Settings column */}
          <div className="space-y-5">
            <div className="rounded-2xl p-6 shadow-sm" style={{ background: "#fff", border: "1px solid var(--hb-border)" }}>
              <h2 className="font-semibold mb-4 flex items-center gap-2 text-base" style={{ color: "var(--hb-dark)" }}>
                <span className="inline-block h-2 w-2 rounded-full" style={{ background: "var(--hb-green)" }} />
                Instellingen
              </h2>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Kanaal</Label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {CHANNELS.map((ch) => {
                      const active = channel === ch.value;
                      return (
                        <button
                          key={ch.value}
                          onClick={() => setChannel(ch.value)}
                          type="button"
                          className="px-3 py-2 rounded-lg text-xs font-medium transition-all text-left"
                          style={{
                            background: active ? "var(--hb-green)" : "var(--hb-offwhite)",
                            color: active ? "#fff" : "var(--hb-dark)",
                            border: `1px solid ${active ? "var(--hb-green)" : "var(--hb-border)"}`,
                          }}
                        >
                          {ch.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Type content</Label>
                  <Select value={contentType} onValueChange={(v) => setContentType(v as ContentType)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CONTENT_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Toon</Label>
                  <Select value={tone} onValueChange={(v) => setTone(v as Tone)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TONES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="topic">Onderwerp (optioneel)</Label>
                  <Input id="topic" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Bijv: solitaire metselbijen in de lente…" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="kw">Kernwoorden (optioneel)</Label>
                  <Input id="kw" value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="bijenhotel, bestuiving, biodiversiteit…" />
                </div>

                <div className="space-y-2 pt-2" style={{ borderTop: "1px dashed var(--hb-border)" }}>
                  <div className="flex items-center justify-between pt-2">
                    <Label className="mb-0">Ideeën voor deze post</Label>
                    <button
                      type="button"
                      onClick={runFetchIdeas}
                      disabled={ideasLoading}
                      className="text-[11px] underline disabled:opacity-50"
                      style={{ color: "var(--hb-green-dark)" }}
                    >
                      {ideasLoading ? "Ideeën ophalen…" : ideas.length ? "Ververs 5 ideeën" : "Genereer 5 ideeën"}
                    </button>
                  </div>
                  {ideasCampaign && (
                    <div className="text-[11px] rounded-md px-2 py-1.5" style={{ background: "var(--hb-offwhite)", border: "1px solid var(--hb-border)", color: "var(--hb-dark)" }}>
                      Campagne: <span className="font-semibold">{ideasCampaign.theme}</span>
                      {ideasCampaign.block ? <> · week {ideasCampaign.week}: {ideasCampaign.block}</> : null}
                    </div>
                  )}
                  {ideas.length > 0 && (
                    <ul className="space-y-1.5">
                      {ideas.map((idea, i) => (
                        <li key={i}>
                          <button
                            type="button"
                            onClick={() => {
                              setTopic(idea.title);
                              toast.success("Idee overgenomen als onderwerp.");
                            }}
                            className="w-full text-left rounded-lg px-3 py-2 text-xs transition-colors hover:bg-[var(--hb-offwhite)]"
                            style={{ border: "1px solid var(--hb-border)", background: "#fff", color: "var(--hb-dark)" }}
                            title="Klik om dit idee als onderwerp te gebruiken"
                          >
                            <div className="font-semibold leading-snug">{idea.title}</div>
                            {idea.hook && (
                              <div className="mt-0.5 opacity-80 leading-snug">{idea.hook}</div>
                            )}
                            {idea.angle && (
                              <div className="mt-1 text-[10px] opacity-60 italic">{idea.angle}</div>
                            )}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {!ideas.length && !ideasLoading && (
                    <p className="text-[11px]" style={{ color: "var(--hb-dark)", opacity: 0.6 }}>
                      Krijg 5 concrete ideeën op basis van de actieve maandcampagne, het gekozen kanaal en type. Klik op een idee om het over te nemen.
                    </p>
                  )}
                </div>

                <Button
                  onClick={runGenerate}
                  disabled={generating}
                  className="w-full font-semibold rounded-full h-11 hover:brightness-110 transition"
                  style={{ background: "var(--hb-green)", color: "#fff" }}
                >
                  {generating ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />AI schrijft…</>) : (<><Wand2 className="w-4 h-4 mr-2" />Content genereren</>)}
                </Button>

              </div>
            </div>
          </div>

          {/* Generated post column */}
          <div>
            <div
              className="rounded-2xl overflow-hidden min-h-[500px] flex flex-col shadow-sm"
              style={{ background: "#fff", border: "1px solid var(--hb-border)" }}
            >
              <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--hb-border)" }}>
                <h2 className="font-semibold" style={{ color: "var(--hb-dark)" }}>Gegenereerde post</h2>
                {generated && !generating && (
                  <button onClick={runGenerate} className="p-2 rounded-md transition-colors hover:bg-[var(--hb-offwhite)]" title="Opnieuw genereren" type="button" style={{ color: "var(--hb-dark)" }}>
                    <RefreshCw className="w-4 h-4" />
                  </button>
                )}
              </div>

              {generating ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: "rgba(111, 138, 58, 0.12)" }}>
                    <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--hb-green)" }} />
                  </div>
                  <p className="text-sm" style={{ color: "var(--hb-dark)", opacity: 0.7 }}>AI schrijft je post…</p>
                </div>
              ) : generated ? (
                <div className="flex-1 flex flex-col">
                  <textarea
                    value={generated}
                    onChange={(e) => setGenerated(e.target.value)}
                    spellCheck
                    className="flex-1 min-h-[280px] w-full resize-y p-5 whitespace-pre-wrap text-[15px] leading-[1.6] bg-transparent outline-none focus:ring-0 border-0"
                    style={{ color: "var(--hb-dark)" }}
                    aria-label="Bewerk de gegenereerde post"
                  />

                  <GeneratedFeedback channel={channel} text={generated} />

                  {hasPreview && (
                    <div className="p-4 border-t" style={{ borderColor: "var(--hb-border)" }}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--hb-dark)", opacity: 0.7 }}>
                          <ImageIcon className="w-3.5 h-3.5 inline mr-1" />
                          Voorgestelde foto's
                        </span>
                        <span className="text-[11px]" style={{ color: "var(--hb-dark)", opacity: 0.5 }}>
                          uit bibliotheek
                        </span>
                      </div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) void runUploadPhoto(f);
                        }}
                      />
                      {rankedPhotos.length === 0 ? (
                        <div className="space-y-2">
                          <p className="text-xs" style={{ color: "var(--hb-dark)", opacity: 0.6 }}>
                            Geen relevante foto's in je bibliotheek. Genereer er één, of upload er zelf een.
                          </p>
                          <Button
                            type="button"
                            onClick={runGenerateImage}
                            disabled={generatingImage || uploading}
                            className="w-full rounded-full font-semibold hover:brightness-110"
                            style={{ background: "var(--hb-honey)", color: "var(--hb-dark)" }}
                          >
                            {generatingImage ? (
                              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Beeld maken…</>
                            ) : (
                              <><Sparkles className="w-4 h-4 mr-2" /> Genereer beeld met AI</>
                            )}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploading || generatingImage}
                            className="w-full rounded-full font-semibold"
                            style={{ borderColor: "var(--hb-border)", color: "var(--hb-dark)" }}
                          >
                            {uploading ? (
                              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Uploaden…</>
                            ) : (
                              <><Upload className="w-4 h-4 mr-2" /> Eigen foto uploaden</>
                            )}
                          </Button>
                        </div>
                      ) : (
                        <>
                          <div className="grid grid-cols-6 gap-2">
                            {rankedPhotos.map((p) => {
                              const active = p.id === selectedPhotoId;
                              return (
                                <button
                                  key={p.id}
                                  type="button"
                                  onClick={() => setSelectedPhotoId(p.id)}
                                  title={p.title}
                                  className="aspect-square rounded-lg overflow-hidden transition-all"
                                  style={{
                                    outline: active ? "3px solid var(--hb-green)" : "1px solid var(--hb-border)",
                                    outlineOffset: active ? "1px" : "0",
                                  }}
                                >
                                  <img src={p.image_url} alt={p.title} className="w-full h-full object-cover" />
                                </button>
                              );
                            })}
                          </div>
                          <div className="mt-2 flex items-center gap-3 text-[11px]">
                            <button
                              type="button"
                              onClick={runGenerateImage}
                              disabled={generatingImage || uploading}
                              className="underline disabled:opacity-50"
                              style={{ color: "var(--hb-green-dark)" }}
                            >
                              {generatingImage ? "Beeld maken…" : "Genereer AI-beeld"}
                            </button>
                            <span style={{ color: "var(--hb-dark)", opacity: 0.4 }}>·</span>
                            <button
                              type="button"
                              onClick={() => fileInputRef.current?.click()}
                              disabled={uploading || generatingImage}
                              className="underline disabled:opacity-50"
                              style={{ color: "var(--hb-green-dark)" }}
                            >
                              {uploading ? "Uploaden…" : "Eigen foto uploaden"}
                            </button>
                          </div>
                        </>
                      )}

                    </div>
                  )}

                  <div className="p-4 space-y-3" style={{ borderTop: "1px solid var(--hb-border)" }}>
                    <div className="flex gap-2">
                      <Button onClick={copy} variant="outline" className="flex-1 rounded-full" type="button" style={{ borderColor: "var(--hb-border)", color: "var(--hb-dark)" }}>
                        {copied ? (<><CheckCheck className="w-4 h-4 mr-2" /> Gekopieerd</>) : (<><Copy className="w-4 h-4 mr-2" /> Kopiëren</>)}
                      </Button>
                    </div>
                    <div className="flex gap-2 items-end">
                      <div className="flex-1 space-y-1">
                        <Label htmlFor="save-date" className="text-xs">Datum</Label>
                        <Input id="save-date" type="date" value={saveDate} onChange={(e) => setSaveDate(e.target.value)} />
                      </div>
                      <Button onClick={saveToCalendar} disabled={saving} className="rounded-full font-semibold hover:brightness-110" style={{ background: "var(--hb-green)", color: "#fff" }}>
                        {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                        Naar kalender
                      </Button>
                    </div>
                    <SaveAdvice channel={channel} date={saveDate} />
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center gap-2 p-8 text-center">
                  <Wand2 className="w-10 h-10" style={{ color: "var(--hb-green)", opacity: 0.35 }} />
                  <p className="text-sm" style={{ color: "var(--hb-dark)", opacity: 0.7 }}>
                    Stel de instellingen in en klik op <span style={{ fontWeight: 600 }}>Content genereren</span>.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Phone mockup column */}
          {hasPreview && (
            <div className="flex flex-col items-center">
              <span className="text-xs uppercase tracking-wider mb-3" style={{ color: "var(--hb-dark)", opacity: 0.6 }}>
                Preview op telefoon
              </span>
              {channel === "instagram" && (
                <PhoneMockup image={selectedPhoto?.image_url ?? null} caption={generated} />
              )}
              {channel === "linkedin" && (
                <LinkedInMockup image={selectedPhoto?.image_url ?? null} caption={generated} />
              )}
              {channel === "facebook" && (
                <FacebookMockup image={selectedPhoto?.image_url ?? null} caption={generated} />
              )}
              {channel === "blog" && (
                <BlogMockup image={selectedPhoto?.image_url ?? null} caption={generated} title={topic} />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FeedbackChip({
  icon: Icon,
  level,
  label,
  message,
}: {
  icon: typeof AlertCircle;
  level: "good" | "warning" | "bad";
  label: string;
  message: string;
}) {
  return (
    <div
      className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs"
      style={{ background: levelBg(level), color: levelColor(level) }}
    >
      <Icon className="w-3.5 h-3.5 shrink-0" />
      <span className="font-medium">{label}:</span>
      <span>{message}</span>
    </div>
  );
}

function GeneratedFeedback({ channel, text }: { channel: StrategyChannel; text: string }) {
  const word = wordFeedback(channel, text);
  const hook = hookFeedback(channel, text);
  const tag = hashtagFeedback(channel, text);
  const rules = CHANNEL_RULES[channel];

  return (
    <div className="px-5 pb-3">
      <div className="flex flex-wrap items-center gap-2">
        <FeedbackChip
          icon={word.level === "good" ? CheckCircle2 : word.level === "warning" ? Clock : AlertCircle}
          level={word.level}
          label="Lengte"
          message={word.message || `${rules.wordRange[0]}-${rules.wordRange[1]} woorden`}
        />
        <FeedbackChip
          icon={hook.level === "good" ? CheckCircle2 : AlertCircle}
          level={hook.level}
          label="Hook"
          message={hook.message || `max ${rules.hookMaxWords} woorden`}
        />
        <FeedbackChip
          icon={tag.level === "good" ? CheckCircle2 : tag.level === "warning" ? Clock : AlertCircle}
          level={tag.level}
          label="Hashtags"
          message={tag.message || `${rules.hashtagRange[0]}-${rules.hashtagRange[1]}`}
        />
      </div>
    </div>
  );
}

function StrategyPanel({ channel }: { channel: StrategyChannel }) {
  const [open, setOpen] = useState(false);
  const rules = CHANNEL_RULES[channel];

  return (
    <div
      className="rounded-2xl overflow-hidden shadow-sm"
      style={{ background: "#fff", border: "1px solid var(--hb-border)" }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-left"
      >
        <div className="flex items-center gap-2">
          <Lightbulb className="w-4 h-4" style={{ color: "var(--hb-green)" }} />
          <span className="font-semibold text-sm" style={{ color: "var(--hb-dark)" }}>
            Strategie voor {rules.emoji} {rules.label}
          </span>
        </div>
        {open ? (
          <ChevronUp className="w-4 h-4" style={{ color: "var(--hb-dark)", opacity: 0.6 }} />
        ) : (
          <ChevronDown className="w-4 h-4" style={{ color: "var(--hb-dark)", opacity: 0.6 }} />
        )}
      </button>

      {open && (
        <div className="px-5 pb-5 pt-1 space-y-3 text-sm" style={{ color: "var(--hb-dark)" }}>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-lg p-3" style={{ background: "var(--hb-offwhite)" }}>
              <div className="font-semibold mb-1">Doel</div>
              <div style={{ opacity: 0.85 }}>{rules.goal}</div>
            </div>
            <div className="rounded-lg p-3" style={{ background: "var(--hb-offwhite)" }}>
              <div className="font-semibold mb-1">Aanbevolen format</div>
              <div style={{ opacity: 0.85 }}>{rules.format}</div>
            </div>
            <div className="rounded-lg p-3" style={{ background: "var(--hb-offwhite)" }}>
              <div className="font-semibold mb-1">Beste tijd</div>
              <div style={{ opacity: 0.85 }}>{rules.bestTimes}</div>
            </div>
            <div className="rounded-lg p-3" style={{ background: "var(--hb-offwhite)" }}>
              <div className="font-semibold mb-1">Beste dagen</div>
              <div style={{ opacity: 0.85 }}>{rules.bestDays}</div>
            </div>
          </div>

          <div>
            <div className="font-semibold mb-1.5">Tips</div>
            <ul className="space-y-1 text-xs" style={{ opacity: 0.85 }}>
              {rules.tips.map((t, i) => (
                <li key={i} className="flex gap-2">
                  <span>•</span>
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div className="font-semibold mb-1.5">Vermijd</div>
            <ul className="space-y-1 text-xs" style={{ opacity: 0.85 }}>
              {rules.avoid.map((a, i) => (
                <li key={i} className="flex gap-2">
                  <span>✕</span>
                  <span>{a}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div className="font-semibold mb-1.5">CTA-voorbeelden</div>
            <div className="flex flex-wrap gap-2">
              {rules.ctaExamples.map((cta, i) => (
                <span
                  key={i}
                  className="text-[11px] rounded-full px-2.5 py-1"
                  style={{ background: "var(--hb-offwhite)", border: "1px solid var(--hb-border)" }}
                >
                  {cta}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SaveAdvice({ channel, date }: { channel: StrategyChannel; date: string }) {
  const rules = CHANNEL_RULES[channel];
  const dayName = date
    ? new Date(date + "T12:00:00").toLocaleDateString("nl-NL", { weekday: "short" })
    : "";

  return (
    <div
      className="rounded-xl px-4 py-3 text-xs"
      style={{ background: "rgba(111, 138, 58, 0.10)", color: "var(--hb-dark)" }}
    >
      <div className="flex items-start gap-2">
        <Clock className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "var(--hb-green)" }} />
        <div className="space-y-1">
          <div className="font-semibold">Advies bij opslaan</div>
          <div>
            Voor {rules.label} gebruik je best een <span className="font-medium">{rules.format}</span>.
            {rules.bestTimes !== "n.v.t." && (
              <> Ideale posttijd: <span className="font-medium">{rules.bestTimes}</span>.</>
            )}
            {date && rules.bestDays !== "n.v.t." && (
              <> {dayName} valt binnen <span className="font-medium">{rules.bestDays}</span>.</>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function PhoneMockup({ image, caption }: { image: string | null; caption: string }) {
  const username = "happybeez";
  // strip markdown leftovers just in case
  const cleaned = caption.replace(/\*\*/g, "").replace(/^\* /gm, "• ");
  return (
    <div
      className="relative w-[300px] rounded-[44px] p-3 shadow-2xl"
      style={{ background: "#0f0f10" }}
    >
      {/* notch */}
      <div className="absolute top-2 left-1/2 -translate-x-1/2 h-5 w-24 rounded-full" style={{ background: "#0f0f10" }} />
      <div className="rounded-[34px] overflow-hidden bg-white" style={{ height: 620 }}>
        {/* IG top bar */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-200">
          <span className="text-base font-semibold" style={{ fontFamily: "'Segoe Script', cursive" }}>Instagram</span>
          <div className="flex gap-3 text-neutral-700">
            <Heart className="w-5 h-5" />
            <Send className="w-5 h-5" />
          </div>
        </div>
        {/* post header */}
        <div className="flex items-center justify-between px-3 py-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full p-[2px]" style={{ background: "linear-gradient(45deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)" }}>
              <div className="w-full h-full rounded-full bg-white p-[1.5px]">
                <div className="w-full h-full rounded-full" style={{ background: "var(--hb-green)" }} />
              </div>
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-[12px] font-semibold">{username}</span>
              <span className="text-[10px] text-neutral-500">Boekel · Gesponsord</span>
            </div>
          </div>
          <MoreHorizontal className="w-4 h-4 text-neutral-700" />
        </div>
        {/* image */}
        <div className="w-full bg-neutral-100" style={{ aspectRatio: "1 / 1" }}>
          {image ? (
            <img src={image} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-neutral-400 text-xs">
              <ImageIcon className="w-8 h-8" />
            </div>
          )}
        </div>
        {/* actions */}
        <div className="px-3 pt-2 flex items-center justify-between">
          <div className="flex gap-3 text-neutral-900">
            <Heart className="w-6 h-6" />
            <MessageCircle className="w-6 h-6" />
            <Send className="w-6 h-6" />
          </div>
          <Bookmark className="w-6 h-6 text-neutral-900" />
        </div>
        <div className="px-3 pt-1 text-[12px] font-semibold">128 vind-ik-leuks</div>
        {/* caption */}
        <div className="px-3 pt-1 pb-3 text-[12px] leading-snug max-h-[140px] overflow-y-auto">
          <span className="font-semibold mr-1">{username}</span>
          <span className="whitespace-pre-wrap text-neutral-800">
            {cleaned || "Je caption verschijnt hier…"}
          </span>
        </div>
      </div>
    </div>
  );
}

function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div className="relative w-[300px] rounded-[44px] p-3 shadow-2xl" style={{ background: "#0f0f10" }}>
      <div className="absolute top-2 left-1/2 -translate-x-1/2 h-5 w-24 rounded-full" style={{ background: "#0f0f10" }} />
      <div className="rounded-[34px] overflow-hidden bg-white" style={{ height: 620 }}>
        {children}
      </div>
    </div>
  );
}

function cleanText(t: string) {
  return t.replace(/\*\*/g, "").replace(/^\* /gm, "• ");
}

function LinkedInMockup({ image, caption }: { image: string | null; caption: string }) {
  const cleaned = cleanText(caption);
  return (
    <PhoneFrame>
      <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-200" style={{ background: "#fff" }}>
        <span className="text-[15px] font-bold" style={{ color: "#0a66c2" }}>in</span>
        <span className="text-[11px] text-neutral-500">Startpagina</span>
      </div>
      <div className="px-3 py-2 flex items-start gap-2">
        <div className="w-10 h-10 rounded-full shrink-0" style={{ background: "var(--hb-green)" }} />
        <div className="flex flex-col leading-tight">
          <span className="text-[12px] font-semibold">HappyBeez</span>
          <span className="text-[10px] text-neutral-500">Handgemaakte bijenhotels · Boekel</span>
          <span className="text-[10px] text-neutral-500">2 u · 🌍</span>
        </div>
      </div>
      <div className="px-3 pb-2 text-[12px] leading-snug max-h-[230px] overflow-y-auto whitespace-pre-wrap text-neutral-800">
        {cleaned || "Je post verschijnt hier…"}
      </div>
      {image && (
        <div className="w-full bg-neutral-100" style={{ aspectRatio: "1.91 / 1" }}>
          <img src={image} alt="" className="w-full h-full object-cover" />
        </div>
      )}
      <div className="px-3 py-2 flex items-center justify-between text-[11px] text-neutral-500 border-t border-neutral-200">
        <div className="flex items-center gap-1">
          <span className="w-4 h-4 rounded-full inline-flex items-center justify-center text-white text-[9px]" style={{ background: "#0a66c2" }}>👍</span>
          <span>42</span>
        </div>
        <span>6 reacties · 3 reposts</span>
      </div>
      <div className="px-3 py-2 grid grid-cols-4 gap-1 text-[10px] text-neutral-600 border-t border-neutral-200">
        <div className="flex flex-col items-center gap-0.5"><ThumbsUp className="w-4 h-4" />Vind ik</div>
        <div className="flex flex-col items-center gap-0.5"><MessageCircle className="w-4 h-4" />Reageer</div>
        <div className="flex flex-col items-center gap-0.5"><Share2 className="w-4 h-4" />Repost</div>
        <div className="flex flex-col items-center gap-0.5"><Send className="w-4 h-4" />Verstuur</div>
      </div>
    </PhoneFrame>
  );
}

function FacebookMockup({ image, caption }: { image: string | null; caption: string }) {
  const cleaned = cleanText(caption);
  return (
    <PhoneFrame>
      <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-200" style={{ background: "#fff" }}>
        <span className="text-[16px] font-extrabold" style={{ color: "#1877f2" }}>facebook</span>
        <Send className="w-4 h-4 text-neutral-700" />
      </div>
      <div className="px-3 py-2 flex items-center gap-2">
        <div className="w-10 h-10 rounded-full shrink-0" style={{ background: "var(--hb-green)" }} />
        <div className="flex flex-col leading-tight">
          <span className="text-[12px] font-semibold">HappyBeez</span>
          <span className="text-[10px] text-neutral-500">2 u · 🌍</span>
        </div>
      </div>
      <div className="px-3 pb-2 text-[12px] leading-snug max-h-[200px] overflow-y-auto whitespace-pre-wrap text-neutral-800">
        {cleaned || "Je post verschijnt hier…"}
      </div>
      {image && (
        <div className="w-full bg-neutral-100" style={{ aspectRatio: "1 / 1" }}>
          <img src={image} alt="" className="w-full h-full object-cover" />
        </div>
      )}
      <div className="px-3 py-2 flex items-center justify-between text-[11px] text-neutral-500 border-t border-neutral-200">
        <div className="flex items-center gap-1">
          <span className="w-4 h-4 rounded-full inline-flex items-center justify-center text-white text-[9px]" style={{ background: "#1877f2" }}>👍</span>
          <span>128 · Anna en 12 anderen</span>
        </div>
      </div>
      <div className="px-3 py-2 grid grid-cols-3 gap-1 text-[11px] text-neutral-600 border-t border-neutral-200">
        <div className="flex items-center justify-center gap-1"><ThumbsUp className="w-4 h-4" />Vind ik leuk</div>
        <div className="flex items-center justify-center gap-1"><MessageCircle className="w-4 h-4" />Reageer</div>
        <div className="flex items-center justify-center gap-1"><Share2 className="w-4 h-4" />Delen</div>
      </div>
    </PhoneFrame>
  );
}

function BlogMockup({ image, caption, title }: { image: string | null; caption: string; title: string }) {
  const cleaned = cleanText(caption);
  return (
    <PhoneFrame>
      <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-200 bg-neutral-50">
        <Globe className="w-4 h-4 text-neutral-500" />
        <span className="text-[11px] text-neutral-600 truncate">happybeez.nl/blog</span>
        <MoreHorizontal className="w-4 h-4 text-neutral-500" />
      </div>
      <div className="overflow-y-auto" style={{ height: 580 }}>
        {image && (
          <div className="w-full bg-neutral-100" style={{ aspectRatio: "16 / 9" }}>
            <img src={image} alt="" className="w-full h-full object-cover" />
          </div>
        )}
        <div className="px-4 py-3">
          <span className="text-[10px] uppercase tracking-wider" style={{ color: "var(--hb-green-dark)" }}>HappyBeez · Blog</span>
          <h3 className="text-[16px] font-bold leading-tight mt-1 mb-2" style={{ color: "var(--hb-dark)" }}>
            {title || "Titel van je artikel"}
          </h3>
          <div className="flex items-center gap-2 text-[10px] text-neutral-500 mb-3">
            <div className="w-5 h-5 rounded-full" style={{ background: "var(--hb-green)" }} />
            <span>HappyBeez · 4 min lezen</span>
          </div>
          <div className="text-[12px] leading-relaxed whitespace-pre-wrap text-neutral-800">
            {cleaned || "Je artikel verschijnt hier…"}
          </div>
        </div>
      </div>
    </PhoneFrame>
  );
}
