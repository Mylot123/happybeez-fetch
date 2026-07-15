import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const askSchema = z.object({
  question: z.string().min(2).max(500),
});

type Source = {
  id: string;
  title: string;
  snippet: string;
  page: number | null;
  chapter: string | null;
  origin: "library_book_sections" | "book_contents";
};

type AIResponse = { choices: Array<{ message: { content: string } }> };

const NL_STOPWORDS = new Set([
  "aan","als","bij","dan","dat","der","des","deze","die","dit","doe","doen","door","een","eens","elk","elke","els","enig","enige","erg","gaan","geen","ging","haar","had","heb","hebben","heeft","hem","het","hij","hoe","hun","iet","ietsy","iets","ieder","ik","kan","kon","laat","laten","meer","men","met","moet","moeten","naar","niet","nog","noem","och","och","ook","over","per","reeds","tegen","toch","toen","tot","uit","van","vaak","veel","voor","waar","wat","wanneer","was","wel","werd","werden","werd","weet","weten","wie","wij","wilt","word","worden","zal","zei","zij","zijn","zich","zo","zoals","zou","zouden","zult","echt","alle","alles","aldus","altijd","andere","anders","beetje","beter","best","bijna","daar","daarom","dus","eerst","enkel","erin","erop","even","gaat","geef","gewoon","goed","groot","heel","hier","hoe","iemand","ieder","ik","je","jij","jouw","jullie","kunnen","maar","mij","min","misschien","mijn","na","namelijk","nee","niks","nu","ons","onze","ooit","onder","op","reeds","samen","soms","staan","staat","tegen","teveel","tja","toen","ver","vroeg","waarom","waarvan","wanneer","weinig","weer","welke","wel","zeer","zeker","zelf","zulk","zulke","the","and","for","that","this","with","you","your","are","was","were","not","but","have","has","had"
]);

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !NL_STOPWORDS.has(w));
}

function countMatches(text: string, tok: string): number {
  const re = new RegExp(tok.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
  const m = text.match(re);
  return m ? m.length : 0;
}

export const askBook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => askSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const tokens = tokenize(data.question);
    if (tokens.length === 0) {
      return { answer: "Stel een vraag met meer trefwoorden.", sources: [] as Source[] };
    }

    // Fetch all sections + user-owned book_contents (cheap for our scale)
    const [{ data: sections }, { data: contents }] = await Promise.all([
      supabase
        .from("library_book_sections")
        .select("id,title,content,page_start,book_id")
        .limit(5000),
      supabase
        .from("book_contents")
        .select("id,title,content,page_number,chapter")
        .limit(5000),
    ]);

    // Build documents
    type Doc = {
      id: string;
      title: string;
      content: string;
      page: number | null;
      chapter: string | null;
      origin: "library_book_sections" | "book_contents";
    };
    const docs: Doc[] = [
      ...(sections ?? []).map((r) => ({
        id: r.id,
        title: r.title,
        content: r.content,
        page: r.page_start,
        chapter: null,
        origin: "library_book_sections" as const,
      })),
      ...(contents ?? []).map((r) => ({
        id: r.id,
        title: r.title,
        content: r.content,
        page: r.page_number,
        chapter: r.chapter,
        origin: "book_contents" as const,
      })),
    ];

    // IDF per token — rare terms weigh much more than common ones
    const N = Math.max(docs.length, 1);
    const df = new Map<string, number>();
    const lower = docs.map((d) => `${d.title}\n${d.content}`.toLowerCase());
    for (const tok of tokens) {
      let c = 0;
      const re = new RegExp(tok.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      for (const l of lower) if (re.test(l)) c++;
      df.set(tok, c);
    }
    const idf = new Map<string, number>();
    for (const tok of tokens) {
      const d = df.get(tok) ?? 0;
      idf.set(tok, d === 0 ? 0 : Math.log(1 + N / d));
    }
    // Rare tokens = those that appear in <20% of docs
    const rareTokens = tokens.filter((t) => (df.get(t) ?? 0) > 0 && (df.get(t) ?? 0) < N * 0.2);

    const scored: Array<Source & { score: number; full: string }> = [];
    for (let i = 0; i < docs.length; i++) {
      const d = docs[i];
      const text = lower[i];
      let s = 0;
      let rareHits = 0;
      for (const tok of tokens) {
        const c = countMatches(text, tok);
        if (c > 0) {
          s += c * (idf.get(tok) ?? 0);
          if (rareTokens.includes(tok)) rareHits++;
        }
      }
      // Boost docs that contain all rare tokens (specific match)
      if (rareTokens.length > 0 && rareHits === rareTokens.length) s *= 3;
      if (s > 0) {
        scored.push({
          id: d.id,
          title: d.title,
          snippet: d.content.slice(0, 800),
          page: d.page,
          chapter: d.chapter,
          origin: d.origin,
          score: s,
          full: d.content,
        });
      }
    }

    scored.sort((a, b) => b.score - a.score);
    const top = scored.slice(0, 8);


    if (top.length === 0) {
      return {
        answer:
          "Ik kon hier in de boekbibliotheek niets over vinden. Probeer andere trefwoorden, of voeg het fragment toe.",
        sources: [] as Source[],
      };
    }

    // Build RAG prompt
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY ontbreekt.");

    const contextBlock = top
      .map(
        (s, i) =>
          `[${i + 1}] ${s.title}${s.page ? ` (p. ${s.page})` : ""}\n${s.full.slice(0, 1500)}`,
      )
      .join("\n\n---\n\n");

    const systemPrompt = `Je bent een onderzoeksassistent voor de HappyBeez-boekbibliotheek. Antwoord ALLEEN op basis van de meegegeven fragmenten. Citeer relevante delen kort. Gebruik bronverwijzingen als [1], [2] enzovoort. Als het antwoord niet in de fragmenten staat, zeg dat eerlijk. Schrijf in helder Nederlands, B1, maximaal 200 woorden.`;

    const userPrompt = `Vraag: ${data.question}\n\nFRAGMENTEN:\n${contextBlock}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-5",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });
    if (res.status === 429) throw new Error("Limiet bereikt — probeer het zo nog eens.");
    if (res.status === 402) throw new Error("AI-tegoed op.");
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`AI fout (${res.status}): ${txt.slice(0, 200)}`);
    }
    const json = (await res.json()) as AIResponse;
    const answer = json.choices?.[0]?.message?.content?.trim() ?? "Geen antwoord.";

    const sources: Source[] = top.map((s) => ({
      id: s.id,
      title: s.title,
      snippet: s.snippet,
      page: s.page,
      chapter: s.chapter,
      origin: s.origin,
    }));

    return { answer, sources };
  });
