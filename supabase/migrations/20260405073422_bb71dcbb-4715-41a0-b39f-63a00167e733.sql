
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  username TEXT,
  email TEXT
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, username)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create nodes table
CREATE TABLE public.nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  title TEXT NOT NULL,
  creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
);

ALTER TABLE public.nodes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own nodes" ON public.nodes FOR SELECT USING (auth.uid() = creator_id);
CREATE POLICY "Users can create their own nodes" ON public.nodes FOR INSERT WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "Users can update their own nodes" ON public.nodes FOR UPDATE USING (auth.uid() = creator_id);
CREATE POLICY "Users can delete their own nodes" ON public.nodes FOR DELETE USING (auth.uid() = creator_id);

-- Create captures table
CREATE TABLE public.captures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  title TEXT NOT NULL,
  content_type TEXT NOT NULL DEFAULT 'TEXT',
  content_url TEXT,
  description TEXT,
  source TEXT,
  embedding vector(1536),
  creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  connected_to UUID REFERENCES public.nodes(id) ON DELETE SET NULL
);

ALTER TABLE public.captures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own captures" ON public.captures FOR SELECT USING (auth.uid() = creator_id);
CREATE POLICY "Users can create their own captures" ON public.captures FOR INSERT WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "Users can update their own captures" ON public.captures FOR UPDATE USING (auth.uid() = creator_id);
CREATE POLICY "Users can delete their own captures" ON public.captures FOR DELETE USING (auth.uid() = creator_id);

-- Search captures by text
CREATE OR REPLACE FUNCTION public.search_captures(search_query TEXT, user_id UUID)
RETURNS SETOF public.captures
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM public.captures
  WHERE creator_id = user_id
    AND (title ILIKE '%' || search_query || '%' OR description ILIKE '%' || search_query || '%')
  ORDER BY created_at DESC;
END;
$$;

-- Match captures by embedding similarity
CREATE OR REPLACE FUNCTION public.match_captures(
  query_embedding vector(1536),
  match_threshold FLOAT,
  match_count INT,
  user_id UUID
)
RETURNS TABLE (id UUID, title TEXT, description TEXT, content_type TEXT, similarity FLOAT)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.title,
    c.description,
    c.content_type,
    1 - (c.embedding OPERATOR(extensions.<=>) query_embedding)::FLOAT AS similarity
  FROM public.captures c
  WHERE c.creator_id = user_id
    AND 1 - (c.embedding OPERATOR(extensions.<=>) query_embedding)::FLOAT > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;
