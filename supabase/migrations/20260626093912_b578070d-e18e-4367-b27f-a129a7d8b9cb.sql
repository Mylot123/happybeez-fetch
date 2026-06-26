
CREATE TABLE public.seo_keyword_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  keyword text NOT NULL,
  domain text NOT NULL,
  database_code text NOT NULL DEFAULT 'nl',
  rank integer,
  search_volume integer,
  difficulty integer,
  cpc numeric,
  position_url text,
  checked_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_seo_kw_hist_user_kw ON public.seo_keyword_history(user_id, keyword, domain, checked_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.seo_keyword_history TO authenticated;
GRANT ALL ON public.seo_keyword_history TO service_role;
ALTER TABLE public.seo_keyword_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own kw history" ON public.seo_keyword_history FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
