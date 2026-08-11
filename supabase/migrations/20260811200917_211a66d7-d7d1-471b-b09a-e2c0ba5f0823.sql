ALTER TABLE public.brand_profiles
  ADD COLUMN IF NOT EXISTS color_palette jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS font_roles jsonb NOT NULL DEFAULT '[]'::jsonb;