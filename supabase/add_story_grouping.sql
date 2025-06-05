-- Add story grouping columns to stories table
DO $$ 
BEGIN
    -- Add story_group_id column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'stories' 
                   AND column_name = 'story_group_id') THEN
        ALTER TABLE public.stories ADD COLUMN story_group_id UUID DEFAULT gen_random_uuid() NOT NULL;
    END IF;

    -- Add is_first_story column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'stories' 
                   AND column_name = 'is_first_story') THEN
        ALTER TABLE public.stories ADD COLUMN is_first_story BOOLEAN DEFAULT true NOT NULL;
    END IF;
END $$;

-- Create index on story_group_id for better query performance
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes 
                   WHERE tablename = 'stories' 
                   AND indexname = 'idx_stories_story_group_id') THEN
        CREATE INDEX idx_stories_story_group_id ON public.stories(story_group_id);
    END IF;
END $$;

-- Update RLS policies to maintain proper access control
DROP POLICY IF EXISTS "Stories visibility based on followers_only setting" ON public.stories;

CREATE POLICY "Stories visibility based on followers_only setting"
    ON public.stories FOR SELECT
    USING (
        -- Allow if viewer is the story owner
        (auth.uid() = user_id)
        OR
        -- Allow if story is not followers_only OR viewer follows the story owner
        (
            (NOT followers_only)
            OR
            EXISTS (
                SELECT 1 FROM public.follows
                WHERE follower_id = auth.uid()
                AND following_id = stories.user_id
            )
        )
    );

-- Grant necessary permissions
GRANT ALL ON stories TO authenticated;