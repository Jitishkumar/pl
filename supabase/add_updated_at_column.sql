-- This SQL file adds the updated_at column to the messages table
-- Run this in the Supabase SQL Editor

-- Add updated_at column to messages table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'updated_at') THEN
    ALTER TABLE public.messages ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    
    -- Update existing messages to have the updated_at value set to created_at
    -- Only run this after the column is created
    UPDATE public.messages
    SET updated_at = created_at
    WHERE updated_at IS NULL;
  END IF;
END $$;

-- Create a trigger to automatically update the updated_at column
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop the trigger if it exists
DROP TRIGGER IF EXISTS set_updated_at_trigger ON public.messages;

-- Create the trigger
CREATE TRIGGER set_updated_at_trigger
BEFORE UPDATE ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();