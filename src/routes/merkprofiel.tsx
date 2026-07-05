import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Palette, Save, Sparkles, Loader2, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { saveBrandProfile } from "@/lib/brand.functions";
import { analyzeWebsiteForBrand } from "@/lib/website-analysis.functions";
import { cn } from "@/lib/utils";

type WebsiteAnalysis = {
  summary: string;
  tone_of_voice: string;
  style_keywords: string[];
  visual_direction: string;
  suggested_primary: string;
  suggested_secondary: string;
  palette: string[];
  fonts: string[];
  meta: { title: string; description: string; ogImage: string };
};

export const Route = createFileRoute("/merkprofiel")({
  head: () => ({
    meta: [
      { title: "Merkprofiel — SocialMotor" },
      { name: "description", content: "Definieer het merk: branche, doelgroep, tone-of-voice, contentpijlers en huisstijl." },
    ],
  }),
  component: () => (
    <ProtectedRoute>
      <MerkprofielPage />
    </ProtectedRoute>
  ),
});

type PillarMix = { name: string; weight: number };

type FormState = {
  industry: string;
  audience: string;
  tone: string;
  pillars: string[];
  pillar_mix: PillarMix[];
  usps: string[];
  primary_color: string;
  secondary_color: string;
  website: string;
};

const EMPTY: FormState = {
  industry: "",
  audience: "",
  tone: "",
  pillars: [],
  pillar_mix: [],
  usps: [],
  primary_color: "",
  secondary_color: "",
  website: "",
};

const STEPS = [
  { key: "branche", label: "Branche" },
  { key: "doelgroep", label: "Doelgroep" },
  { key: "tone", label: "Tone-of-voice" },
  { key: "pijlers", label: "Contentpijlers" },
  { key: "visuals", label: "Huisstijl" },
] as const;

