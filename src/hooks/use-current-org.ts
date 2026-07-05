import { useEffect, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

const STORAGE_KEY = "hb.currentOrgId";

export type OrgRole = "agency_admin" | "org_admin" | "editor";

export type OrgMembership = {
  org_id: string;
  role: OrgRole;
  organization: {
    id: string;
    name: string;
    slug: string;
    logo_url: string | null;
  };
};

export function useOrgMemberships() {
  const { user, loading } = useAuth();

  return useQuery({
    queryKey: ["org-memberships", user?.id],
    enabled: !loading && !!user,
    queryFn: async (): Promise<OrgMembership[]> => {
      const { data, error } = await supabase
        .from("organization_members")
        .select("org_id, role, organization:organizations(id, name, slug, logo_url)")
        .eq("user_id", user!.id);
      if (error) throw error;
      return (data ?? []).filter((m) => m.organization) as unknown as OrgMembership[];
    },
  });
}

export function useCurrentOrg() {
  const { data: memberships = [], isLoading } = useOrgMemberships();
  const [currentOrgId, setCurrentOrgIdState] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(STORAGE_KEY);
  });

  // Default: first membership if no stored / stored no longer valid.
  useEffect(() => {
    if (!memberships.length) return;
    const valid = memberships.some((m) => m.org_id === currentOrgId);
    if (!valid) {
      const next = memberships[0].org_id;
      setCurrentOrgIdState(next);
      if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, next);
    }
  }, [memberships, currentOrgId]);

  const setCurrentOrgId = useCallback((id: string) => {
    setCurrentOrgIdState(id);
    if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, id);
  }, []);

  const currentMembership = memberships.find((m) => m.org_id === currentOrgId) ?? null;

  return {
    isLoading,
    memberships,
    currentOrgId,
    currentOrg: currentMembership?.organization ?? null,
    currentRole: currentMembership?.role ?? null,
    setCurrentOrgId,
  };
}
