import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, ImageIcon, Loader2, Pencil, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { approveAndSchedule, generateWeekProposals, swapPostPhoto } from "@/lib/autopilot.functions";
import { rejectPost } from "@/lib/posts.functions";
import { withFreshImageUrls } from "@/lib/signed-images";

const LABEL: Record<string, string> = { instagram: "Instagram", facebook: "Facebook", linkedin: "LinkedIn", blog: "Blog" };

type Item = {
  id: string;
  title: string;
  channel: string;
  content_text: string | null;
  image_url: string | null;
  image_storage_path?: string | null;
  publish_date: string | null;
};

export function ReviewInbox() {
  const { currentOrg } = useCurrentOrg();
  const qc = useQueryClient();
  const gen = useServerFn(generateWeekProposals);
  const approve = useServerFn(approveAndSchedule);
  const swap = useServerFn(swapPostPhoto);
  const reject = useServerFn(rejectPost);
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const key = ["review-inbox", currentOrg?.id];
  const { data: items = [], isLoading } = useQuery({
    queryKey: key,
    enabled: !!currentOrg,
    queryFn: async (): Promise<Item[]> => {
      const { data, error } = await supabase
        .from("content_calendar_items")
        .select("id,title,channel,content_text,image_url,image_storage_path,publish_date")
        .eq("org_id", currentOrg!.id)
        .eq("status", "review")
        .order("publish_date", { ascending: true });
      if (error) throw error;
      return withFreshImageUrls(data ?? []);
    },
  });
  const refresh = () => qc.invalidateQueries({ queryKey: key });

  async function run(id: string, fn: () => Promise<unknown>, ok: string) {
    setBusy(id);
    try {
      await fn();
      toast.success(ok);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Er ging iets mis.");
    } finally {
      setBusy(null);
    }
  }

  async function saveText(id: string) {
    const { error } = await supabase.from("content_calendar_items").update({ content_text: draft }).eq("id", id);
    if (error) return toast.error(error.message);
    setEditing(null);
    refresh();
  }

  return (
    <section className="bg-white border border-line rounded-[18px] p-5 sm:p-6 mb-4">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <div>
          <h2 className="font-heading text-[18px] font-bold text-ink">Klaar voor review</h2>
          <p className="text-[13px] text-[#75766F]">
            {items.length
              ? `${items.length} bericht${items.length === 1 ? "" : "en"} wacht${items.length === 1 ? "" : "en"} op jouw akkoord.`
              : "Er staat niets klaar. Laat de app de berichten voor deze week maken."}
          </p>
        </div>
        <button
          type="button"
          disabled={!currentOrg || busy === "gen"}
          onClick={() =>
            run("gen", () => gen({ data: { orgId: currentOrg!.id } }), "Drie nieuwe berichten staan klaar.")
          }
          className="inline-flex items-center gap-2 rounded-full bg-signal text-white px-4 py-2.5 text-[13.5px] font-bold disabled:opacity-60"
        >
          {busy === "gen" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {busy === "gen" ? "Bezig met schrijven…" : "Maak weekvoorstel (3 berichten)"}
        </button>
      </div>

      {isLoading ? (
        <p className="text-[13px] text-[#9C9C94]">Laden…</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((it) => (
            <article key={it.id} className="border border-line rounded-[14px] overflow-hidden flex flex-col">
              <div className="aspect-[4/5] bg-signal-soft">
                {it.image_url ? (
                  <img src={it.image_url} alt={it.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[#9C9C94] text-[13px]">
                    Geen foto gevonden
                  </div>
                )}
              </div>
              <div className="p-4 flex-1 flex flex-col gap-2">
                <div className="flex items-center justify-between text-[11.5px] font-bold">
                  <span className="text-signal-deep">{LABEL[it.channel] ?? it.channel}</span>
                  <span className="text-[#9C9C94]">
                    {it.publish_date &&
                      new Date(it.publish_date).toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long" })}
                  </span>
                </div>
                <h3 className="font-heading text-[15px] font-bold text-ink">{it.title}</h3>
                {editing === it.id ? (
                  <>
                    <textarea
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      rows={8}
                      className="w-full border border-line rounded-lg p-2 text-[13px]"
                    />
                    <div className="flex gap-2">
                      <button onClick={() => saveText(it.id)} className="text-[12.5px] font-bold text-signal-deep">
                        Opslaan
                      </button>
                      <button onClick={() => setEditing(null)} className="text-[12.5px] text-[#75766F]">
                        Annuleren
                      </button>
                    </div>
                  </>
                ) : (
                  <p className="text-[13px] text-[#4A4B45] whitespace-pre-line line-clamp-[10]">{it.content_text}</p>
                )}
              </div>
              <div className="p-3 border-t border-line grid grid-cols-2 gap-2">
                <button
                  disabled={busy === it.id}
                  onClick={() => run(it.id, () => approve({ data: { id: it.id } }), "Goedgekeurd en ingepland.")}
                  className="col-span-2 inline-flex items-center justify-center gap-2 rounded-full bg-signal text-white py-3 text-[14px] font-bold disabled:opacity-60"
                >
                  {busy === it.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Goedkeuren & inplannen
                </button>
                <button
                  disabled={busy === it.id}
                  onClick={() => run(it.id, () => swap({ data: { id: it.id } }), "Andere foto gekozen.")}
                  className="inline-flex items-center justify-center gap-1.5 rounded-full border border-line py-2 text-[12.5px] font-semibold text-ink"
                >
                  <ImageIcon className="w-3.5 h-3.5" /> Andere foto
                </button>
                <button
                  onClick={() => {
                    setEditing(it.id);
                    setDraft(it.content_text ?? "");
                  }}
                  className="inline-flex items-center justify-center gap-1.5 rounded-full border border-line py-2 text-[12.5px] font-semibold text-ink"
                >
                  <Pencil className="w-3.5 h-3.5" /> Tekst aanpassen
                </button>
                <button
                  disabled={busy === it.id}
                  onClick={() => run(it.id, () => reject({ data: { id: it.id } }), "Overgeslagen, staat als concept in de kalender.")}
                  className="col-span-2 inline-flex items-center justify-center gap-1.5 py-1.5 text-[12px] text-[#75766F]"
                >
                  <X className="w-3.5 h-3.5" /> Overslaan
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
