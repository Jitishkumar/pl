-- Add private account visibility rules for posts and shorts

-- Update Posts RLS policies to handle private account visibility
DROP POLICY IF EXISTS "Posts visibility rules" ON public.posts;

CREATE POLICY "Posts visibility based on private account setting"
    ON public.posts FOR SELECT
    USING (
        -- Allow if viewer is the post owner
        (auth.uid() = user_id)
        OR
        -- Allow if post owner doesn't have private account
        NOT EXISTS (
            SELECT 1 FROM public.user_settings
            WHERE user_settings.user_id = posts.user_id
            AND private_account = true
        )
        OR
        -- Allow if viewer follows the post owner who has private account
        EXISTS (
            SELECT 1 FROM public.follows
            WHERE follower_id = auth.uid()
            AND following_id = posts.user_id
            AND EXISTS (
                SELECT 1 FROM public.user_settings
                WHERE user_settings.user_id = posts.user_id
                AND private_account = true
            )
        )
    );

-- Update post_likes RLS policies to match post visibility
DROP POLICY IF EXISTS "Likes are viewable by everyone" ON public.post_likes;

CREATE POLICY "Likes visibility based on post visibility"
    ON public.post_likes FOR SELECT
    USING (
        -- Allow if viewer is the like owner
        (auth.uid() = user_id)
        OR
        -- Allow if post owner doesn't have private account
        NOT EXISTS (
            SELECT 1 FROM public.posts
            JOIN public.user_settings ON posts.user_id = user_settings.user_id
            WHERE posts.id = post_likes.post_id
            AND user_settings.private_account = true
        )
        OR
        -- Allow if viewer follows the post owner who has private account
        EXISTS (
            SELECT 1 FROM public.posts
            WHERE posts.id = post_likes.post_id
            AND EXISTS (
                SELECT 1 FROM public.follows
                WHERE follower_id = auth.uid()
                AND following_id = posts.user_id
                AND EXISTS (
                    SELECT 1 FROM public.user_settings
                    WHERE user_settings.user_id = posts.user_id
                    AND private_account = true
                )
            )
        )
    );

-- Update post_comments RLS policies to match post visibility
DROP POLICY IF EXISTS "Comments are viewable by everyone" ON public.post_comments;

CREATE POLICY "Comments visibility based on post visibility"
    ON public.post_comments FOR SELECT
    USING (
        -- Allow if viewer is the comment owner
        (auth.uid() = user_id)
        OR
        -- Allow if post owner doesn't have private account
        NOT EXISTS (
            SELECT 1 FROM public.posts
            JOIN public.user_settings ON posts.user_id = user_settings.user_id
            WHERE posts.id = post_comments.post_id
            AND user_settings.private_account = true
        )
        OR
        -- Allow if viewer follows the post owner who has private account
        EXISTS (
            SELECT 1 FROM public.posts
            WHERE posts.id = post_comments.post_id
            AND EXISTS (
                SELECT 1 FROM public.follows
                WHERE follower_id = auth.uid()
                AND following_id = posts.user_id
                AND EXISTS (
                    SELECT 1 FROM public.user_settings
                    WHERE user_settings.user_id = posts.user_id
                    AND private_account = true
                )
            )
        )
    );

-- Grant necessary permissions
GRANT ALL ON posts TO authenticated;
GRANT ALL ON post_likes TO authenticated;
GRANT ALL ON post_comments TO authenticated;