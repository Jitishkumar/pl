-- Enable required extensions if not already enabled
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create stories_archive table
CREATE TABLE IF NOT EXISTS stories_archive (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  story_id UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  archived_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  story_data JSONB NOT NULL, -- Store complete story data including media URLs
  collection_name TEXT, -- Optional: Allow users to organize archived stories into collections
  
  CONSTRAINT unique_archived_story UNIQUE(story_id, user_id)
);

-- Set up Row Level Security (RLS)
ALTER TABLE stories_archive ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own archived stories"
  ON stories_archive
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can archive their own stories"
  ON stories_archive
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage their archived stories"
  ON stories_archive
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create function to archive a story
CREATE OR REPLACE FUNCTION archive_story(story_id_param UUID)
RETURNS stories_archive
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  archived_story stories_archive;
BEGIN
  -- Insert story into archive
  INSERT INTO stories_archive (story_id, user_id, story_data)
  SELECT 
    s.id,
    auth.uid(),
    jsonb_build_object(
      'media_url', s.media_url,
      'caption', s.caption,
      'created_at', s.created_at,
      'type', s.type
    )
  FROM stories s
  WHERE s.id = story_id_param
  AND s.user_id = auth.uid()
  RETURNING * INTO archived_story;

  RETURN archived_story;
END;
$$;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_stories_archive_user_id
ON stories_archive (user_id);

CREATE INDEX IF NOT EXISTS idx_stories_archive_created
ON stories_archive (archived_at);