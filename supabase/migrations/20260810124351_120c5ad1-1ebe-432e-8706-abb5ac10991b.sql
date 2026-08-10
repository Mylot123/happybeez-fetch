CREATE TABLE public.library_folders (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (org_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.library_folders TO authenticated;
GRANT ALL ON public.library_folders TO service_role;
ALTER TABLE public.library_folders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members full access" ON public.library_folders FOR ALL TO authenticated
  USING (public.is_org_member(auth.uid(), org_id))
  WITH CHECK (public.is_org_member(auth.uid(), org_id));

ALTER TABLE public.library_photos ADD COLUMN folder_id uuid REFERENCES public.library_folders(id) ON DELETE SET NULL;