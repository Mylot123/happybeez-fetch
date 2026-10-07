DROP POLICY IF EXISTS "Org admins manage campaign plans" ON public.campaign_plans;
CREATE POLICY "Org members manage campaign plans" ON public.campaign_plans FOR ALL TO authenticated
  USING (public.is_org_member(auth.uid(), org_id)) WITH CHECK (public.is_org_member(auth.uid(), org_id));

DROP POLICY IF EXISTS "Org admins manage campaign blocks" ON public.campaign_blocks;
CREATE POLICY "Org members manage campaign blocks" ON public.campaign_blocks FOR ALL TO authenticated
  USING (public.is_org_member(auth.uid(), org_id)) WITH CHECK (public.is_org_member(auth.uid(), org_id));

DROP POLICY IF EXISTS "Org admins manage brand profile" ON public.brand_profiles;
CREATE POLICY "Org members manage brand profile" ON public.brand_profiles FOR ALL TO authenticated
  USING (public.is_org_member(auth.uid(), org_id)) WITH CHECK (public.is_org_member(auth.uid(), org_id));

DROP POLICY IF EXISTS "org admins update media" ON public.media_assets;
DROP POLICY IF EXISTS "org admins delete media" ON public.media_assets;
CREATE POLICY "org members update media" ON public.media_assets FOR UPDATE TO authenticated
  USING (public.is_org_member(auth.uid(), org_id)) WITH CHECK (public.is_org_member(auth.uid(), org_id));
CREATE POLICY "org members delete media" ON public.media_assets FOR DELETE TO authenticated
  USING (public.is_org_member(auth.uid(), org_id));

CREATE OR REPLACE FUNCTION public.enforce_post_status_transition()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_org_member(auth.uid(), NEW.org_id) AND auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'Geen lid van deze organisatie' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.status IN ('approved','scheduled','published') AND NEW.approved_by IS NULL THEN
      NEW.approved_by := auth.uid();
      NEW.approved_at := now();
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status IN ('draft','review') THEN
      NEW.approved_by := NULL;
      NEW.approved_at := NULL;
    ELSIF NEW.status IN ('approved','scheduled','published') AND
       (OLD.status NOT IN ('approved','scheduled','published') OR NEW.approved_by IS NULL) THEN
      NEW.approved_by := auth.uid();
      NEW.approved_at := now();
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;