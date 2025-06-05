-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create followers table
CREATE TABLE IF NOT EXISTS followers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    follower_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    following_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(follower_id, following_id)
);

-- Add followers-only visibility and story group columns to stories table
ALTER TABLE stories
    ADD COLUMN IF NOT EXISTS followers_only BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS story_group_id UUID,
    ADD COLUMN IF NOT EXISTS is_first_story BOOLEAN DEFAULT true;

-- Add index for story grouping
CREATE INDEX IF NOT EXISTS idx_stories_group ON stories(story_group_id);

-- Add RLS policies for followers table
ALTER TABLE followers ENABLE ROW LEVEL SECURITY;

-- Followers policies
CREATE POLICY "Users can view followers"
    ON followers FOR SELECT
    USING (true);

CREATE POLICY "Users can follow others"
    ON followers FOR INSERT
    WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "Users can unfollow"
    ON followers FOR DELETE
    USING (auth.uid() = follower_id);

-- Update stories policies for followers-only visibility
DROP POLICY IF EXISTS "Stories are viewable by everyone" ON stories;

CREATE POLICY "Stories are viewable by followers or if not followers-only"
    ON stories FOR SELECT
    USING (
        NOT followers_only OR
        user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM followers
            WHERE follower_id = auth.uid()
            AND following_id = stories.user_id
        )
    );