CREATE POLICY "Authenticated can insert library photos" ON public.library_photos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update library photos" ON public.library_photos FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can delete library photos" ON public.library_photos FOR DELETE TO authenticated USING (true);