function MerkprofielPage() {
  const { currentOrgId, currentOrg } = useCurrentOrg();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<WebsiteAnalysis | null>(null);
  const save = useServerFn(saveBrandProfile);
  const analyze = useServerFn(analyzeWebsiteForBrand);
  const qc = useQueryClient();

  const { data: profile, isLoading } = useQuery({
    queryKey: ["brand-profile", currentOrgId],
    enabled: !!currentOrgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brand_profiles")
        .select("industry, audience, tone, pillars, pillar_mix, usps, primary_color, secondary_color, website")
        .eq("org_id", currentOrgId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (profile) {
      const rawMix = Array.isArray(profile.pillar_mix) ? (profile.pillar_mix as unknown as PillarMix[]) : [];
      setForm({
        industry: profile.industry ?? "",
        audience: profile.audience ?? "",
        tone: profile.tone ?? "",
        pillars: profile.pillars ?? [],
        pillar_mix: rawMix.filter((m) => m && typeof m.name === "string"),
        usps: profile.usps ?? [],
        primary_color: profile.primary_color ?? "",
        secondary_color: profile.secondary_color ?? "",
        website: profile.website ?? "",
      });
    }
  }, [profile]);

  const setField = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const onSave = async () => {
    if (!currentOrgId) return;
    setSaving(true);
    try {
      await save({ data: { org_id: currentOrgId, ...form } });
      toast.success("Merkprofiel opgeslagen");
      qc.invalidateQueries({ queryKey: ["brand-profile", currentOrgId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Opslaan mislukt");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <header className="mb-8">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
          <Palette className="w-3.5 h-3.5" /> Strategie
        </div>
        <h1 className="text-3xl font-heading font-bold text-ink mt-2">
          Merkprofiel — {currentOrg?.name ?? "…"}
        </h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Deze basis voedt de campagneplanner, content-studio en AI-suggesties. Werk hem bij zodra jullie merk verandert.
        </p>
      </header>

      {/* Steps */}
      <ol className="flex items-center gap-2 mb-8">
        {STEPS.map((s, i) => (
          <li key={s.key} className="flex items-center gap-2 flex-1">
            <button
              onClick={() => setStep(i)}
              className={cn(
                "flex-1 text-left px-3 py-2 rounded-md border text-xs font-medium transition-colors",
                i === step
                  ? "border-wine bg-wine/5 text-wine"
                  : "border-border/60 text-muted-foreground hover:bg-muted",
              )}
            >
              <span className="block text-[10px] uppercase tracking-widest opacity-70">Stap {i + 1}</span>
              {s.label}
            </button>
          </li>
        ))}
      </ol>

      <section className="bg-card border border-border/60 rounded-lg p-6 min-h-[280px]">
        {isLoading ? (
          <div className="text-muted-foreground text-sm">Laden…</div>
        ) : (
          <>
            {step === 0 && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="industry">Branche / wat doet het bedrijf?</Label>
                  <Textarea
                    id="industry"
                    rows={3}
                    value={form.industry}
                    onChange={(e) => setField("industry", e.target.value)}
                    placeholder="Bv. Imkerij met eigen honing, bijenhotels en workshops."
                  />
                </div>
                <div>
                  <Label htmlFor="website">Website</Label>
                  <Input
                    id="website"
                    value={form.website}
                    onChange={(e) => setField("website", e.target.value)}
                    placeholder="https://…"
                  />
                </div>
              </div>
            )}

            {step === 1 && (
              <div>
                <Label htmlFor="audience">Wie is de ideale klant?</Label>
                <Textarea
                  id="audience"
                  rows={5}
                  value={form.audience}
                  onChange={(e) => setField("audience", e.target.value)}
                  placeholder="Bv. Natuurliefhebbers 35-65 in NL, tuiniers, cadeau-zoekers voor duurzame producten."
                />
              </div>
            )}

            {step === 2 && (
              <div>
                <Label htmlFor="tone">Tone-of-voice</Label>
                <Textarea
                  id="tone"
                  rows={4}
                  value={form.tone}
                  onChange={(e) => setField("tone", e.target.value)}
                  placeholder="Bv. Warm, deskundig, natuurgericht, met licht Brabantse ondertoon."
                />
              </div>
            )}

            {step === 3 && (
              <div className="space-y-8">
                <PillarMixField
                  values={form.pillar_mix}
                  onChange={(v) => {
                    setField("pillar_mix", v);
                    setField(
                      "pillars",
                      v.map((p) => p.name).filter((n) => n.trim().length > 0),
                    );
                  }}
                />
                <ArrayField
                  label="USPs / bewijs"
                  hint="Waarom klanten voor jullie kiezen."
                  values={form.usps}
                  onChange={(v) => setField("usps", v)}
                  placeholder="Bv. Honing uit eigen imkerij in Brabant"
                />
              </div>
            )}

            {step === 4 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="primary_color">Primaire kleur</Label>
                  <Input
                    id="primary_color"
                    value={form.primary_color}
                    onChange={(e) => setField("primary_color", e.target.value)}
                    placeholder="#B0985C"
                  />
                </div>
                <div>
                  <Label htmlFor="secondary_color">Secundaire kleur</Label>
                  <Input
                    id="secondary_color"
                    value={form.secondary_color}
                    onChange={(e) => setField("secondary_color", e.target.value)}
                    placeholder="#7A1F3D"
                  />
                </div>
              </div>
            )}
          </>
        )}
      </section>

      <div className="flex items-center justify-between mt-6">
        <Button
          variant="ghost"
          disabled={step === 0}
          onClick={() => setStep((s) => Math.max(0, s - 1))}
        >
          <ChevronLeft className="w-4 h-4 mr-1" /> Terug
        </Button>
        <div className="flex items-center gap-2">
          <Button onClick={onSave} disabled={saving || !currentOrgId} variant="outline">
            {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
            Opslaan
          </Button>
          {step < STEPS.length - 1 ? (
            <Button onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}>
              Volgende <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={onSave} disabled={saving}>
              <Sparkles className="w-4 h-4 mr-1" /> Klaar
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function ArrayField({
  label,
  hint,
  values,
  onChange,
  placeholder,
}: {
  label: string;
  hint?: string;
  values: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const t = draft.trim();
    if (!t) return;
    onChange([...values, t]);
    setDraft("");
  };
  return (
    <div>
      <Label>{label}</Label>
      {hint && <p className="text-xs text-muted-foreground mt-0.5 mb-2">{hint}</p>}
      <div className="flex gap-2 mb-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder={placeholder}
        />
        <Button type="button" variant="outline" onClick={add}>
          Toevoegen
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        {values.map((v, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-wine/10 text-wine text-xs"
          >
            {v}
            <button
              type="button"
              onClick={() => onChange(values.filter((_, j) => j !== i))}
              className="hover:text-wine/70"
              aria-label={`Verwijder ${v}`}
            >
              ×
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}

const DEFAULT_MIX: PillarMix[] = [
  { name: "Educatie & tips", weight: 30 },
  { name: "Achter de schermen", weight: 25 },
  { name: "Klantverhalen", weight: 20 },
  { name: "Aanbod & acties", weight: 15 },
  { name: "Actueel & seizoen", weight: 10 },
];

function PillarMixField({
  values,
  onChange,
}: {
  values: PillarMix[];
  onChange: (v: PillarMix[]) => void;
}) {
  const list = values.length ? values : [];
  const total = list.reduce((s, p) => s + (p.weight || 0), 0);
  const ok = total === 100;

  const update = (i: number, patch: Partial<PillarMix>) =>
    onChange(list.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  const remove = (i: number) => onChange(list.filter((_, j) => j !== i));
  const add = () => onChange([...list, { name: "Nieuwe pijler", weight: 0 }]);
  const normalize = () => {
    if (!list.length) return;
    const t = list.reduce((s, p) => s + (p.weight || 0), 0) || 1;
    const scaled = list.map((p) => ({ ...p, weight: Math.round((p.weight / t) * 100) }));
    const diff = 100 - scaled.reduce((s, p) => s + p.weight, 0);
    if (scaled.length) scaled[0].weight += diff;
    onChange(scaled);
  };

  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <Label>Contentpijlers & balans</Label>
        <span
          className={cn(
            "text-xs font-semibold tabular-nums",
            ok ? "text-emerald-600" : "text-wine",
          )}
        >
          Totaal: {total}% {ok ? "✓" : "— moet 100% zijn"}
        </span>
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        Bepaal per type bericht welk aandeel het in de mix krijgt. De AI-planner gebruikt deze balans om
        campagnes en posts te verdelen.
      </p>

      {list.length === 0 && (
        <div className="border border-dashed border-border rounded-md p-4 text-sm text-muted-foreground mb-3">
          Nog geen pijlers. Start met een aanbevolen mix of voeg zelf toe.
          <div className="mt-3">
            <Button type="button" variant="outline" size="sm" onClick={() => onChange(DEFAULT_MIX)}>
              Aanbevolen mix laden
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {list.map((p, i) => (
          <div
            key={i}
            className="flex items-center gap-3 bg-muted/30 border border-border/60 rounded-md px-3 py-2"
          >
            <Input
              value={p.name}
              onChange={(e) => update(i, { name: e.target.value })}
              className="w-56 h-8 bg-background"
            />
            <input
              type="range"
              min={0}
              max={60}
              value={p.weight}
              onChange={(e) => update(i, { weight: Number(e.target.value) })}
              className="flex-1 accent-wine"
            />
            <span className="w-12 text-right text-sm font-semibold tabular-nums">{p.weight}%</span>
            <button
              type="button"
              onClick={() => remove(i)}
              className="text-muted-foreground hover:text-wine text-lg leading-none px-1"
              aria-label="Verwijder pijler"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <div className="flex gap-2 mt-3">
        <Button type="button" variant="outline" size="sm" onClick={add}>
          + Pijler toevoegen
        </Button>
        {list.length > 0 && (
          <Button type="button" variant="ghost" size="sm" onClick={normalize}>
            Normaliseer naar 100%
          </Button>
        )}
      </div>
    </div>
  );
}
