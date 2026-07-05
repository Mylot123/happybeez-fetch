
-- Extend seo_keyword_history with SERP features + intent
ALTER TABLE public.seo_keyword_history
  ADD COLUMN IF NOT EXISTS serp_features jsonb,
  ADD COLUMN IF NOT EXISTS intent text;

-- seo_competitors: competitor domains tracked per org
CREATE TABLE IF NOT EXISTS public.seo_competitors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  own_domain text NOT NULL,
  competitor_domain text NOT NULL,
  label text,
  database_code text NOT NULL DEFAULT 'nl',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, own_domain, competitor_domain, database_code)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.seo_competitors TO authenticated;
GRANT ALL ON public.seo_competitors TO service_role;

ALTER TABLE public.seo_competitors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members read competitors"
  ON public.seo_competitors FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), org_id));

CREATE POLICY "org members write competitors"
  ON public.seo_competitors FOR ALL TO authenticated
  USING (public.is_org_member(auth.uid(), org_id))
  WITH CHECK (public.is_org_member(auth.uid(), org_id));

CREATE TRIGGER update_seo_competitors_updated_at
  BEFORE UPDATE ON public.seo_competitors
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- seo_competitor_history: per keyword per competitor position over time
CREATE TABLE IF NOT EXISTS public.seo_competitor_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  keyword text NOT NULL,
  competitor_domain text NOT NULL,
  database_code text NOT NULL DEFAULT 'nl',
  rank integer,
  position_url text,
  checked_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.seo_competitor_history TO authenticated;
GRANT ALL ON public.seo_competitor_history TO service_role;

ALTER TABLE public.seo_competitor_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members read competitor history"
  ON public.seo_competitor_history FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), org_id));

CREATE POLICY "org members write competitor history"
  ON public.seo_competitor_history FOR ALL TO authenticated
  USING (public.is_org_member(auth.uid(), org_id))
  WITH CHECK (public.is_org_member(auth.uid(), org_id));

CREATE INDEX IF NOT EXISTS idx_seo_competitor_history_lookup
  ON public.seo_competitor_history (org_id, keyword, competitor_domain, checked_at DESC);

CREATE INDEX IF NOT EXISTS idx_seo_competitors_org
  ON public.seo_competitors (org_id, own_domain);
