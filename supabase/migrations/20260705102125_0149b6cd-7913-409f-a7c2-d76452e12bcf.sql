-- Sprint 2: Campaign plans + blocks

-- 1) campaign_plans
CREATE TABLE public.campaign_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  month int NOT NULL CHECK (month BETWEEN 1 AND 12),
  year int NOT NULL CHECK (year BETWEEN 2024 AND 2100),
  theme text NOT NULL,
  goal text,
  summary text,
  status text NOT NULL DEFAULT 'concept' CHECK (status IN ('concept','approved','active','archived')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, year, month)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaign_plans TO authenticated;
GRANT ALL ON public.campaign_plans TO service_role;
ALTER TABLE public.campaign_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view campaign plans"
  ON public.campaign_plans FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), org_id));

CREATE POLICY "Org admins manage campaign plans"
  ON public.campaign_plans FOR ALL TO authenticated
  USING (public.has_org_role(auth.uid(), org_id, 'org_admin')
      OR public.has_org_role(auth.uid(), org_id, 'agency_admin'))
  WITH CHECK (public.has_org_role(auth.uid(), org_id, 'org_admin')
      OR public.has_org_role(auth.uid(), org_id, 'agency_admin'));

CREATE TRIGGER campaign_plans_updated_at
  BEFORE UPDATE ON public.campaign_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) campaign_blocks
CREATE TABLE public.campaign_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.campaign_plans(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  pillar text,
  week int CHECK (week BETWEEN 1 AND 6),
  hook text,
  platforms text[] NOT NULL DEFAULT '{}',
  notes text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX campaign_blocks_plan_idx ON public.campaign_blocks (plan_id);
CREATE INDEX campaign_blocks_org_idx ON public.campaign_blocks (org_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaign_blocks TO authenticated;
GRANT ALL ON public.campaign_blocks TO service_role;
ALTER TABLE public.campaign_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view campaign blocks"
  ON public.campaign_blocks FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), org_id));

CREATE POLICY "Org admins manage campaign blocks"
  ON public.campaign_blocks FOR ALL TO authenticated
  USING (public.has_org_role(auth.uid(), org_id, 'org_admin')
      OR public.has_org_role(auth.uid(), org_id, 'agency_admin'))
  WITH CHECK (public.has_org_role(auth.uid(), org_id, 'org_admin')
      OR public.has_org_role(auth.uid(), org_id, 'agency_admin'));

CREATE TRIGGER campaign_blocks_updated_at
  BEFORE UPDATE ON public.campaign_blocks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
