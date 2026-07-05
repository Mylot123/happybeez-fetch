-- Sprint 3: Approval workflow (retry)

-- 0) Drop old CHECK first so backfill can succeed
ALTER TABLE public.content_calendar_items
  DROP CONSTRAINT IF EXISTS content_calendar_items_status_check;

-- 1) New columns
ALTER TABLE public.content_calendar_items
  ADD COLUMN IF NOT EXISTS scheduled_at timestamptz,
  ADD COLUMN IF NOT EXISTS hashtags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS campaign_block_id uuid REFERENCES public.campaign_blocks(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS review_notes text,
  ADD COLUMN IF NOT EXISTS failure_reason text;

CREATE INDEX IF NOT EXISTS content_calendar_items_scheduled_idx
  ON public.content_calendar_items (scheduled_at);
CREATE INDEX IF NOT EXISTS content_calendar_items_status_idx
  ON public.content_calendar_items (org_id, status);

-- 2) Backfill legacy statuses
UPDATE public.content_calendar_items SET status = 'draft'     WHERE status = 'idee';
UPDATE public.content_calendar_items SET status = 'review'    WHERE status = 'bewerking';
UPDATE public.content_calendar_items SET status = 'scheduled' WHERE status = 'gepland';
UPDATE public.content_calendar_items SET status = 'published' WHERE status = 'gepubliceerd';

-- 3) New default + CHECK
ALTER TABLE public.content_calendar_items
  ALTER COLUMN status SET DEFAULT 'draft';

ALTER TABLE public.content_calendar_items
  ADD CONSTRAINT content_calendar_items_status_check
  CHECK (status IN ('draft','review','approved','scheduled','published','failed'));

-- 4) Trigger enforcing role-based status transitions
CREATE OR REPLACE FUNCTION public.enforce_post_status_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_admin boolean;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status NOT IN ('draft','review') THEN
      SELECT (public.has_org_role(auth.uid(), NEW.org_id, 'org_admin')
           OR public.has_org_role(auth.uid(), NEW.org_id, 'agency_admin'))
        INTO is_admin;
      IF NOT COALESCE(is_admin, false) THEN
        RAISE EXCEPTION 'Alleen beheerders mogen posts direct in status % zetten', NEW.status
          USING ERRCODE = '42501';
      END IF;
    END IF;
    IF NEW.status IN ('approved','scheduled','published') AND NEW.approved_by IS NULL THEN
      NEW.approved_by := auth.uid();
      NEW.approved_at := now();
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    SELECT (public.has_org_role(auth.uid(), NEW.org_id, 'org_admin')
         OR public.has_org_role(auth.uid(), NEW.org_id, 'agency_admin'))
      INTO is_admin;

    IF NEW.status IN ('draft','review') THEN
      NEW.approved_by := NULL;
      NEW.approved_at := NULL;
    ELSE
      IF NOT COALESCE(is_admin, false) THEN
        RAISE EXCEPTION 'Alleen beheerders mogen posts % maken', NEW.status
          USING ERRCODE = '42501';
      END IF;
      IF NEW.status IN ('approved','scheduled','published') AND
         (OLD.status NOT IN ('approved','scheduled','published') OR NEW.approved_by IS NULL) THEN
        NEW.approved_by := auth.uid();
        NEW.approved_at := now();
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_post_status_transition ON public.content_calendar_items;
CREATE TRIGGER enforce_post_status_transition
  BEFORE INSERT OR UPDATE ON public.content_calendar_items
  FOR EACH ROW EXECUTE FUNCTION public.enforce_post_status_transition();
