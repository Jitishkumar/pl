-- Add RLS policies for shorts to respect private_account setting

-- First, update the shorts table policy
DROP POLICY IF EXISTS "Shorts are viewable by everyone" ON public.shorts;

CREATE POLICY "Shorts visibility based on private_account setting" 
ON public.shorts
FOR SELECT
TO authenticated
USING (
  -- Allow if the viewer is the shorts owner
  user_id = auth.uid() OR
  -- Allow if the shorts owner does not have a private account
  NOT EXISTS (
    SELECT 1 FROM public.user_settings 
    WHERE user_settings.user_id = shorts.user_id 
    AND user_settings.private_account = true
  ) OR
  -- Allow if the viewer follows the shorts owner who has a private account
  EXISTS (
    SELECT 1 FROM public.follows
    WHERE follows.follower_id = auth.uid()
    AND follows.following_id = shorts.user_id
    AND EXISTS (
      SELECT 1 FROM public.user_settings
      WHERE user_settings.user_id = shorts.user_id
      AND user_settings.private_account = true
    )
  )
);

-- Update the short_likes table policy
DROP POLICY IF EXISTS "Short likes are viewable by everyone" ON public.short_likes;

CREATE POLICY "Short likes visibility based on private_account setting"
ON public.short_likes
FOR SELECT
TO authenticated
USING (
  -- Allow if the viewer is the like owner
  user_id = auth.uid() OR
  -- Allow if the shorts owner does not have a private account
  NOT EXISTS (
    SELECT 1 FROM public.user_settings
    JOIN public.shorts ON shorts.id = short_likes.short_id
    WHERE user_settings.user_id = shorts.user_id
    AND user_settings.private_account = true
  ) OR
  -- Allow if the viewer follows the shorts owner who has a private account
  EXISTS (
    SELECT 1 FROM public.follows
    JOIN public.shorts ON shorts.id = short_likes.short_id
    WHERE follows.follower_id = auth.uid()
    AND follows.following_id = shorts.user_id
    AND EXISTS (
      SELECT 1 FROM public.user_settings
      WHERE user_settings.user_id = shorts.user_id
      AND user_settings.private_account = true
    )
  )
);

-- Update the short_comments table policy
DROP POLICY IF EXISTS "Short comments are viewable by everyone" ON public.short_comments;

CREATE POLICY "Short comments visibility based on private_account setting"
ON public.short_comments
FOR SELECT
TO authenticated
USING (
  -- Allow if the viewer is the comment owner
  user_id = auth.uid() OR
  -- Allow if the shorts owner does not have a private account
  NOT EXISTS (
    SELECT 1 FROM public.user_settings
    JOIN public.shorts ON shorts.id = short_comments.short_id
    WHERE user_settings.user_id = shorts.user_id
    AND user_settings.private_account = true
  ) OR
  -- Allow if the viewer follows the shorts owner who has a private account
  EXISTS (
    SELECT 1 FROM public.follows
    JOIN public.shorts ON shorts.id = short_comments.short_id
    WHERE follows.follower_id = auth.uid()
    AND follows.following_id = shorts.user_id
    AND EXISTS (
      SELECT 1 FROM public.user_settings
      WHERE user_settings.user_id = shorts.user_id
      AND user_settings.private_account = true
    )
  )
);