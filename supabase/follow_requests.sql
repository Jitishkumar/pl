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
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'follow_requests' 
    AND policyname = 'Users can view their own follow requests'
  ) THEN
    CREATE POLICY "Users can view their own follow requests" 
      ON public.follow_requests 
      FOR SELECT 
      USING (
        auth.uid() = sender_id OR 
        auth.uid() = recipient_id
      );
  END IF;
END $$;

-- Policy for creating follow requests
-- Users can create follow requests to other users
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'follow_requests' 
    AND policyname = 'Users can create follow requests'
  ) THEN
    CREATE POLICY "Users can create follow requests" 
      ON public.follow_requests 
      FOR INSERT 
      WITH CHECK (
        auth.uid() = sender_id AND 
        auth.uid() != recipient_id
      );
  END IF;
END $$;

-- Policy for updating follow requests
-- Only recipients can update the status of a follow request
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'follow_requests' 
    AND policyname = 'Recipients can update follow request status'
  ) THEN
    CREATE POLICY "Recipients can update follow request status" 
      ON public.follow_requests 
      FOR UPDATE 
      USING (auth.uid() = recipient_id)
      WITH CHECK (auth.uid() = recipient_id);
  END IF;
END $$;

-- Policy for deleting follow requests
-- Users can delete follow requests they've sent
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'follow_requests' 
    AND policyname = 'Users can delete their own follow requests'
  ) THEN
    CREATE POLICY "Users can delete their own follow requests" 
      ON public.follow_requests 
      FOR DELETE 
      USING (auth.uid() = sender_id);
  END IF;
END $$;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS follow_requests_sender_id_idx ON public.follow_requests (sender_id);
CREATE INDEX IF NOT EXISTS follow_requests_recipient_id_idx ON public.follow_requests (recipient_id);
CREATE INDEX IF NOT EXISTS follow_requests_status_idx ON public.follow_requests (status);
CREATE INDEX IF NOT EXISTS follow_requests_sender_recipient_idx ON public.follow_requests (sender_id, recipient_id);

-- Create trigger to update updated_at timestamp
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'handle_updated_at') THEN
    CREATE OR REPLACE FUNCTION public.handle_updated_at()
    RETURNS TRIGGER AS $func$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $func$ LANGUAGE plpgsql;
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'set_updated_at' 
    AND tgrelid = 'public.follow_requests'::regclass
  ) THEN
    CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON public.follow_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();
  END IF;
END $$;

-- Create function to handle follow request acceptance
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'accept_follow_request') THEN
    CREATE OR REPLACE FUNCTION public.accept_follow_request(request_id UUID)
    RETURNS BOOLEAN AS $func$
    DECLARE
      v_sender_id UUID;
      v_recipient_id UUID;
      v_current_user_id UUID;
    BEGIN
      -- Get the current user ID
      v_current_user_id := auth.uid();
      
      -- Get the sender and recipient IDs from the follow request
      SELECT sender_id, recipient_id INTO v_sender_id, v_recipient_id
      FROM public.follow_requests
      WHERE id = request_id AND status = 'pending';
      
      -- Check if the current user is the recipient
      IF v_current_user_id != v_recipient_id THEN
        RAISE EXCEPTION 'You can only accept follow requests sent to you';
        RETURN FALSE;
      END IF;
      
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
      
      RETURN TRUE;
    EXCEPTION
      WHEN OTHERS THEN
        RETURN FALSE;
    END;
    $func$ LANGUAGE plpgsql SECURITY DEFINER;
  END IF;
END $$;

-- Create function to handle follow request decline
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'decline_follow_request') THEN
    CREATE OR REPLACE FUNCTION public.decline_follow_request(request_id UUID)
    RETURNS BOOLEAN AS $func$
    DECLARE
      v_recipient_id UUID;
      v_current_user_id UUID;
    BEGIN
      -- Get the current user ID
      v_current_user_id := auth.uid();
      
      -- Get the recipient ID from the follow request
      SELECT recipient_id INTO v_recipient_id
      FROM public.follow_requests
      WHERE id = request_id AND status = 'pending';
      
      -- Check if the current user is the recipient
      IF v_current_user_id != v_recipient_id THEN
        RAISE EXCEPTION 'You can only decline follow requests sent to you';
        RETURN FALSE;
      END IF;
      
      -- Update the follow request status to 'declined'
      UPDATE public.follow_requests
      SET status = 'declined'
      WHERE id = request_id;
      
      RETURN TRUE;
    EXCEPTION
      WHEN OTHERS THEN
        RETURN FALSE;
    END;
    $func$ LANGUAGE plpgsql SECURITY DEFINER;
  END IF;
END $$;