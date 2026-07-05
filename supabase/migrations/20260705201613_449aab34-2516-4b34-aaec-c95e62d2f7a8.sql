CREATE TABLE public.campaign_plan_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id UUID NOT NULL REFERENCES public.campaign_plans(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  snapshot JSONB NOT NULL,
  prev_status TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_campaign_plan_versions_plan ON public.campaign_plan_versions(plan_id, created_at DESC);

GRANT SELECT, INSERT, DELETE ON public.campaign_plan_versions TO authenticated;
GRANT ALL ON public.campaign_plan_versions TO service_role;

ALTER TABLE public.campaign_plan_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view campaign plan versions"
  ON public.campaign_plan_versions FOR SELECT
  TO authenticated
  USING (public.is_org_member(auth.uid(), org_id));

CREATE POLICY "Org members can insert campaign plan versions"
  ON public.campaign_plan_versions FOR INSERT
  TO authenticated
  WITH CHECK (public.is_org_member(auth.uid(), org_id));

CREATE POLICY "Org members can delete campaign plan versions"
  ON public.campaign_plan_versions FOR DELETE
  TO authenticated
  USING (public.is_org_member(auth.uid(), org_id));