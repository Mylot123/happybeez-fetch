import { useState, type ReactNode } from "react";
import {
  Heart,
  Send,
  MessageCircle,
  Bookmark,
  MoreHorizontal,
  Image as ImageIcon,
  ThumbsUp,
  Share2,
  Globe,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

const HB_VARS: Record<string, string> = {
  "--hb-green": "#6F8A3A",
  "--hb-green-dark": "#56702A",
  "--hb-dark": "#263022",
};

export function cleanText(t: string) {
  return t.replace(/\*\*/g, "").replace(/^\* /gm, "• ");
}

export function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div className="relative w-[300px] rounded-[44px] p-3 shadow-2xl" style={{ background: "#0f0f10" }}>
      <div className="absolute top-2 left-1/2 -translate-x-1/2 h-5 w-24 rounded-full" style={{ background: "#0f0f10" }} />
      <div className="rounded-[34px] overflow-hidden bg-white" style={{ height: 620 }}>
        {children}
      </div>
    </div>
  );
}

function ImageOverlay({ text }: { text?: string }) {
  if (!text) return null;
  return (
    <div className="absolute inset-x-0 bottom-0 p-4 flex items-end" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.25) 60%, transparent 100%)", minHeight: "35%" }}>
      <p className="text-white font-semibold text-[16px] leading-tight line-clamp-2 drop-shadow-md" style={{ textShadow: "0 1px 3px rgba(0,0,0,0.4)", fontFamily: "var(--font-heading)" }}>
        {text}
      </p>
    </div>
  );
}

