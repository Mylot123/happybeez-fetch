import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Database, Images, BookOpen, Users, Newspaper, Palette } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Row = {
  key: string;
  label: string;
  icon: typeof Images;
  count: number;
  detail: string;
  to: string;
};

export function BrandDataOverview({ orgId }: { orgId: string | null | undefined }) {
  const { data, isLoading } = useQuery({
    queryKey: ["brand-data-overview", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const org = orgId!;
      const [photos, books, sections, snippets, socials, news, profile] = await Promise.all([
        supabase.from("library_photos").select("id, title, created_at").eq("org_id", org).order("created_at", { ascending: false }).limit(5),
        supabase.from("library_books").select("id, title, author").eq("org_id", org).order("created_at", { ascending: false }).limit(5),
        supabase.from("library_book_sections").select("id", { count: "exact", head: true }).eq("org_id", org),
        supabase.from("book_contents").select("id", { count: "exact", head: true }).eq("org_id", org),
        supabase.from("social_profiles").select("id, channel, handle").eq("org_id", org),
        supabase.from("news_items").select("id", { count: "exact", head: true }).eq("org_id", org),
        supabase.from("brand_profiles").select("industry, audience, tone, pillars, usps, primary_color, website, updated_at").eq("org_id", org).maybeSingle(),
      ]);
      const photoCount = await supabase.from("library_photos").select("id", { count: "exact", head: true }).eq("org_id", org);
      const bookCount = await supabase.from("library_books").select("id", { count: "exact", head: true }).eq("org_id", org);
      return {
        photos: photos.data ?? [],
        photoCount: photoCount.count ?? 0,
        books: books.data ?? [],
        bookCount: bookCount.count ?? 0,
        sectionCount: sections.count ?? 0,
        snippetCount: snippets.count ?? 0,
        socials: socials.data ?? [],
        newsCount: news.count ?? 0,
        profile: profile.data,
      };
    },
  });

  if (!orgId) return null;

  const p = data?.profile;
  const filled = p
    ? [p.industry, p.audience, p.tone, p.website, p.primary_color].filter(Boolean).length +
      (p.pillars?.length ? 1 : 0) +
      (p.usps?.length ? 1 : 0)
    : 0;

  const rows: Row[] = [
    {
      key: "profile",
      label: "Merkprofiel",
      icon: Palette,
      count: filled,
      detail: `${filled}/7 velden ingevuld${p?.updated_at ? ` · bijgewerkt ${new Date(p.updated_at).toLocaleDateString("nl-NL")}` : ""}`,
      to: "/merkprofiel",
    },
    {
      key: "photos",
      label: "Foto's",
      icon: Images,
      count: data?.photoCount ?? 0,
      detail: (data?.photos ?? []).map((x) => x.title).slice(0, 3).join(" · ") || "Nog niets geüpload",
      to: "/foto-bibliotheek",
    },
    {
      key: "books",
      label: "Boeken & kennis",
      icon: BookOpen,
      count: data?.bookCount ?? 0,
      detail: `${data?.sectionCount ?? 0} tekstfragmenten · ${data?.snippetCount ?? 0} kennis-snippets`,
      to: "/boek",
    },
    {
      key: "socials",
      label: "Social profielen",
      icon: Users,
      count: data?.socials.length ?? 0,
      detail: (data?.socials ?? []).map((s) => `${s.channel}: ${s.handle}`).slice(0, 3).join(" · ") || "Nog geen kanalen",
      to: "/social-profielen",
    },
    {
      key: "news",
      label: "Nieuwsbronnen",
      icon: Newspaper,
      count: data?.newsCount ?? 0,
      detail: "Gebruikt voor actuele haakjes in content",
      to: "/nieuws",
    },
  ];

  return (
    <section className="mt-8 bg-card border border-border/60 rounded-lg p-6">
      <div className="flex items-center gap-2 mb-1">
        <Database className="w-4 h-4 text-wine" />
        <h2 className="font-heading font-semibold text-ink">Wat de AI van jullie gebruikt</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Dit is alle informatie die is geüpload of ingevuld en die meegaat in campagnes, posts, beelden en de Bijenspecialist.
      </p>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Laden…</div>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <Link
              key={r.key}
              to={r.to}
              className="flex items-center gap-3 rounded-md border border-border/60 px-3 py-2 hover:border-wine transition-colors"
            >
              <r.icon className="w-4 h-4 text-muted-foreground shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-ink">{r.label}</p>
                <p className="text-xs text-muted-foreground truncate">{r.detail}</p>
              </div>
              <span className="text-sm font-semibold tabular-nums text-wine">{r.count}</span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
