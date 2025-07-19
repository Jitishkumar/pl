-- Add updated_at column to messages table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'updated_at') THEN
    ALTER TABLE public.messages ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- Create a function to notify when message read status changes
CREATE OR REPLACE FUNCTION public.handle_message_read_status()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- Only trigger when read status changes from false to true
  IF OLD.read = FALSE AND NEW.read = TRUE THEN
    -- Update the updated_at timestamp
    NEW.updated_at = NOW();
    
    -- The notification will happen automatically through the existing subscription
    -- in MessagesScreen.js that listens for UPDATE events
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create a trigger that fires when a message's read status is updated
DROP TRIGGER IF EXISTS on_message_read_status_update ON public.messages;
CREATE TRIGGER on_message_read_status_update
  AFTER UPDATE OF read ON public.messages
  FOR EACH ROW
  WHEN (OLD.read IS DISTINCT FROM NEW.read)
  EXECUTE FUNCTION public.handle_message_read_status();

-- Add an index to improve query performance for read status updates
CREATE INDEX IF NOT EXISTS idx_messages_read_status
  ON public.messages (conversation_id, receiver_id, read);

-- Add an index to improve query performance for conversation lookups
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id
  ON public.messages (conversation_id);