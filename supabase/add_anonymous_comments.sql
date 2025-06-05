-- Add columns for anonymous commenting feature
ALTER TABLE public.post_comments ADD COLUMN IF NOT EXISTS is_anonymous BOOLEAN DEFAULT false;
ALTER TABLE public.post_comments ADD COLUMN IF NOT EXISTS creator_id UUID REFERENCES auth.users(id);

-- Update RLS policies to handle anonymous comments
DROP POLICY IF EXISTS "Users can create comments" ON public.post_comments;
CREATE POLICY "Users can create comments"
  ON public.post_comments FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.uid() = user_id) OR
    (is_anonymous = true AND auth.uid() = creator_id)
  );

DROP POLICY IF EXISTS "Users can update their own comments" ON public.post_comments;
CREATE POLICY "Users can update their own comments"
  ON public.post_comments FOR UPDATE
  TO authenticated
  USING (
    (auth.uid() = user_id) OR
    (is_anonymous = true AND auth.uid() = creator_id)
  );

DROP POLICY IF EXISTS "Users can delete their own comments" ON public.post_comments;
CREATE POLICY "Users can delete their own comments"
  ON public.post_comments FOR DELETE
  TO authenticated
  USING (
    (auth.uid() = user_id) OR
    (is_anonymous = true AND auth.uid() = creator_id)
  );