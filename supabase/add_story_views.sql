-- Add story_views table to track which stories have been viewed by users
CREATE TABLE IF NOT EXISTS story_views (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    story_id UUID REFERENCES stories(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(story_id, user_id)
);

-- Enable RLS on story_views table
ALTER TABLE story_views ENABLE ROW LEVEL SECURITY;

-- Create policies for story_views
CREATE POLICY "Users can view all story views"
    ON story_views FOR SELECT
    USING (true);

CREATE POLICY "Users can insert their own story views"
    ON story_views FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_story_views_story_id ON story_views(story_id);
CREATE INDEX IF NOT EXISTS idx_story_views_user_id ON story_views(user_id);

-- Grant permissions to authenticated users
GRANT ALL ON story_views TO authenticated;

-- Create a function to check if a story has been viewed by the current user
CREATE OR REPLACE FUNCTION has_viewed_story(story_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM story_views
        WHERE story_views.story_id = $1
        AND story_views.user_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to check if any story in a story group has been viewed
CREATE OR REPLACE FUNCTION has_viewed_story_group(group_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM story_views
        JOIN stories ON stories.id = story_views.story_id
        WHERE stories.story_group_id = $1
        AND story_views.user_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;