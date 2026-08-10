CREATE TABLE public.campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  start_date date NOT NULL,
  end_date date NOT NULL,
  posts_per_week integer NOT NULL DEFAULT 1,
  channels text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'concept',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT campaigns_posts_per_week_check CHECK (posts_per_week BETWEEN 1 AND 7),
  CONSTRAINT campaigns_status_check CHECK (status IN ('concept','active','archived')),
  CONSTRAINT campaigns_date_range_check CHECK (end_date >= start_date)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaigns TO authenticated;
GRANT ALL ON public.campaigns TO service_role;

ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can read campaigns"
  ON public.campaigns FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), org_id));

CREATE POLICY "Org members can insert campaigns"
  ON public.campaigns FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(auth.uid(), org_id));

CREATE POLICY "Org members can update campaigns"
  ON public.campaigns FOR UPDATE TO authenticated
  USING (public.is_org_member(auth.uid(), org_id))
  WITH CHECK (public.is_org_member(auth.uid(), org_id));

CREATE POLICY "Org members can delete campaigns"
  ON public.campaigns FOR DELETE TO authenticated
  USING (public.is_org_member(auth.uid(), org_id));

CREATE TRIGGER campaigns_updated_at
  BEFORE UPDATE ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX campaigns_org_dates_idx ON public.campaigns (org_id, start_date, end_date);