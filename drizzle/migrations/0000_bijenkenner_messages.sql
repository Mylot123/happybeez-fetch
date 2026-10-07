CREATE TABLE public.bijenkenner_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL,
  kanaal text NOT NULL CHECK (kanaal IN ('chat','spraak')),
  role text NOT NULL CHECK (role IN ('user','assistant')),
  content text NOT NULL CHECK (char_length(content) BETWEEN 1 AND 4000),
  category text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX bijenkenner_messages_created_idx ON public.bijenkenner_messages (created_at DESC);
CREATE INDEX bijenkenner_messages_session_idx ON public.bijenkenner_messages (session_id);
GRANT INSERT ON public.bijenkenner_messages TO anon;
GRANT SELECT, INSERT, UPDATE ON public.bijenkenner_messages TO authenticated;
GRANT ALL ON public.bijenkenner_messages TO service_role;
ALTER TABLE public.bijenkenner_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Bezoekers mogen berichten loggen" ON public.bijenkenner_messages
  FOR INSERT TO anon, authenticated WITH CHECK (category IS NULL);
CREATE POLICY "Teamleden lezen berichten" ON public.bijenkenner_messages
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Teamleden categoriseren berichten" ON public.bijenkenner_messages
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);