/** Beeldvlak met optionele carrousel-navigatie (pijlen + dots). */
export function SlideStage({
  image,
  overlayText,
  slides,
  slideImages,
  aspect = "1 / 1",
}: {
  image: string | null;
  overlayText?: string;
  slides?: string[];
  slideImages?: (string | null | undefined)[];
  aspect?: string;
}) {
  const hasSlides = Array.isArray(slides) && slides.length > 0;
  const [slideIdx, setSlideIdx] = useState(0);
  const overlays = hasSlides ? slides : overlayText ? [overlayText] : [];
  const idx = Math.min(slideIdx, Math.max(0, overlays.length - 1));
  const currentOverlay = overlays[idx] ?? overlayText;
  const currentImage = (hasSlides ? slideImages?.[idx] : null) ?? image;

  return (
    <div className="relative w-full bg-neutral-100" style={{ aspectRatio: aspect }}>
      {currentImage ? (
        <img src={currentImage} alt="" className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-neutral-400 text-xs">
          <ImageIcon className="w-8 h-8" />
        </div>
      )}
      <ImageOverlay text={currentOverlay} />
      {hasSlides && overlays.length > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setSlideIdx((i) => (i - 1 + overlays.length) % overlays.length); }}
            className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/40 text-white flex items-center justify-center hover:bg-black/60 transition"
            aria-label="Vorige slide"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setSlideIdx((i) => (i + 1) % overlays.length); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/40 text-white flex items-center justify-center hover:bg-black/60 transition"
            aria-label="Volgende slide"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <div className="absolute top-2 right-2 rounded-full bg-black/50 text-white text-[10px] px-2 py-0.5">
            {idx + 1}/{overlays.length}
          </div>
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
            {overlays.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={(e) => { e.stopPropagation(); setSlideIdx(i); }}
                className="w-1.5 h-1.5 rounded-full transition"
                style={{ background: i === idx ? "#fff" : "rgba(255,255,255,0.45)" }}
                aria-label={`Ga naar slide ${i + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function PhoneMockup({
  image,
  caption,
  overlayText,
  slides,
  slideImages,
}: {
  image: string | null;
  caption: string;
  overlayText?: string;
  slides?: string[];
  slideImages?: (string | null | undefined)[];
}) {
  const username = "happybeez";
  const cleaned = cleanText(caption);

  return (
    <div
      className="relative w-[300px] rounded-[44px] p-3 shadow-2xl"
      style={{ background: "#0f0f10" }}
    >
      <div className="absolute top-2 left-1/2 -translate-x-1/2 h-5 w-24 rounded-full" style={{ background: "#0f0f10" }} />
      <div className="rounded-[34px] overflow-hidden bg-white" style={{ height: 620 }}>
        <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-200">
          <span className="text-base font-semibold" style={{ fontFamily: "'Segoe Script', cursive" }}>Instagram</span>
          <div className="flex gap-3 text-neutral-700">
            <Heart className="w-5 h-5" />
            <Send className="w-5 h-5" />
          </div>
        </div>
        <div className="flex items-center justify-between px-3 py-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full p-[2px]" style={{ background: "linear-gradient(45deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)" }}>
              <div className="w-full h-full rounded-full bg-white p-[1.5px]">
                <div className="w-full h-full rounded-full" style={{ background: "var(--hb-green)" }} />
              </div>
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-[12px] font-semibold">{username}</span>
              <span className="text-[10px] text-neutral-500">Boekel</span>
            </div>
          </div>
          <MoreHorizontal className="w-4 h-4 text-neutral-700" />
        </div>
        <SlideStage image={image} overlayText={overlayText} slides={slides} slideImages={slideImages} />
        <div className="px-3 pt-2 flex items-center justify-between">
          <div className="flex gap-3 text-neutral-900">
            <Heart className="w-6 h-6" />
            <MessageCircle className="w-6 h-6" />
            <Send className="w-6 h-6" />
          </div>
          <Bookmark className="w-6 h-6 text-neutral-900" />
        </div>
        <div className="px-3 pt-1 text-[12px] font-semibold">128 vind-ik-leuks</div>
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

export function LinkedInMockup({ image, caption, overlayText }: { image: string | null; caption: string; overlayText?: string }) {
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
          <span className="text-[12px] font-semibold">Happybeez</span>
          <span className="text-[10px] text-neutral-500">Handgemaakte bijenhotels · Boekel</span>
          <span className="text-[10px] text-neutral-500">2 u · 🌍</span>
        </div>
      </div>
      <div className="px-3 pb-2 text-[12px] leading-snug max-h-[230px] overflow-y-auto whitespace-pre-wrap text-neutral-800">
        {cleaned || "Je post verschijnt hier…"}
      </div>
      {image && (
        <div className="relative w-full bg-neutral-100" style={{ aspectRatio: "1.91 / 1" }}>
          <img src={image} alt="" className="w-full h-full object-cover" />
          <ImageOverlay text={overlayText} />
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

export function FacebookMockup({ image, caption, overlayText, slides, slideImages }: { image: string | null; caption: string; overlayText?: string; slides?: string[]; slideImages?: (string | null | undefined)[] }) {
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
          <span className="text-[12px] font-semibold">Happybeez</span>
          <span className="text-[10px] text-neutral-500">2 u · 🌍</span>
        </div>
      </div>
      <div className="px-3 pb-2 text-[12px] leading-snug max-h-[200px] overflow-y-auto whitespace-pre-wrap text-neutral-800">
        {cleaned || "Je post verschijnt hier…"}
      </div>
      {(image || (slides && slides.length > 0)) && (
        <SlideStage image={image} overlayText={overlayText} slides={slides} slideImages={slideImages} />
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

export function BlogMockup({ image, caption, title }: { image: string | null; caption: string; title: string }) {
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
          <span className="text-[10px] uppercase tracking-wider" style={{ color: "var(--hb-green-dark)" }}>Happybeez · Blog</span>
          <h3 className="text-[16px] font-bold leading-tight mt-1 mb-2" style={{ color: "var(--hb-dark)" }}>
            {title || "Titel van je artikel"}
          </h3>
          <div className="flex items-center gap-2 text-[10px] text-neutral-500 mb-3">
            <div className="w-5 h-5 rounded-full" style={{ background: "var(--hb-green)" }} />
            <span>Happybeez · 4 min lezen</span>
          </div>
          <div className="text-[12px] leading-relaxed whitespace-pre-wrap text-neutral-800">
            {cleaned || "Je artikel verschijnt hier…"}
          </div>
        </div>
      </div>
    </PhoneFrame>
  );
}

/** Kanaal-onafhankelijke preview: toont de post zoals hij er live uitziet. */
export function PostMockup({
  channel,
  image,
  caption,
  title,
  slides,
  slideImages,
}: {
  channel: string;
  image: string | null;
  caption: string;
  title?: string;
  slides?: string[];
  slideImages?: (string | null | undefined)[];
}) {
  const inner =
    channel === "linkedin" ? (
      <LinkedInMockup image={image} caption={caption} overlayText={title} />
    ) : channel === "facebook" ? (
      <FacebookMockup image={image} caption={caption} overlayText={title} slides={slides} slideImages={slideImages} />
    ) : channel === "blog" || channel === "website" ? (
      <BlogMockup image={image} caption={caption} title={title ?? ""} />
    ) : (
      <PhoneMockup image={image} caption={caption} overlayText={title} slides={slides} slideImages={slideImages} />
    );
  return <div style={HB_VARS as React.CSSProperties}>{inner}</div>;
}
