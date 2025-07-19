-- Create follow_requests table
CREATE TABLE IF NOT EXISTS public.follow_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(sender_id, recipient_id)
);

-- Add RLS policies
ALTER TABLE public.follow_requests ENABLE ROW LEVEL SECURITY;

-- Policy for viewing follow requests
-- Users can see follow requests they've sent or received
CREATE POLICY "Users can view their own follow requests" 
  ON public.follow_requests 
  FOR SELECT 
  USING (
    auth.uid() = sender_id OR 
    auth.uid() = recipient_id
  );

-- Policy for creating follow requests
-- Users can create follow requests to other users
CREATE POLICY "Users can create follow requests" 
  ON public.follow_requests 
  FOR INSERT 
  WITH CHECK (
    auth.uid() = sender_id AND 
    auth.uid() != recipient_id
  );

-- Policy for updating follow requests
-- Only recipients can update the status of a follow request
CREATE POLICY "Recipients can update follow request status" 
  ON public.follow_requests 
  FOR UPDATE 
  USING (auth.uid() = recipient_id)
  WITH CHECK (auth.uid() = recipient_id);

-- Policy for deleting follow requests
-- Users can delete follow requests they've sent
CREATE POLICY "Users can delete their own follow requests" 
  ON public.follow_requests 
  FOR DELETE 
  USING (auth.uid() = sender_id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS follow_requests_sender_id_idx ON public.follow_requests (sender_id);
CREATE INDEX IF NOT EXISTS follow_requests_recipient_id_idx ON public.follow_requests (recipient_id);
CREATE INDEX IF NOT EXISTS follow_requests_status_idx ON public.follow_requests (status);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at
BEFORE UPDATE ON public.follow_requests
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Create function to handle follow request acceptance
CREATE OR REPLACE FUNCTION public.accept_follow_request(request_id UUID)
RETURNS VOID AS $$
DECLARE
  v_sender_id UUID;
  v_recipient_id UUID;
BEGIN
  -- Get the sender and recipient IDs from the follow request
  SELECT sender_id, recipient_id INTO v_sender_id, v_recipient_id
  FROM public.follow_requests
  WHERE id = request_id AND status = 'pending';
  
  -- Update the follow request status to 'accepted'
  UPDATE public.follow_requests
  SET status = 'accepted'
  WHERE id = request_id;
  
  -- Create a follow relationship
  INSERT INTO public.follows (follower_id, following_id)
  VALUES (v_sender_id, v_recipient_id)
  ON CONFLICT (follower_id, following_id) DO NOTHING;
  
  -- Create a notification for the sender
  PERFORM create_notification(
    v_sender_id,
    v_recipient_id,
    'follow_accepted',
    'accepted your follow request',
    NULL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;