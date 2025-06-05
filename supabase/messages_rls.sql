-- First drop the existing function
DROP FUNCTION IF EXISTS public.get_user_by_email_or_username(text);

-- Then create the new function
CREATE OR REPLACE FUNCTION public.get_user_by_email_or_username(identifier text)
RETURNS text AS $$
DECLARE
  user_email text;
BEGIN
  SELECT au.email INTO user_email
  FROM auth.users au
  LEFT JOIN public.profiles p ON au.id = p.id
  WHERE au.email = identifier
  OR p.username = identifier;
  
  RETURN user_email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create messages table
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id TEXT NOT NULL,
  sender_id UUID NOT NULL,
  receiver_id UUID NOT NULL,
  content TEXT NOT NULL,
  media_url TEXT,
  media_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  read BOOLEAN DEFAULT FALSE
);

-- Enable Row Level Security
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Policy to allow users to insert their own messages
CREATE POLICY "Users can insert their own messages"
  ON messages
  FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
  );

-- Policy to allow users to read messages they sent or received
CREATE POLICY "Users can read their own conversations"
  ON messages
  FOR SELECT
  USING (
    auth.uid() = sender_id OR
    auth.uid() = receiver_id
  );

-- Policy to allow users to delete their own messages
CREATE POLICY "Users can delete their own messages"
  ON messages
  FOR DELETE
  USING (
    auth.uid() = sender_id
  );

-- Create storage bucket for media
INSERT INTO storage.buckets (id, name) 
VALUES ('media', 'media') 
ON CONFLICT DO NOTHING;

-- Set up public access policy for the media bucket
CREATE POLICY "Public Access" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'media');