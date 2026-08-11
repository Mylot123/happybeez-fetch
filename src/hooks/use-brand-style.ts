import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrg } from "@/hooks/use-current-org";
import {
  ensureFontsLoaded,
  fontStack,
  normalizeFontRoles,
  fontFor,
} from "@/lib/brand-style";
import { setOverlayFont } from "@/lib/watermark";

/**
 * Laadt de lettertype-rollen uit het merkprofiel en zet ze als CSS-variabelen,
 * zodat previews, posts en beeldteksten het juiste merklettertype gebruiken.
 */
export function useBrandStyle() {
  const { currentOrgId } = useCurrentOrg();

  const { data } = useQuery({
    queryKey: ["brand-font-roles", currentOrgId],
    enabled: !!currentOrgId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brand_profiles")
        .select("font_roles")
        .eq("org_id", currentOrgId!)
        .maybeSingle();
      if (error) throw error;
      return normalizeFontRoles(data?.font_roles);
    },
  });

  useEffect(() => {
    if (!data || typeof document === "undefined") return;
    ensureFontsLoaded(data.map((r) => r.family));
    const root = document.documentElement;
    root.style.setProperty("--font-heading", fontStack(fontFor(data, "heading")));
    root.style.setProperty("--font-body", fontStack(fontFor(data, "body")));
    root.style.setProperty("--font-overlay", fontStack(fontFor(data, "overlay")));
    root.style.setProperty("--font-accent", fontStack(fontFor(data, "accent")));
    setOverlayFont(fontFor(data, "overlay"));
  }, [data]);

  return data ?? null;
}
