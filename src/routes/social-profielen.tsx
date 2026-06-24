import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ExternalLink, Plus, Save, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useAuth } from "@/lib/auth";

type ProfileRow = Database["public"]["Tables"]["social_profiles"]["Row"];

export const Route = createFileRoute("/social-profielen")({
  head: () => ({
    meta: [
      { title: "Social Profielen — HappyBeez" },
      { name: "description", content: "Beheer je social media profielen en kanalen." },
    ],
  }),
  component: SocialProfielenPage,
});

function SocialProfielenPage() {
  return (
    <ProtectedRoute>
      <SocialProfielen />
    </ProtectedRoute>
  );
}

function SocialProfielen() {
  const { user } = useAuth();
  const [items, setItems] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ channel: "instagram", handle: "", url: "", description: "" });

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("social_profiles")
      .select("*")
      .order("channel", { ascending: true });
    setLoading(false);
    if (error) return toast.error(error.message);
    setItems((data ?? []) as ProfileRow[]);
  }

  async function save() {
    if (!user || !form.channel.trim() || !form.handle.trim()) {
      return toast.error("Vul kanaal en handle in.");
    }
    setSaving(true);
    const { error } = await supabase.from("social_profiles").insert({
      user_id: user.id,
      channel: form.channel.trim().toLowerCase(),
      handle: form.handle.trim(),
      url: form.url || null,
      description: form.description || null,
      active: true,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    setForm({ channel: "instagram", handle: "", url: "", description: "" });
    toast.success("Profiel opgeslagen.");
    void load();
  }

  async function remove(id: string) {
    const { error } = await supabase.from("social_profiles").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Profiel verwijderd.");
    void load();
  }

  async function toggleActive(item: ProfileRow) {
    const { error } = await supabase
      .from("social_profiles")
      .update({ active: !item.active })
      .eq("id", item.id);
    if (error) return toast.error(error.message);
    void load();
  }

  return (
    <div className="px-4 py-8 sm:px-8 max-w-6xl mx-auto">
      <div className="mb-6">
        <span className="text-xs tracking-[0.2em] uppercase text-muted-foreground font-medium">
          Kanalen
        </span>
        <h1 className="font-heading font-bold text-ink text-3xl mt-1 ruled-heading">
          Social Profielen
        </h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-[22rem_1fr]">
        <section className="bg-card border border-border rounded-lg p-5 shadow-sm h-fit">
          <h2 className="font-heading text-lg font-semibold text-ink mb-4 flex items-center gap-2">
            <Plus className="h-4 w-4 text-gold" /> Profiel toevoegen
          </h2>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="profile-channel">Kanaal</Label>
              <Input id="profile-channel" value={form.channel} onChange={(e) => setForm((p) => ({ ...p, channel: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-handle">Handle</Label>
              <Input id="profile-handle" value={form.handle} onChange={(e) => setForm((p) => ({ ...p, handle: e.target.value }))} placeholder="@happybeez" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-url">URL</Label>
              <Input id="profile-url" type="url" value={form.url} onChange={(e) => setForm((p) => ({ ...p, url: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-description">Notities</Label>
              <Textarea id="profile-description" rows={5} value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
            </div>
            <Button onClick={save} disabled={saving} className="w-full">
              <Save className="h-4 w-4" /> {saving ? "Opslaan…" : "Opslaan"}
            </Button>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          {loading ? (
            <p className="text-sm text-muted-foreground">Profielen laden…</p>
          ) : items.length === 0 ? (
            <div className="sm:col-span-2 border border-dashed border-border rounded-lg p-8 text-center text-sm text-muted-foreground">
              Nog geen social profielen.
            </div>
          ) : (
            items.map((item) => (
              <article key={item.id} className="bg-card border border-border rounded-lg p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                      <Users className="h-3.5 w-3.5" />
                      <span>{item.active ? "Actief" : "Inactief"}</span>
                    </div>
                    <h2 className="font-heading text-xl font-semibold text-ink capitalize">{item.channel}</h2>
                    <p className="text-sm font-medium text-wine mt-1">{item.handle}</p>
                  </div>
                  <button onClick={() => remove(item.id)} className="text-muted-foreground hover:text-destructive" aria-label="Verwijder profiel">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                {item.description ? <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{item.description}</p> : null}
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Switch checked={item.active} onCheckedChange={() => toggleActive(item)} />
                    <span className="text-muted-foreground">Actief</span>
                  </div>
                  {item.url ? (
                    <Button size="sm" variant="outline" asChild>
                      <a href={item.url} target="_blank" rel="noreferrer">
                        <ExternalLink className="h-4 w-4" /> Open
                      </a>
                    </Button>
                  ) : null}
                </div>
              </article>
            ))
          )}
        </section>
      </div>
    </div>
  );
}