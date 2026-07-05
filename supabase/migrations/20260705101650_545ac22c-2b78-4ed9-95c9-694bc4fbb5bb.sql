
-- =========================================
-- Sprint 1: Multi-tenant fundament
-- =========================================

-- 1) Role enum
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('agency_admin', 'org_admin', 'editor');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) organizations
CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  logo_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations TO authenticated;
GRANT ALL ON public.organizations TO service_role;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) organization_members (roles per org)
CREATE TABLE public.organization_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'editor',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_members TO authenticated;
GRANT ALL ON public.organization_members TO service_role;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

CREATE INDEX org_members_user_idx ON public.organization_members(user_id);
CREATE INDEX org_members_org_idx ON public.organization_members(org_id);

-- 4) brand_profiles (1-1 with org)
CREATE TABLE public.brand_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
  industry text,
  audience text,
  tone text,
  pillars text[] NOT NULL DEFAULT '{}',
  usps text[] NOT NULL DEFAULT '{}',
  primary_color text,
  secondary_color text,
  website text,
  extra jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.brand_profiles TO authenticated;
GRANT ALL ON public.brand_profiles TO service_role;
ALTER TABLE public.brand_profiles ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER brand_profiles_updated_at
  BEFORE UPDATE ON public.brand_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5) Security-definer helpers (avoid recursive RLS)
CREATE OR REPLACE FUNCTION public.is_org_member(_user_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = _user_id AND org_id = _org_id
  );
$$;

CREATE OR REPLACE FUNCTION public.has_org_role(_user_id uuid, _org_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = _user_id AND org_id = _org_id AND role = _role
  );
$$;

-- 6) RLS policies on new tables
CREATE POLICY "Members can view their organizations"
  ON public.organizations FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), id));

CREATE POLICY "Org admins can update their organization"
  ON public.organizations FOR UPDATE TO authenticated
  USING (public.has_org_role(auth.uid(), id, 'org_admin')
      OR public.has_org_role(auth.uid(), id, 'agency_admin'));

CREATE POLICY "Members can view org memberships they belong to"
  ON public.organization_members FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), org_id));

CREATE POLICY "Org admins manage members"
  ON public.organization_members FOR ALL TO authenticated
  USING (public.has_org_role(auth.uid(), org_id, 'org_admin')
      OR public.has_org_role(auth.uid(), org_id, 'agency_admin'))
  WITH CHECK (public.has_org_role(auth.uid(), org_id, 'org_admin')
      OR public.has_org_role(auth.uid(), org_id, 'agency_admin'));

CREATE POLICY "Members view brand profile"
  ON public.brand_profiles FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), org_id));

CREATE POLICY "Org admins manage brand profile"
  ON public.brand_profiles FOR ALL TO authenticated
  USING (public.has_org_role(auth.uid(), org_id, 'org_admin')
      OR public.has_org_role(auth.uid(), org_id, 'agency_admin'))
  WITH CHECK (public.has_org_role(auth.uid(), org_id, 'org_admin')
      OR public.has_org_role(auth.uid(), org_id, 'agency_admin'));

-- 7) Seed Happy Beez org + backfill existing users as org_admin
INSERT INTO public.organizations (name, slug)
VALUES ('Happy Beez', 'happy-beez')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.organization_members (org_id, user_id, role)
SELECT o.id, p.id, 'org_admin'::public.app_role
FROM public.organizations o
CROSS JOIN public.profiles p
WHERE o.slug = 'happy-beez'
ON CONFLICT (org_id, user_id) DO NOTHING;

INSERT INTO public.brand_profiles (org_id, industry, audience, tone, pillars, website)
SELECT id, 'Imkerij & duurzame lokale producten',
       'Natuurliefhebbers, tuiniers, cadeau-zoekers in NL',
       'Warm, deskundig, natuurgericht',
       ARRAY['Bijen & natuur','Producten uit eigen imkerij','Achter de schermen','Educatie & tips']::text[],
       'https://happybeez.nl'
FROM public.organizations WHERE slug = 'happy-beez'
ON CONFLICT (org_id) DO NOTHING;

-- 8) Add org_id to existing tables (nullable → backfill → not null)
DO $$
DECLARE
  hb_id uuid;
  tbl text;
  tables text[] := ARRAY[
    'library_photos','library_books','library_book_sections','book_contents',
    'news_items','content_calendar_items','seo_domain_snapshots','seo_keywords',
    'seo_keyword_history','seo_keyword_ideas','seo_page_audits','social_profiles',
    'agent_conversations','agent_messages'
  ];
BEGIN
  SELECT id INTO hb_id FROM public.organizations WHERE slug = 'happy-beez';

  FOREACH tbl IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE', tbl);
    EXECUTE format('UPDATE public.%I SET org_id = %L WHERE org_id IS NULL', tbl, hb_id);
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN org_id SET NOT NULL', tbl);
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN org_id SET DEFAULT %L', tbl, hb_id);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I(org_id)', tbl || '_org_idx', tbl);
  END LOOP;
END $$;

-- 9) Additive RLS policies: org members can access rows in their org
-- (keeps existing user_id-scoped policies working; adds org-scoped access)
DO $$
DECLARE
  tbl text;
  tables text[] := ARRAY[
    'library_photos','library_books','library_book_sections','book_contents',
    'news_items','content_calendar_items','seo_domain_snapshots','seo_keywords',
    'seo_keyword_history','seo_keyword_ideas','seo_page_audits','social_profiles',
    'agent_conversations','agent_messages'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Org members full access" ON public.%I', tbl);
    EXECUTE format(
      'CREATE POLICY "Org members full access" ON public.%I FOR ALL TO authenticated USING (public.is_org_member(auth.uid(), org_id)) WITH CHECK (public.is_org_member(auth.uid(), org_id))',
      tbl
    );
  END LOOP;
END $$;

-- 10) Update handle_new_user: auto-add signups to Happy Beez as editor (pilot behavior)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  hb_id uuid;
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;

  SELECT id INTO hb_id FROM public.organizations WHERE slug = 'happy-beez';
  IF hb_id IS NOT NULL THEN
    INSERT INTO public.organization_members (org_id, user_id, role)
    VALUES (hb_id, NEW.id, 'editor')
    ON CONFLICT (org_id, user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;
