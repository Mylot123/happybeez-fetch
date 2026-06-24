
CREATE POLICY "Authenticated can read library-photos"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'library-photos');
