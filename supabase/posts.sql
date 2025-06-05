-- Add new columns to posts table
ALTER TABLE posts
ADD COLUMN IF NOT EXISTS type TEXT CHECK (type IN ('text', 'image', 'video')) DEFAULT 'text',
ADD COLUMN IF NOT EXISTS media_url TEXT,
ADD COLUMN IF NOT EXISTS cloudinary_public_id TEXT;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_posts_type ON posts(type);
CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id);