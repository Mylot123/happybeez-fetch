import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Megaphone,
  Sparkles,
  Loader2,
  Copy,
  CheckCheck,
  RefreshCw,
  Calculator,
  Download,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { generateGoogleAd, getAdsKeywordMetrics, type GoogleAd } from "@/lib/googleads.functions";

export const Route = createFileRoute("/google-ads")({
  head: () => ({
    meta: [
      { title: "Google Ads Studio — Happybeez" },
      {
        name: "description",
        content:
          "Schrijf zoekwoord-geoptimaliseerde Google Ads met karaktercontrole per veld en een kostenraming op basis van kliks en impressies.",
      },
      { property: "og:title", content: "Google Ads Studio — Happybeez" },
      {
        property: "og:description",
        content:
          "Genereer complete responsive search ads inclusief extensies, zoekwoorden en budgetraming.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GoogleAdsPage,
});

function GoogleAdsPage() {
  return (
    <ProtectedRoute>
      <GoogleAdsStudio />
    </ProtectedRoute>
  );
}

// ── limieten ─────────────────────────────────────────────────
const LIMIT = {
  headline: 30,
  description: 90,
  path: 15,
  callout: 25,
  sitelinkText: 25,
  sitelinkDesc: 35,
  snippetValue: 25,
} as const;

type Metric = {
  keyword: string;
  search_volume: number | null;
  cpc: number | null;
  competition: number | null;
  low_bid: number | null;
  high_bid: number | null;
};

const euro = (n: number) =>
  new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(
    Number.isFinite(n) ? n : 0,
  );
const num = (n: number) => new Intl.NumberFormat("nl-NL", { maximumFractionDigits: 0 }).format(n);

function CharBar({ value, max }: { value: string; max: number }) {
  const len = value.length;
  const pct = Math.min(100, (len / max) * 100);
  const over = len > max;
  const good = !over && len >= max * 0.8;
  const color = over ? "#dc2626" : good ? "#16a34a" : "#d97706";
  return (
    <div className="flex items-center gap-2 shrink-0 w-[86px]">
      <div className="h-1.5 flex-1 rounded-full bg-neutral-200 overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-[11px] tabular-nums font-medium" style={{ color }}>
        {len}/{max}
      </span>
    </div>
  );
}

function FieldRow({
  value,
  max,
  onChange,
  placeholder,
}: {
  value: string;
  max: number;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <Input
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={value.length > max ? "border-red-400" : ""}
      />
      <CharBar value={value} max={max} />
    </div>
  );
}

function GoogleAdsStudio() {
  const runGenerate = useServerFn(generateGoogleAd);
  const runMetrics = useServerFn(getAdsKeywordMetrics);

  const [product, setProduct] = useState("");
  const [url, setUrl] = useState("https://www.happybeez.nl");
  const [audience, setAudience] = useState("");
  const [usps, setUsps] = useState("");
  const [cta, setCta] = useState("Bestel online");
  const [tone, setTone] = useState("warm & deskundig");
  const [seed, setSeed] = useState("");
  const [database, setDatabase] = useState("nl");

  const [loading, setLoading] = useState(false);
  const [ad, setAd] = useState<GoogleAd | null>(null);
  const [copied, setCopied] = useState(false);

  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [loadingMetrics, setLoadingMetrics] = useState(false);

  // budget-instellingen
  const [budget, setBudget] = useState(15);
  const [days, setDays] = useState(30);
  const [ctr, setCtr] = useState(5);
  const [convRate, setConvRate] = useState(2.5);
  const [orderValue, setOrderValue] = useState(45);

  const update = <K extends keyof GoogleAd>(key: K, value: GoogleAd[K]) =>
    setAd((prev) => (prev ? { ...prev, [key]: value } : prev));

  const generate = async () => {
    if (product.trim().length < 3) {
      toast.error("Beschrijf eerst kort je product of dienst.");
      return;
    }
    setLoading(true);
    try {
      const { ad: result } = await runGenerate({
        data: {
          product,
          landing_url: url,
          audience,
          usps,
          cta,
          tone,
          seed_keywords: seed,
          brand: "Happybeez",
          language: "Nederlands",
        },
      });
      setAd(result);
      setMetrics([]);
      toast.success("Advertentie gegenereerd — controleer de velden en verrijk de zoekwoorden.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Genereren mislukt.");
    } finally {
      setLoading(false);
    }
  };

  const loadMetrics = async () => {
    if (!ad?.keywords.length) return;
    setLoadingMetrics(true);
    try {
      const res = await runMetrics({
        data: { keywords: ad.keywords.map((k) => k.keyword), database },
      });
      if (res.soft_error) toast.warning(res.soft_error);
      setMetrics(res.metrics);
      if (res.metrics.length) toast.success(`${res.metrics.length} zoekwoorden verrijkt met volume en CPC.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Zoekwoorddata ophalen mislukt.");
    } finally {
      setLoadingMetrics(false);
    }
  };

  const metricFor = (kw: string) => metrics.find((m) => m.keyword === kw.toLowerCase());

  // gemiddelde CPC (gewogen op zoekvolume), met fallback
  const avgCpc = useMemo(() => {
    const withCpc = metrics.filter((m) => m.cpc && m.cpc > 0);
    if (!withCpc.length) return 0.45;
    const totalVol = withCpc.reduce((s, m) => s + (m.search_volume ?? 1), 0);
    if (!totalVol) return withCpc.reduce((s, m) => s + (m.cpc ?? 0), 0) / withCpc.length;
    return withCpc.reduce((s, m) => s + (m.cpc ?? 0) * (m.search_volume ?? 1), 0) / totalVol;
  }, [metrics]);

  const hasRealCpc = metrics.some((m) => m.cpc && m.cpc > 0);
  const totalVolume = metrics.reduce((s, m) => s + (m.search_volume ?? 0), 0);

  const estimate = useMemo(() => {
    const spend = budget * days;
    const clicks = avgCpc > 0 ? spend / avgCpc : 0;
    const impressions = ctr > 0 ? clicks / (ctr / 100) : 0;
    const conversions = clicks * (convRate / 100);
    const cpa = conversions > 0 ? spend / conversions : 0;
    const revenue = conversions * orderValue;
    const roas = spend > 0 ? revenue / spend : 0;
    return { spend, clicks, impressions, conversions, cpa, revenue, roas };
  }, [budget, days, avgCpc, ctr, convRate, orderValue]);

  const plainText = useMemo(() => {
    if (!ad) return "";
    return [
      `Campagne: ${ad.campaign_name}`,
      `Advertentiegroep: ${ad.ad_group_name}`,
      `Final URL: ${ad.final_url}`,
      `Weergavepad: /${ad.path1}/${ad.path2}`,
      "",
      "KOPTEKSTEN:",
      ...ad.headlines.map((h, i) => `${i + 1}. ${h} (${h.length})`),
      "",
      "BESCHRIJVINGEN:",
      ...ad.descriptions.map((d, i) => `${i + 1}. ${d} (${d.length})`),
      "",
      `CALLOUTS: ${ad.callouts.join(" | ")}`,
      "",
      "SITELINKS:",
      ...ad.sitelinks.map((s) => `- ${s.text} — ${s.desc1} / ${s.desc2}`),
      "",
      `STRUCTURED SNIPPET (${ad.structured_snippet_header}): ${ad.structured_snippet_values.join(", ")}`,
      "",
      "ZOEKWOORDEN:",
      ...ad.keywords.map((k) => `- ${k.keyword} [${k.match}]`),
      "",
      `NEGATIEVE ZOEKWOORDEN: ${ad.negative_keywords.join(", ")}`,
    ].join("\n");
  }, [ad]);

  const copyAll = async () => {
    await navigator.clipboard.writeText(plainText);
    setCopied(true);
    toast.success("Advertentie gekopieerd.");
    setTimeout(() => setCopied(false), 1800);
  };

  const downloadCsv = () => {
    if (!ad) return;
    const rows: string[][] = [["Veld", "Tekst", "Tekens"]];
    ad.headlines.forEach((h, i) => rows.push([`Koptekst ${i + 1}`, h, String(h.length)]));
    ad.descriptions.forEach((d, i) => rows.push([`Beschrijving ${i + 1}`, d, String(d.length)]));
    rows.push(["Pad 1", ad.path1, String(ad.path1.length)]);
    rows.push(["Pad 2", ad.path2, String(ad.path2.length)]);
    ad.callouts.forEach((c, i) => rows.push([`Callout ${i + 1}`, c, String(c.length)]));
    ad.sitelinks.forEach((s, i) =>
      rows.push([`Sitelink ${i + 1}`, `${s.text} | ${s.desc1} | ${s.desc2}`, String(s.text.length)]),
    );
    ad.keywords.forEach((k) => rows.push(["Zoekwoord", k.keyword, k.match]));
    ad.negative_keywords.forEach((k) => rows.push(["Negatief zoekwoord", k, ""]));
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "google-ads-happybeez.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto space-y-6">
      <header className="flex items-start gap-3">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: "var(--hb-green, #2f7d54)" }}
        >
          <Megaphone className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Google Ads Studio</h1>
          <p className="text-sm text-neutral-600 max-w-2xl">
            Schrijf complete, zoekwoord-geoptimaliseerde zoekadvertenties met live karaktercontrole per veld,
            zoekwoorden met echte volumes en CPC, en een kostenraming op basis van kliks en impressies.
          </p>
        </div>
      </header>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 flex gap-2">
        <Info className="w-4 h-4 mt-0.5 shrink-0" />
        <div>
          <strong>Zo werkt het:</strong> 1) beschrijf je product en landingspagina → 2) genereer de advertentie
          (15 koptekstem van 30 tekens, 4 beschrijvingen van 90 tekens, extensies en zoekwoorden) → 3) verrijk de
          zoekwoorden met volume en CPC → 4) bereken je verwachte kliks, impressies en kosten → 5) exporteer naar CSV
          en plak het in Google Ads.
        </div>
      </div>

      <div className="grid lg:grid-cols-[380px_1fr] gap-6 items-start">
        {/* ── invoer ── */}
        <div className="rounded-xl border border-neutral-200 bg-white p-5 space-y-4">
          <h2 className="font-semibold flex items-center gap-2">
            <Sparkles className="w-4 h-4" /> Briefing
          </h2>

          <div className="space-y-1.5">
            <Label>Product of dienst *</Label>
            <Textarea
              rows={3}
              value={product}
              onChange={(e) => setProduct(e.target.value)}
              placeholder="Handgemaakte bijenhotels voor wilde en solitaire bijen, gemaakt in Boekel van duurzaam hout."
            />
          </div>

          <div className="space-y-1.5">
            <Label>Landingspagina (final URL)</Label>
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
          </div>

          <div className="space-y-1.5">
            <Label>Doelgroep</Label>
            <Input
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              placeholder="Tuinliefhebbers, natuurorganisaties, bedrijven met groen beleid"
            />
          </div>

          <div className="space-y-1.5">
            <Label>USP's (komma-gescheiden)</Label>
            <Textarea
              rows={2}
              value={usps}
              onChange={(e) => setUsps(e.target.value)}
              placeholder="Handgemaakt in Nederland, FSC-hout, 5 jaar garantie, gratis verzending vanaf €50"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Call-to-action</Label>
              <Input value={cta} onChange={(e) => setCta(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Tone of voice</Label>
              <Select value={tone} onValueChange={setTone}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="warm & deskundig">Warm &amp; deskundig</SelectItem>
                  <SelectItem value="zakelijk & overtuigend">Zakelijk &amp; overtuigend</SelectItem>
                  <SelectItem value="urgent & actiegericht">Urgent &amp; actiegericht</SelectItem>
                  <SelectItem value="speels & persoonlijk">Speels &amp; persoonlijk</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Belangrijkste zoekwoorden</Label>
            <Input
              value={seed}
              onChange={(e) => setSeed(e.target.value)}
              placeholder="bijenhotel kopen, insectenhotel, bijenhuisje"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Markt</Label>
            <Select value={database} onValueChange={setDatabase}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="nl">🇳🇱 Nederland</SelectItem>
                <SelectItem value="be">🇧🇪 België (NL)</SelectItem>
                <SelectItem value="de">🇩🇪 Duitsland</SelectItem>
                <SelectItem value="uk">🇬🇧 Verenigd Koninkrijk</SelectItem>
                <SelectItem value="us">🇺🇸 Verenigde Staten</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button onClick={generate} disabled={loading} className="w-full">
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
            {ad ? "Opnieuw genereren" : "Genereer advertentie"}
          </Button>
        </div>

        {/* ── resultaat ── */}
        <div className="space-y-6">
          {!ad && (
            <div className="rounded-xl border border-dashed border-neutral-300 bg-white/60 p-12 text-center text-neutral-500">
              <Megaphone className="w-10 h-10 mx-auto mb-3 opacity-40" />
              Vul de briefing in en genereer je eerste advertentie.
            </div>
          )}

          {ad && (
            <>
              {/* preview */}
              <div className="rounded-xl border border-neutral-200 bg-white p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold">Voorbeeld in Google</h2>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={copyAll}>
                      {copied ? <CheckCheck className="w-4 h-4 mr-1.5" /> : <Copy className="w-4 h-4 mr-1.5" />}
                      Kopieer
                    </Button>
                    <Button size="sm" variant="outline" onClick={downloadCsv}>
                      <Download className="w-4 h-4 mr-1.5" /> CSV
                    </Button>
                  </div>
                </div>
                <div className="rounded-lg border border-neutral-200 p-4 max-w-xl">
                  <div className="text-[11px] font-bold text-neutral-800 mb-1">
                    Gesponsord
                  </div>
                  <div className="text-[13px] text-neutral-700 truncate">
                    {ad.final_url.replace(/^https?:\/\//, "")}
                    {ad.path1 ? `/${ad.path1}` : ""}
                    {ad.path2 ? `/${ad.path2}` : ""}
                  </div>
                  <div className="text-[18px] leading-snug text-[#1a0dab] font-medium">
                    {[ad.headlines[0], ad.headlines[1], ad.headlines[2]].filter(Boolean).join(" | ")}
                  </div>
                  <div className="text-[13px] text-neutral-700 mt-1">
                    {[ad.descriptions[0], ad.descriptions[1]].filter(Boolean).join(" ")}
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-[13px] text-[#1a0dab]">
                    {ad.sitelinks.slice(0, 4).map((s, i) => (
                      <span key={i}>{s.text}</span>
                    ))}
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1.5">
                    <Label>Campagnenaam</Label>
                    <Input value={ad.campaign_name} onChange={(e) => update("campaign_name", e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Advertentiegroep</Label>
                    <Input value={ad.ad_group_name} onChange={(e) => update("ad_group_name", e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Final URL</Label>
                    <Input value={ad.final_url} onChange={(e) => update("final_url", e.target.value)} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Pad 1</Label>
                      <FieldRow value={ad.path1} max={LIMIT.path} onChange={(v) => update("path1", v)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Pad 2</Label>
                      <FieldRow value={ad.path2} max={LIMIT.path} onChange={(v) => update("path2", v)} />
                    </div>
                  </div>
                </div>
              </div>

              {/* koppen */}
              <div className="rounded-xl border border-neutral-200 bg-white p-5 space-y-2">
                <h2 className="font-semibold">
                  Koptekstem <span className="text-neutral-500 font-normal">({ad.headlines.length}/15 · max 30 tekens)</span>
                </h2>
                {ad.headlines.map((h, i) => (
                  <FieldRow
                    key={i}
                    value={h}
                    max={LIMIT.headline}
                    onChange={(v) => {
                      const next = [...ad.headlines];
                      next[i] = v;
                      update("headlines", next);
                    }}
                  />
                ))}
              </div>

              {/* beschrijvingen */}
              <div className="rounded-xl border border-neutral-200 bg-white p-5 space-y-2">
                <h2 className="font-semibold">
                  Beschrijvingen{" "}
                  <span className="text-neutral-500 font-normal">({ad.descriptions.length}/4 · max 90 tekens)</span>
                </h2>
                {ad.descriptions.map((d, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <Textarea
                      rows={2}
                      value={d}
                      className={d.length > LIMIT.description ? "border-red-400" : ""}
                      onChange={(e) => {
                        const next = [...ad.descriptions];
                        next[i] = e.target.value;
                        update("descriptions", next);
                      }}
                    />
                    <div className="pt-2">
                      <CharBar value={d} max={LIMIT.description} />
                    </div>
                  </div>
                ))}
              </div>

              {/* extensies */}
              <div className="grid md:grid-cols-2 gap-6">
                <div className="rounded-xl border border-neutral-200 bg-white p-5 space-y-2">
                  <h2 className="font-semibold">
                    Callouts <span className="text-neutral-500 font-normal">(max 25 tekens)</span>
                  </h2>
                  {ad.callouts.map((c, i) => (
                    <FieldRow
                      key={i}
                      value={c}
                      max={LIMIT.callout}
                      onChange={(v) => {
                        const next = [...ad.callouts];
                        next[i] = v;
                        update("callouts", next);
                      }}
                    />
                  ))}
                  <div className="pt-3 space-y-1">
                    <h3 className="font-semibold text-sm">
                      Structured snippet — {ad.structured_snippet_header}
                    </h3>
                    <div className="flex flex-wrap gap-1.5">
                      {ad.structured_snippet_values.map((v, i) => (
                        <span
                          key={i}
                          className={`text-xs px-2 py-1 rounded-full border ${
                            v.length > LIMIT.snippetValue
                              ? "border-red-300 bg-red-50 text-red-700"
                              : "border-neutral-200 bg-neutral-50"
                          }`}
                        >
                          {v} <span className="opacity-50">{v.length}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-neutral-200 bg-white p-5 space-y-3">
                  <h2 className="font-semibold">
                    Sitelinks <span className="text-neutral-500 font-normal">(25 / 35 / 35 tekens)</span>
                  </h2>
                  {ad.sitelinks.map((s, i) => (
                    <div key={i} className="space-y-1.5 border-b border-neutral-100 pb-3 last:border-0">
                      <FieldRow
                        value={s.text}
                        max={LIMIT.sitelinkText}
                        onChange={(v) => {
                          const next = [...ad.sitelinks];
                          next[i] = { ...s, text: v };
                          update("sitelinks", next);
                        }}
                      />
                      <FieldRow
                        value={s.desc1}
                        max={LIMIT.sitelinkDesc}
                        onChange={(v) => {
                          const next = [...ad.sitelinks];
                          next[i] = { ...s, desc1: v };
                          update("sitelinks", next);
                        }}
                      />
                      <FieldRow
                        value={s.desc2}
                        max={LIMIT.sitelinkDesc}
                        onChange={(v) => {
                          const next = [...ad.sitelinks];
                          next[i] = { ...s, desc2: v };
                          update("sitelinks", next);
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* zoekwoorden */}
              <div className="rounded-xl border border-neutral-200 bg-white p-5 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h2 className="font-semibold">Zoekwoorden &amp; kosten per klik</h2>
                  <Button size="sm" variant="outline" onClick={loadMetrics} disabled={loadingMetrics}>
                    {loadingMetrics ? (
                      <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4 mr-1.5" />
                    )}
                    Verrijk met volume &amp; CPC
                  </Button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-neutral-500 border-b border-neutral-200">
                        <th className="py-2 pr-3 font-medium">Zoekwoord</th>
                        <th className="py-2 pr-3 font-medium">Match</th>
                        <th className="py-2 pr-3 font-medium text-right">Volume/mnd</th>
                        <th className="py-2 pr-3 font-medium text-right">CPC</th>
                        <th className="py-2 pr-3 font-medium text-right">Top-bid range</th>
                        <th className="py-2 font-medium text-right">Concurrentie</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ad.keywords.map((k, i) => {
                        const m = metricFor(k.keyword);
                        return (
                          <tr key={i} className="border-b border-neutral-100 last:border-0">
                            <td className="py-2 pr-3">{k.keyword}</td>
                            <td className="py-2 pr-3">
                              <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-100 border border-neutral-200">
                                {k.match}
                              </span>
                            </td>
                            <td className="py-2 pr-3 text-right tabular-nums">
                              {m?.search_volume != null ? num(m.search_volume) : "—"}
                            </td>
                            <td className="py-2 pr-3 text-right tabular-nums">
                              {m?.cpc != null ? euro(m.cpc) : "—"}
                            </td>
                            <td className="py-2 pr-3 text-right tabular-nums text-neutral-600">
                              {m?.low_bid != null && m?.high_bid != null
                                ? `${euro(m.low_bid)} – ${euro(m.high_bid)}`
                                : "—"}
                            </td>
                            <td className="py-2 text-right tabular-nums">
                              {m?.competition != null ? `${Math.round(m.competition)}%` : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {ad.negative_keywords.length > 0 && (
                  <div className="pt-2">
                    <h3 className="font-semibold text-sm mb-1.5">Negatieve zoekwoorden</h3>
                    <div className="flex flex-wrap gap-1.5">
                      {ad.negative_keywords.map((n, i) => (
                        <span
                          key={i}
                          className="text-xs px-2 py-1 rounded-full bg-red-50 border border-red-200 text-red-700"
                        >
                          −{n}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* kostenraming */}
              <div className="rounded-xl border border-neutral-200 bg-white p-5 space-y-4">
                <h2 className="font-semibold flex items-center gap-2">
                  <Calculator className="w-4 h-4" /> Kostenraming
                </h2>
                <div className="grid sm:grid-cols-3 lg:grid-cols-5 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Dagbudget (€)</Label>
                    <Input type="number" min={1} value={budget} onChange={(e) => setBudget(Number(e.target.value))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Looptijd (dagen)</Label>
                    <Input type="number" min={1} value={days} onChange={(e) => setDays(Number(e.target.value))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Verwachte CTR (%)</Label>
                    <Input type="number" step="0.1" min={0.1} value={ctr} onChange={(e) => setCtr(Number(e.target.value))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Conversieratio (%)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      min={0}
                      value={convRate}
                      onChange={(e) => setConvRate(Number(e.target.value))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Orderwaarde (€)</Label>
                    <Input
                      type="number"
                      min={0}
                      value={orderValue}
                      onChange={(e) => setOrderValue(Number(e.target.value))}
                    />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <Stat label="Gem. CPC" value={euro(avgCpc)} hint={hasRealCpc ? "op basis van echte data" : "schatting"} />
                  <Stat label="Verwachte kliks" value={num(estimate.clicks)} hint={`over ${days} dagen`} />
                  <Stat label="Verwachte impressies" value={num(estimate.impressions)} hint={`bij ${ctr}% CTR`} />
                  <Stat label="Totale kosten" value={euro(estimate.spend)} hint={`${euro(budget)} p/dag`} />
                  <Stat label="Verwachte conversies" value={num(estimate.conversions)} hint={`bij ${convRate}%`} />
                  <Stat label="Kosten per conversie" value={euro(estimate.cpa)} hint="CPA" />
                  <Stat label="Verwachte omzet" value={euro(estimate.revenue)} hint={`${euro(orderValue)} per order`} />
                  <Stat
                    label="ROAS"
                    value={`${estimate.roas.toFixed(2)}×`}
                    hint={estimate.roas >= 1 ? "winstgevend" : "onder break-even"}
                    good={estimate.roas >= 1}
                  />
                </div>

                <p className="text-xs text-neutral-500">
                  {hasRealCpc
                    ? `Berekend met een op zoekvolume gewogen gemiddelde CPC uit de SEO-databron (totaal ${num(totalVolume)} zoekopdrachten per maand op deze zoekwoorden).`
                    : "Nog geen echte CPC-data — er wordt gerekend met een schatting van € 0,45. Klik op “Verrijk met volume & CPC” voor een nauwkeurige raming."}{" "}
                  Kliks = budget ÷ CPC, impressies = kliks ÷ CTR. Werkelijke resultaten hangen af van kwaliteitsscore,
                  concurrentie en seizoen.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  good,
}: {
  label: string;
  value: string;
  hint?: string;
  good?: boolean;
}) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
      <div className="text-xs text-neutral-500">{label}</div>
      <div className={`text-xl font-bold tabular-nums ${good === false ? "text-amber-700" : ""}`}>{value}</div>
      {hint && <div className="text-[11px] text-neutral-500 mt-0.5">{hint}</div>}
    </div>
  );
}
