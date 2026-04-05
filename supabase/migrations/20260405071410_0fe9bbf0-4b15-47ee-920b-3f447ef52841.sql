
-- 1. Restructure captures table
ALTER TABLE public.captures
  DROP COLUMN IF EXISTS x,
  DROP COLUMN IF EXISTS y,
  DROP COLUMN IF EXISTS image_url,
  DROP COLUMN IF EXISTS link,
  DROP COLUMN IF EXISTS body;

ALTER TABLE public.captures
  ADD COLUMN IF NOT EXISTS content_url TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS connected_to UUID;

-- 2. Restructure nodes table
ALTER TABLE public.nodes
  DROP COLUMN IF EXISTS hierarchy,
  DROP COLUMN IF EXISTS embedding;

-- 3. Drop connections table (replaced by connected_to on captures)
DROP TABLE IF EXISTS public.connections;

-- 4. Create profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  username TEXT,
  email TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = user_id);
