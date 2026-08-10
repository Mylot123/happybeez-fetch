import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Loader2, Trash2, Flag, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrg } from "@/hooks/use-current-org";

const CHANNELS = ["instagram", "facebook", "linkedin", "youtube"];

const STATUS_LABEL: Record<string, string> = {
  concept: "Concept",
  active: "Actief",
  archived: "Archief",
};

function weeksBetween(start: string, end: string) {
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  if (!Number.isFinite(s) || !Number.isFinite(e) || e < s) return 0;
  return Math.max(1, Math.round((e - s) / (7 * 86400_000)));
}

function fmt(d: string) {
  return new Date(d).toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" });
}

/** Losse campagnes met eigen looptijd (bv. kerstcampagne 14 aug – 30 nov). */
export function StandaloneCampaigns() {
  const { currentOrgId } = useCurrentOrg();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [postsPerWeek, setPostsPerWeek] = useState(2);
  const [channels, setChannels] = useState<string[]>(["instagram"]);

  const listQuery = useQuery({
    queryKey: ["standalone-campaigns", currentOrgId],
    enabled: !!currentOrgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaigns")
        .select("id, name, description, start_date, end_date, posts_per_week, channels, status")
        .eq("org_id", currentOrgId!)
        .order("start_date", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const reset = () => {
    setName("");
    setDescription("");
    setStartDate("");
    setEndDate("");
    setPostsPerWeek(2);
    setChannels(["instagram"]);
  };

  const toggleChannel = (c: string) =>
    setChannels((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));

  const save = async () => {
    if (!currentOrgId) return;
    if (!name.trim()) return toast.error("Geef de campagne een naam");
    if (!startDate || !endDate) return toast.error("Kies een start- en einddatum");
    if (endDate < startDate) return toast.error("De einddatum ligt vóór de startdatum");
    setBusy(true);
    try {
      const { error } = await supabase.from("campaigns").insert({
        org_id: currentOrgId,
        name: name.trim().slice(0, 200),
        description: description.trim() || null,
        start_date: startDate,
        end_date: endDate,
        posts_per_week: postsPerWeek,
        channels,
      });
      if (error) throw error;
      toast.success("Campagne toegevoegd");
      reset();
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["standalone-campaigns", currentOrgId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Opslaan mislukt");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("campaigns").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Campagne verwijderd");
    qc.invalidateQueries({ queryKey: ["standalone-campaigns", currentOrgId] });
  };

  const setStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("campaigns").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["standalone-campaigns", currentOrgId] });
  };

  const items = listQuery.data ?? [];
  const previewWeeks = startDate && endDate ? weeksBetween(startDate, endDate) : 0;

  return (
    <section className="mb-8">
      <div className="flex items-end justify-between gap-4 flex-wrap mb-3">
        <div>
          <h2 className="font-heading text-base font-semibold text-ink">
            Losse campagnes (eigen looptijd)
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5 max-w-xl">
            Voor acties die niet in één maand passen — bijvoorbeeld een kerstcampagne van
            14 augustus t/m 30 november. Geef aan waar de campagne over gaat en hoeveel
            posts per week je ervoor reserveert.
          </p>
        </div>
        <Button size="sm" variant={open ? "ghost" : "default"} onClick={() => setOpen((v) => !v)}>
          <Plus className="w-4 h-4 mr-1" /> {open ? "Annuleren" : "Campagne toevoegen"}
        </Button>
      </div>

      {open && (
        <div className="bg-card border border-border/60 rounded-lg p-5 mb-4 grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="camp-name">Naam</Label>
              <Input
                id="camp-name"
                value={name}
                maxLength={200}
                onChange={(e) => setName(e.target.value)}
                placeholder="Kerstcampagne"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="camp-ppw">Posts per week</Label>
              <select
                id="camp-ppw"
                value={postsPerWeek}
                onChange={(e) => setPostsPerWeek(Number(e.target.value))}
                className="mt-1.5 h-10 w-full px-3 rounded-md border border-border bg-background text-sm"
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>{n} per week</option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="camp-start">Startdatum</Label>
              <Input
                id="camp-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="camp-end">Einddatum</Label>
              <Input
                id="camp-end"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="mt-1.5"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="camp-desc">Waar gaat de campagne over?</Label>
            <Textarea
              id="camp-desc"
              rows={3}
              maxLength={2000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Bv. bijenhotel als duurzaam kerstcadeau: ambacht, biodiversiteit en cadeautips."
              className="mt-1.5"
            />
          </div>

          <div>
            <Label>Kanalen</Label>
            <div className="flex flex-wrap gap-2 mt-1.5">
              {CHANNELS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => toggleChannel(c)}
                  className={`px-3 py-1 rounded-full border text-xs capitalize transition-colors ${
                    channels.includes(c)
                      ? "border-wine bg-wine/10 text-wine font-semibold"
                      : "border-border text-muted-foreground hover:bg-secondary/60"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-xs text-muted-foreground">
              {previewWeeks > 0
                ? `≈ ${previewWeeks} weken · ${previewWeeks * postsPerWeek} posts te reserveren`
                : "Kies een periode om het aantal posts te zien."}
            </p>
            <Button onClick={save} disabled={busy}>
              {busy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
              Campagne opslaan
            </Button>
          </div>
        </div>
      )}

      {items.length === 0 ? (
        !open && (
          <div className="rounded-lg border border-dashed border-border px-5 py-6 text-center">
            <Flag className="w-6 h-6 text-muted-foreground/60 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Nog geen losse campagnes.</p>
          </div>
        )
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {items.map((c) => {
            const weeks = weeksBetween(c.start_date, c.end_date);
            return (
              <li key={c.id} className="bg-card border border-border/60 rounded-lg p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-heading text-lg font-semibold text-ink">{c.name}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                      <CalendarDays className="w-3.5 h-3.5" />
                      {fmt(c.start_date)} – {fmt(c.end_date)}
                    </p>
                  </div>
                  <Badge variant={c.status === "active" ? "default" : "secondary"}>
                    {STATUS_LABEL[c.status] ?? c.status}
                  </Badge>
                </div>

                {c.description && (
                  <p className="text-sm text-muted-foreground mt-2 whitespace-pre-line">
                    {c.description}
                  </p>
                )}

                <p className="text-xs text-foreground/80 mt-3">
                  <span className="font-semibold">{c.posts_per_week} post(s) per week</span>
                  {weeks > 0 ? ` · ± ${weeks} weken · ${weeks * c.posts_per_week} posts totaal` : ""}
                </p>

                {c.channels && c.channels.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {c.channels.map((p) => (
                      <span
                        key={p}
                        className="px-2 py-0.5 rounded-full bg-muted text-[10px] uppercase tracking-widest font-semibold text-foreground/70"
                      >
                        {p}
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-2 mt-4">
                  {c.status !== "active" && (
                    <Button size="sm" variant="outline" onClick={() => setStatus(c.id, "active")}>
                      Activeren
                    </Button>
                  )}
                  {c.status !== "archived" && (
                    <Button size="sm" variant="ghost" onClick={() => setStatus(c.id, "archived")}>
                      Archiveren
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => remove(c.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
