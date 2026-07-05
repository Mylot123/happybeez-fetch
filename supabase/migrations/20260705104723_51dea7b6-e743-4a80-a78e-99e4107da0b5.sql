
-- MEDIA ASSETS
CREATE TABLE public.media_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('image','video')),
  url text NOT NULL,
  source text NOT NULL DEFAULT 'ai' CHECK (source IN ('ai','upload','creatomate','stock')),
  format text,
  width int,
  height int,
  duration_seconds numeric,
  prompt text,
  template_id uuid,
  render_job_id text,
  render_status text NOT NULL DEFAULT 'ready' CHECK (render_status IN ('pending','rendering','ready','failed')),
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.media_assets TO authenticated;
GRANT ALL ON public.media_assets TO service_role;

ALTER TABLE public.media_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members view media"
  ON public.media_assets FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), org_id));

CREATE POLICY "org members insert media"
  ON public.media_assets FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(auth.uid(), org_id));

CREATE POLICY "org admins update media"
  ON public.media_assets FOR UPDATE TO authenticated
  USING (public.has_org_role(auth.uid(), org_id, 'org_admin') OR public.has_org_role(auth.uid(), org_id, 'agency_admin'))
  WITH CHECK (public.has_org_role(auth.uid(), org_id, 'org_admin') OR public.has_org_role(auth.uid(), org_id, 'agency_admin'));

CREATE POLICY "org admins delete media"
  ON public.media_assets FOR DELETE TO authenticated
  USING (public.has_org_role(auth.uid(), org_id, 'org_admin') OR public.has_org_role(auth.uid(), org_id, 'agency_admin'));

CREATE TRIGGER trg_media_assets_updated
  BEFORE UPDATE ON public.media_assets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- VIDEO TEMPLATES (agency-wide catalog)
CREATE TABLE public.video_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  creatomate_template_id text NOT NULL,
  thumbnail_url text,
  aspect_ratio text NOT NULL DEFAULT '9:16' CHECK (aspect_ratio IN ('1:1','4:5','9:16','16:9')),
  variables_schema jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.video_templates TO authenticated;
GRANT ALL ON public.video_templates TO service_role;

ALTER TABLE public.video_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated read templates"
  ON public.video_templates FOR SELECT TO authenticated
  USING (is_active = true);

CREATE TRIGGER trg_video_templates_updated
  BEFORE UPDATE ON public.video_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- PUBLISH ATTEMPTS (Ayrshare log)
CREATE TABLE public.publish_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.content_calendar_items(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  platform text NOT NULL,
  status text NOT NULL CHECK (status IN ('pending','sent','success','failed')),
  provider text NOT NULL DEFAULT 'ayrshare',
  provider_post_id text,
  response jsonb,
  error text,
  attempted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_publish_attempts_post ON public.publish_attempts(post_id);
CREATE INDEX idx_publish_attempts_org ON public.publish_attempts(org_id);

GRANT SELECT ON public.publish_attempts TO authenticated;
GRANT ALL ON public.publish_attempts TO service_role;

ALTER TABLE public.publish_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members view publish log"
  ON public.publish_attempts FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), org_id));

-- CONTENT CALENDAR EXTENSIONS
ALTER TABLE public.content_calendar_items
  ADD COLUMN IF NOT EXISTS ayrshare_post_id text,
  ADD COLUMN IF NOT EXISTS last_publish_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS retry_count int NOT NULL DEFAULT 0;
