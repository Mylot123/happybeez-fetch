import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Copy, FileText, Loader2, Sparkles, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { checkIntentSnippet, checkProductPage, generateBlogConcept, type BlogConcept, type IntentCheck, type ProductCheck } from "@/lib/seo-intent.functions";

const copy = (t: string) => {
  navigator.clipboard.writeText(t);
  toast.success("Gekopieerd");
};

export function SeoIntentChecker({ defaultUrl = "" }: { defaultUrl?: string }) {
  const run = useServerFn(checkIntentSnippet);
  const [url, setUrl] = useState(defaultUrl);
  const [kw, setKw] = useState("");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<IntentCheck | null>(null);

  const go = async () => {
    if (!url.trim() || !kw.trim()) return toast.error("Vul een pagina en een zoekwoord in.");
    setBusy(true);
    try {
      setRes(await run({ data: { url, keyword: kw } }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Controle mislukt");
    } finally {
      setBusy(false);
    }
  };

  const color = (s: number) => (s >= 75 ? "text-emerald-700" : s >= 50 ? "text-amber-600" : "text-red-600");

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div>
        <h3 className="font-heading text-xl text-ink">Past je pagina bij de zoekvraag?</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Controleert of de pagina geeft wat de zoeker zoekt, en of Google er een direct antwoord uit kan halen.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
        <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="happybeez.nl/pagina" />
        <Input value={kw} onChange={(e) => setKw(e.target.value)} placeholder="Zoekwoord, bv. bijenhotel ophangen" />
        <Button onClick={go} disabled={busy} className="bg-wine text-white hover:bg-wine/90">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Controleer
        </Button>
      </div>

      {res ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-4 rounded-lg bg-muted/40 p-4">
            <div className={`text-4xl font-bold ${color(res.score)}`}>{res.score}</div>
            <div className="flex-1 min-w-[14rem] text-sm">
              <p className="font-medium text-ink">
                {res.intent.match ? "De pagina past bij de zoekvraag" : "De pagina past niet goed bij de zoekvraag"}
              </p>
              <p className="text-muted-foreground">
                Zoeker wil: <b>{res.intent.expected || "?"}</b> · Pagina biedt: <b>{res.intent.page || "?"}</b> · {res.woorden} woorden
              </p>
              {res.intent.uitleg ? <p className="mt-1">{res.intent.uitleg}</p> : null}
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {res.checks.map((c) => (
              <div key={c.label} className="flex gap-2 text-sm rounded-md border border-border p-2">
                {c.ok ? <CheckCircle2 className="h-4 w-4 text-emerald-700 shrink-0 mt-0.5" /> : <XCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />}
                <div>
                  <p className="font-medium text-ink">{c.label}</p>
                  {!c.ok ? <p className="text-muted-foreground">{c.tip}</p> : null}
                </div>
              </div>
            ))}
          </div>

          {res.acties.length ? (
            <div>
              <p className="font-medium text-ink mb-1">Doe dit eerst</p>
              <ol className="list-decimal pl-5 text-sm space-y-1">
                {res.acties.map((a) => <li key={a}>{a}</li>)}
              </ol>
            </div>
          ) : null}

          {res.snippet_voorstel ? (
            <div className="rounded-lg border border-border p-3">
              <div className="flex items-center justify-between">
                <p className="font-medium text-ink">Direct antwoord voor bovenaan de pagina</p>
                <Button size="sm" variant="ghost" onClick={() => copy(res.snippet_voorstel)}><Copy className="h-4 w-4" /></Button>
              </div>
              <p className="text-sm mt-1">{res.snippet_voorstel}</p>
            </div>
          ) : null}

          {res.vraagkoppen.length ? (
            <div className="rounded-lg border border-border p-3 space-y-2">
              <p className="font-medium text-ink">Vragen die je als tussenkop kunt toevoegen</p>
              {res.vraagkoppen.map((v) => (
                <div key={v.vraag} className="text-sm">
                  <p className="font-medium">{v.vraag}</p>
                  <p className="text-muted-foreground">{v.antwoord}</p>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function SeoBlogConcept({ initialKeyword = "" }: { initialKeyword?: string }) {
  const run = useServerFn(generateBlogConcept);
  const [kw, setKw] = useState(initialKeyword);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<BlogConcept | null>(null);

  const go = async () => {
    if (!kw.trim()) return toast.error("Vul een zoekwoord in.");
    setBusy(true);
    try {
      setRes(await run({ data: { keyword: kw } }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Maken mislukt");
    } finally {
      setBusy(false);
    }
  };

  const asText = (r: BlogConcept) =>
    [
      `Titel: ${r.titel}`,
      `Metabeschrijving: ${r.meta}`,
      "",
      r.intro,
      "",
      ...r.secties.flatMap((s) => [`## ${s.kop}`, s.antwoord, ...s.punten.map((p) => `- ${p}`), ""]),
      "Eigen ervaring tonen:",
      ...r.ervaring.map((e) => `- ${e}`),
      "",
      "Interne links:",
      ...r.interne_links.map((l) => `- ${l}`),
    ].join("\n");

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div>
        <h3 className="font-heading text-xl text-ink">Van zoekwoord naar blog</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Kies een zoekwoord en krijg een kant en klare opbouw: titel, direct antwoord, vraagkoppen en tips om je vakkennis te laten zien.
        </p>
      </div>
      <div className="flex gap-3">
        <Input value={kw} onChange={(e) => setKw(e.target.value)} placeholder="bv. wanneer bijenhotel ophangen" />
        <Button onClick={go} disabled={busy} className="bg-wine text-white hover:bg-wine/90">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />} Maak blogopzet
        </Button>
      </div>
      {res ? (
        <div className="space-y-3 text-sm">
          <div className="flex justify-end">
            <Button size="sm" variant="outline" onClick={() => copy(asText(res))}><Copy className="h-4 w-4" /> Kopieer alles</Button>
          </div>
          <p><b>Titel:</b> {res.titel}</p>
          <p><b>Metabeschrijving:</b> {res.meta}</p>
          <p className="rounded-md bg-muted/40 p-3">{res.intro}</p>
          {res.secties.map((s) => (
            <div key={s.kop}>
              <p className="font-heading text-ink text-base">{s.kop}</p>
              <p>{s.antwoord}</p>
              {s.punten.length ? <ul className="list-disc pl-5">{s.punten.map((p) => <li key={p}>{p}</li>)}</ul> : null}
            </div>
          ))}
          {res.ervaring.length ? (
            <div><p className="font-medium text-ink">Laat je vakkennis zien</p><ul className="list-disc pl-5">{res.ervaring.map((e) => <li key={e}>{e}</li>)}</ul></div>
          ) : null}
          {res.interne_links.length ? (
            <div><p className="font-medium text-ink">Link naar</p><ul className="list-disc pl-5">{res.interne_links.map((e) => <li key={e}>{e}</li>)}</ul></div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function SeoProductChecker() {
  const run = useServerFn(checkProductPage);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<ProductCheck | null>(null);

  const go = async () => {
    if (!url.trim()) return toast.error("Vul de link van een productpagina in.");
    setBusy(true);
    try {
      setRes(await run({ data: { url } }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Controle mislukt");
    } finally {
      setBusy(false);
    }
  };
  const color = (s: number) => (s >= 75 ? "text-emerald-700" : s >= 50 ? "text-amber-600" : "text-red-600");

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div>
        <h3 className="font-heading text-xl text-ink">Productpagina en AI-vindbaarheid</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Controleert een productpagina op koopsignalen, meet hoe goed AI-zoekmachines je tekst kunnen citeren en maakt de Google-productcode klaar om te plakken.
        </p>
      </div>
      <div className="flex gap-3">
        <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="happybeez.nl/product/bijenhotel" />
        <Button onClick={go} disabled={busy} className="bg-wine text-white hover:bg-wine/90">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Controleer product
        </Button>
      </div>

      {res ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg bg-muted/40 p-4">
              <div className={`text-4xl font-bold ${color(res.productScore)}`}>{res.productScore}</div>
              <p className="font-medium text-ink">Productpagina-score</p>
              <p className="text-sm text-muted-foreground">Hoe compleet de pagina is voor kopers en Google.</p>
            </div>
            <div className="rounded-lg bg-muted/40 p-4">
              <div className={`text-4xl font-bold ${color(res.citability.score)}`}>{res.citability.score}</div>
              <p className="font-medium text-ink">AI-citeerbaarheid</p>
              <p className="text-sm text-muted-foreground">{res.citability.uitleg || "Hoe makkelijk ChatGPT of Google AI je tekst als bron gebruikt."}</p>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {res.checks.map((c) => (
              <div key={c.label} className="flex gap-2 text-sm rounded-md border border-border p-2">
                {c.ok ? <CheckCircle2 className="h-4 w-4 text-emerald-700 shrink-0 mt-0.5" /> : <XCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />}
                <div>
                  <p className="font-medium text-ink">{c.label}</p>
                  {!c.ok ? <p className="text-muted-foreground">{c.tip}</p> : null}
                </div>
              </div>
            ))}
          </div>

          {res.titelVoorstel ? (
            <div className="rounded-lg border border-border p-3 flex items-center justify-between gap-2">
              <p className="text-sm"><b>Voorstel paginatitel:</b> {res.titelVoorstel}</p>
              <Button size="sm" variant="ghost" onClick={() => copy(res.titelVoorstel)}><Copy className="h-4 w-4" /></Button>
            </div>
          ) : null}

          {res.productTips.length ? (
            <div>
              <p className="font-medium text-ink mb-1">Beter verkopen en gevonden worden</p>
              <ol className="list-decimal pl-5 text-sm space-y-1">{res.productTips.map((a) => <li key={a}>{a}</li>)}</ol>
            </div>
          ) : null}

          <div className="rounded-lg border border-border p-3 space-y-2 text-sm">
            <p className="font-medium text-ink">Beter geciteerd worden door AI</p>
            {res.citability.zinnen.length ? (
              <div>
                <p className="text-muted-foreground">Deze zinnen zijn nu al goed bruikbaar als antwoord:</p>
                <ul className="list-disc pl-5">{res.citability.zinnen.map((z) => <li key={z}>"{z}"</li>)}</ul>
              </div>
            ) : null}
            {res.citability.tips.length ? <ol className="list-decimal pl-5">{res.citability.tips.map((t) => <li key={t}>{t}</li>)}</ol> : null}
          </div>

          <div className="rounded-lg border border-border p-3 space-y-2">
            <div className="flex items-center justify-between">
              <p className="font-medium text-ink">Google-productcode (Product Schema)</p>
              <Button size="sm" variant="outline" onClick={() => copy(res.jsonLd)}><Copy className="h-4 w-4" /> Kopieer code</Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Geef dit aan de webbeheerder. Die plakt het in de productpagina (bijvoorbeeld via een HTML-blok of een SEO-plugin). Gebruikt de webshop al een plugin die dit automatisch doet, dan is plakken niet nodig.
            </p>
            <pre className="text-xs bg-muted/40 rounded-md p-3 overflow-x-auto max-h-72">{res.jsonLd}</pre>
            {res.ontbreekt.length ? (
              <ul className="list-disc pl-5 text-sm text-amber-700">{res.ontbreekt.map((o) => <li key={o}>Let op: {o}</li>)}</ul>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
