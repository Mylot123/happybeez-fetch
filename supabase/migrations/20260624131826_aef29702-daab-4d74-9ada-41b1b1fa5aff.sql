
ALTER TABLE public.seo_keywords
  ADD COLUMN IF NOT EXISTS domain text,
  ADD COLUMN IF NOT EXISTS database_code text DEFAULT 'nl',
  ADD COLUMN IF NOT EXISTS cpc numeric,
  ADD COLUMN IF NOT EXISTS competition numeric,
  ADD COLUMN IF NOT EXISTS intent text,
  ADD COLUMN IF NOT EXISTS position_url text,
  ADD COLUMN IF NOT EXISTS last_checked_at timestamptz;

CREATE TABLE IF NOT EXISTS public.seo_domain_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  domain text not null,
  database_code text not null default 'nl',
  rank_global bigint,
  organic_keywords integer,
  organic_traffic integer,
  organic_cost numeric,
  top_keywords jsonb default '[]'::jsonb,
  competitors jsonb default '[]'::jsonb,
  quick_wins jsonb default '[]'::jsonb,
  created_at timestamptz not null default now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.seo_domain_snapshots TO authenticated;
GRANT ALL ON public.seo_domain_snapshots TO service_role;
ALTER TABLE public.seo_domain_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "snapshots own" ON public.seo_domain_snapshots FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_snap_user_created ON public.seo_domain_snapshots(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.seo_page_audits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  url text not null,
  goal text,
  target_keyword text,
  score integer,
  title text,
  meta_description text,
  h1 text,
  word_count integer,
  issues jsonb default '[]'::jsonb,
  recommendations jsonb default '[]'::jsonb,
  ai_summary text,
  created_at timestamptz not null default now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.seo_page_audits TO authenticated;
GRANT ALL ON public.seo_page_audits TO service_role;
ALTER TABLE public.seo_page_audits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audits own" ON public.seo_page_audits FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_audits_user_created ON public.seo_page_audits(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.seo_keyword_ideas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  seed text not null,
  database_code text not null default 'nl',
  keyword text not null,
  search_volume integer,
  cpc numeric,
  competition numeric,
  difficulty numeric,
  kind text not null default 'related',
  created_at timestamptz not null default now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.seo_keyword_ideas TO authenticated;
GRANT ALL ON public.seo_keyword_ideas TO service_role;
ALTER TABLE public.seo_keyword_ideas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ideas own" ON public.seo_keyword_ideas FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_ideas_user_seed ON public.seo_keyword_ideas(user_id, seed, created_at DESC);
