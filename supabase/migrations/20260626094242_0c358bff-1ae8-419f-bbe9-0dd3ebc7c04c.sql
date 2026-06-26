
-- Drop overly permissive policies on public.library_photos
DROP POLICY IF EXISTS "Authenticated can insert library photos" ON public.library_photos;
DROP POLICY IF EXISTS "Authenticated can update library photos" ON public.library_photos;
DROP POLICY IF EXISTS "Authenticated can delete library photos" ON public.library_photos;

-- Writes only via service_role (admin/backend scripts). Authenticated read remains.
CREATE POLICY "Service role can insert library photos" ON public.library_photos
  FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "Service role can update library photos" ON public.library_photos
  FOR UPDATE TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role can delete library photos" ON public.library_photos
  FOR DELETE TO service_role USING (true);

-- Storage: restrict writes to library-photos bucket to service_role only
DROP POLICY IF EXISTS "Service role can insert library-photos" ON storage.objects;
DROP POLICY IF EXISTS "Service role can update library-photos" ON storage.objects;
DROP POLICY IF EXISTS "Service role can delete library-photos" ON storage.objects;

CREATE POLICY "Service role can insert library-photos" ON storage.objects
  FOR INSERT TO service_role
  WITH CHECK (bucket_id = 'library-photos');

CREATE POLICY "Service role can update library-photos" ON storage.objects
  FOR UPDATE TO service_role
  USING (bucket_id = 'library-photos')
  WITH CHECK (bucket_id = 'library-photos');

CREATE POLICY "Service role can delete library-photos" ON storage.objects
  FOR DELETE TO service_role
  USING (bucket_id = 'library-photos');
