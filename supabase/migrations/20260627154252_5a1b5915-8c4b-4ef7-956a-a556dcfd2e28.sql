ALTER TABLE public.seo_domain_snapshots
  ADD COLUMN IF NOT EXISTS ai_actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS content_gaps jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS page_audit jsonb,
  ADD COLUMN IF NOT EXISTS soft_error text;