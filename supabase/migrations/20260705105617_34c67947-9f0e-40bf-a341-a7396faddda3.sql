
CREATE TABLE public.post_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.content_calendar_items(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  platform text NOT NULL,
  provider_post_id text,
  reach int NOT NULL DEFAULT 0,
  impressions int NOT NULL DEFAULT 0,
  likes int NOT NULL DEFAULT 0,
  comments int NOT NULL DEFAULT 0,
  shares int NOT NULL DEFAULT 0,
  saves int NOT NULL DEFAULT 0,
  clicks int NOT NULL DEFAULT 0,
  engagement_rate numeric(6,4) NOT NULL DEFAULT 0,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, platform, recorded_at)
);

CREATE INDEX idx_post_metrics_org ON public.post_metrics(org_id, recorded_at DESC);
CREATE INDEX idx_post_metrics_post ON public.post_metrics(post_id);

GRANT SELECT ON public.post_metrics TO authenticated;
GRANT ALL ON public.post_metrics TO service_role;

ALTER TABLE public.post_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members view metrics"
  ON public.post_metrics FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), org_id));
