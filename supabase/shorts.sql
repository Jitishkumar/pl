-- Create shorts table for short-form video content
CREATE TABLE IF NOT EXISTS public.shorts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  caption TEXT,
  media_url TEXT NOT NULL,
  cloudinary_public_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  likes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0
);

-- Create likes table for shorts
CREATE TABLE IF NOT EXISTS public.short_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  short_id UUID REFERENCES public.shorts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(short_id, user_id)
);

-- Create comments table for shorts
CREATE TABLE IF NOT EXISTS public.short_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  short_id UUID REFERENCES public.shorts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  parent_comment_id UUID REFERENCES public.short_comments(id) ON DELETE CASCADE,
  is_anonymous BOOLEAN DEFAULT false,
  creator_id UUID REFERENCES auth.users(id)
);

-- Enable Row Level Security
ALTER TABLE public.shorts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.short_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.short_comments ENABLE ROW LEVEL SECURITY;

-- Create basic policies (these will be overridden by private_account_shorts.sql)
CREATE POLICY "Shorts are viewable by everyone"
  ON public.shorts
  FOR SELECT
  USING (true);

CREATE POLICY "Users can insert their own shorts"
  ON public.shorts
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own shorts"
  ON public.shorts
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own shorts"
  ON public.shorts
  FOR DELETE
  USING (auth.uid() = user_id);

-- Short likes policies
CREATE POLICY "Short likes are viewable by everyone"
  ON public.short_likes
  FOR SELECT
  USING (true);

CREATE POLICY "Users can insert their own short likes"
  ON public.short_likes
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own short likes"
  ON public.short_likes
  FOR DELETE
  USING (auth.uid() = user_id);

-- Short comments policies
CREATE POLICY "Short comments are viewable by everyone"
  ON public.short_comments
  FOR SELECT
  USING (true);

CREATE POLICY "Users can insert their own short comments"
  ON public.short_comments
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own short comments"
  ON public.short_comments
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own short comments"
  ON public.short_comments
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS shorts_user_id_idx ON public.shorts(user_id);
CREATE INDEX IF NOT EXISTS shorts_created_at_idx ON public.shorts(created_at);
CREATE INDEX IF NOT EXISTS short_likes_short_id_idx ON public.short_likes(short_id);
CREATE INDEX IF NOT EXISTS short_likes_user_id_idx ON public.short_likes(user_id);
CREATE INDEX IF NOT EXISTS short_comments_short_id_idx ON public.short_comments(short_id);
CREATE INDEX IF NOT EXISTS short_comments_user_id_idx ON public.short_comments(user_id);