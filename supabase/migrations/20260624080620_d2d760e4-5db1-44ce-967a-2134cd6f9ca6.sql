
CREATE TABLE public.library_books (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  author text,
  year integer,
  source_url text,
  description text,
  cover_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.library_books TO authenticated;
GRANT ALL ON public.library_books TO service_role;
ALTER TABLE public.library_books ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read library books" ON public.library_books FOR SELECT TO authenticated USING (true);
CREATE TRIGGER trg_library_books_updated BEFORE UPDATE ON public.library_books FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.library_book_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id uuid NOT NULL REFERENCES public.library_books(id) ON DELETE CASCADE,
  section_number integer NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  page_start integer,
  tags text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.library_book_sections TO authenticated;
GRANT ALL ON public.library_book_sections TO service_role;
ALTER TABLE public.library_book_sections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read library sections" ON public.library_book_sections FOR SELECT TO authenticated USING (true);
CREATE INDEX idx_library_book_sections_book ON public.library_book_sections(book_id, section_number);

CREATE TABLE public.library_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id uuid REFERENCES public.library_books(id) ON DELETE SET NULL,
  title text NOT NULL,
  caption text,
  image_url text NOT NULL,
  storage_path text,
  width integer,
  height integer,
  tags text[] NOT NULL DEFAULT '{}',
  suggested_channels text[] NOT NULL DEFAULT '{}',
  credit text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.library_photos TO authenticated;
GRANT ALL ON public.library_photos TO service_role;
ALTER TABLE public.library_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read library photos" ON public.library_photos FOR SELECT TO authenticated USING (true);
CREATE INDEX idx_library_photos_book ON public.library_photos(book_id);
