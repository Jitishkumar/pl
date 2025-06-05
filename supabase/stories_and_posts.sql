--cloudinary Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create stories table
CREATE TABLE IF NOT EXISTS stories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    media_url TEXT,
    cloudinary_public_id TEXT,
    type TEXT CHECK (type IN ('image', 'video', 'text')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours')
);

-- Create posts table
CREATE TABLE IF NOT EXISTS posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    caption TEXT,
    media_url TEXT,
    cloudinary_public_id TEXT,
    type TEXT CHECK (type IN ('image', 'video', 'text')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create likes table for posts
CREATE TABLE IF NOT EXISTS post_likes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(post_id, user_id)
);

-- Create comments table for posts
CREATE TABLE IF NOT EXISTS post_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add RLS policies
ALTER TABLE stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_comments ENABLE ROW LEVEL SECURITY;

-- Update Stories policies
-- Drop all existing policies for stories table
DROP POLICY IF EXISTS "Stories visibility based on followers" ON stories;
DROP POLICY IF EXISTS "Stories visibility for followers only" ON stories;
DROP POLICY IF EXISTS "Stories are viewable by everyone" ON stories;
DROP POLICY IF EXISTS "Users can insert their own stories" ON stories;
DROP POLICY IF EXISTS "Users can update their own stories" ON stories;
DROP POLICY IF EXISTS "Users can delete their own stories" ON stories;

-- Create new policy for stories visibility (followers only)
CREATE POLICY "Stories visibility rules"
    ON stories FOR SELECT
    USING (
        user_id = auth.uid() OR  -- User can see their own stories
        EXISTS (
            SELECT 1 FROM followers
            WHERE follower_id = auth.uid()
            AND following_id = stories.user_id
        )
    );

-- Set default value for followers_only to true
ALTER TABLE stories ALTER COLUMN followers_only SET DEFAULT true;

CREATE POLICY "Users can insert their own stories"
    ON stories FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own stories"
    ON stories FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own stories"
    ON stories FOR DELETE
    USING (auth.uid() = user_id);

-- Posts policies
-- First drop existing policies
DROP POLICY IF EXISTS "Posts are viewable by everyone" ON posts;
DROP POLICY IF EXISTS "Users can insert their own posts" ON posts;
DROP POLICY IF EXISTS "Users can update their own posts" ON posts;
DROP POLICY IF EXISTS "Users can delete their own posts" ON posts;

-- Create new policies
CREATE POLICY "Posts visibility rules"
    ON posts FOR SELECT
    USING (true);

CREATE POLICY "Users can insert their own posts"
    ON posts FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own posts"
    ON posts FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own posts"
    ON posts FOR DELETE
    USING (auth.uid() = user_id);

-- Likes policies
-- First drop existing policies
DROP POLICY IF EXISTS "Likes are viewable by everyone" ON post_likes;
DROP POLICY IF EXISTS "Users can insert their own likes" ON post_likes;
DROP POLICY IF EXISTS "Users can delete their own likes" ON post_likes;

-- Create new policies
CREATE POLICY "Likes are viewable by everyone"
    ON post_likes FOR SELECT
    USING (true);

CREATE POLICY "Users can insert their own likes"
    ON post_likes FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own likes"
    ON post_likes FOR DELETE
    USING (auth.uid() = user_id);

-- Comments policies
-- First drop existing policies
DROP POLICY IF EXISTS "Comments are viewable by everyone" ON post_comments;
DROP POLICY IF EXISTS "Users can insert their own comments" ON post_comments;
DROP POLICY IF EXISTS "Users can update their own comments" ON post_comments;
DROP POLICY IF EXISTS "Users can delete their own comments" ON post_comments;

-- Create new policies
CREATE POLICY "Comments are viewable by everyone"
    ON post_comments FOR SELECT
    USING (true);

CREATE POLICY "Users can insert their own comments"
    ON post_comments FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own comments"
    ON post_comments FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comments"
    ON post_comments FOR DELETE
    USING (auth.uid() = user_id);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS stories_user_id_idx ON stories(user_id);
CREATE INDEX IF NOT EXISTS stories_created_at_idx ON stories(created_at);
CREATE INDEX IF NOT EXISTS posts_user_id_idx ON posts(user_id);
CREATE INDEX IF NOT EXISTS posts_created_at_idx ON posts(created_at);
CREATE INDEX IF NOT EXISTS post_likes_post_id_idx ON post_likes(post_id);
CREATE INDEX IF NOT EXISTS post_likes_user_id_idx ON post_likes(user_id);
CREATE INDEX IF NOT EXISTS post_comments_post_id_idx ON post_comments(post_id);
CREATE INDEX IF NOT EXISTS post_comments_user_id_idx ON post_comments(user_id);