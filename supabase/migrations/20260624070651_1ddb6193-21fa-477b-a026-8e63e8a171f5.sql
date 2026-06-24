
-- Profile auto-update timestamp helper
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- ========== profiles ==========
CREATE TABLE public.profiles (
  id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE TRIGGER profiles_set_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ========== book_contents ==========
CREATE TABLE public.book_contents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('citaat','hoofdstuk')),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  chapter TEXT,
  page_number INT,
  suggested_channels TEXT[] NOT NULL DEFAULT '{}',
  tags TEXT[] NOT NULL DEFAULT '{}',
  used_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.book_contents TO authenticated;
GRANT ALL ON public.book_contents TO service_role;
ALTER TABLE public.book_contents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own book_contents" ON public.book_contents FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER book_contents_set_updated_at BEFORE UPDATE ON public.book_contents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX book_contents_user_id_idx ON public.book_contents(user_id);

-- ========== content_calendar_items ==========
CREATE TABLE public.content_calendar_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('instagram','linkedin','facebook','blog','website')),
  content_type TEXT CHECK (content_type IN ('tip','citaat','boekfragment','product','educatief','seizoen','nieuws','behind_scenes')),
  status TEXT NOT NULL DEFAULT 'idee' CHECK (status IN ('idee','bewerking','gepland','gepubliceerd')),
  publish_date DATE,
  content_text TEXT,
  source_type TEXT,
  source_id UUID,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.content_calendar_items TO authenticated;
GRANT ALL ON public.content_calendar_items TO service_role;
ALTER TABLE public.content_calendar_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own calendar items" ON public.content_calendar_items FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER content_calendar_items_set_updated_at BEFORE UPDATE ON public.content_calendar_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX content_calendar_items_user_id_idx ON public.content_calendar_items(user_id);
CREATE INDEX content_calendar_items_publish_date_idx ON public.content_calendar_items(user_id, publish_date);

-- ========== news_items ==========
CREATE TABLE public.news_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  summary TEXT,
  source TEXT,
  url TEXT,
  published_at TIMESTAMPTZ,
  relevance INT,
  used BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.news_items TO authenticated;
GRANT ALL ON public.news_items TO service_role;
ALTER TABLE public.news_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own news items" ON public.news_items FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER news_items_set_updated_at BEFORE UPDATE ON public.news_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX news_items_user_id_idx ON public.news_items(user_id);

-- ========== seo_keywords ==========
CREATE TABLE public.seo_keywords (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  search_volume INT,
  difficulty INT,
  current_rank INT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.seo_keywords TO authenticated;
GRANT ALL ON public.seo_keywords TO service_role;
ALTER TABLE public.seo_keywords ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own seo keywords" ON public.seo_keywords FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER seo_keywords_set_updated_at BEFORE UPDATE ON public.seo_keywords FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX seo_keywords_user_id_idx ON public.seo_keywords(user_id);

-- ========== social_profiles ==========
CREATE TABLE public.social_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('instagram','linkedin','facebook','blog','website','tiktok','youtube','x')),
  handle TEXT NOT NULL,
  url TEXT,
  description TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_profiles TO authenticated;
GRANT ALL ON public.social_profiles TO service_role;
ALTER TABLE public.social_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own social profiles" ON public.social_profiles FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER social_profiles_set_updated_at BEFORE UPDATE ON public.social_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX social_profiles_user_id_idx ON public.social_profiles(user_id);
