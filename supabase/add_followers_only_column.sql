-- Add followers_only column to stories table
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'stories' 
                   AND column_name = 'followers_only') THEN
        -- Add followers_only column with default value false
        ALTER TABLE public.stories ADD COLUMN followers_only BOOLEAN DEFAULT false NOT NULL;
    END IF;
END $$;

-- Update RLS policies to handle followers_only visibility
DROP POLICY IF EXISTS "Users can view all stories" ON public.stories;

CREATE POLICY "Stories visibility based on followers_only setting"
    ON public.stories FOR SELECT
    USING (
        -- Allow if story is not followers_only
        (NOT followers_only)
        OR
        -- Allow if viewer is the story owner
        (auth.uid() = user_id)
        OR
        -- Allow if viewer follows the story owner
        EXISTS (
            SELECT 1 FROM public.follows
            WHERE follower_id = auth.uid()
            AND following_id = stories.user_id
        )
    );

-- Grant necessary permissions
GRANT ALL ON stories TO authenticated;