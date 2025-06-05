-- Migration to add creator_id column to confessions table

-- First check if the column already exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'confessions' 
                   AND column_name = 'creator_id') THEN
        -- Add creator_id column to track who created anonymous posts
        ALTER TABLE public.confessions ADD COLUMN creator_id UUID REFERENCES auth.users(id);
        
        -- Update existing anonymous confessions to have the same creator_id as user_id where available
        UPDATE public.confessions 
        SET creator_id = user_id 
        WHERE creator_id IS NULL AND user_id IS NOT NULL;
        
        -- Update RLS policy to allow users to delete their own anonymous confessions
        DROP POLICY IF EXISTS "Users can delete their own confessions" ON public.confessions;
        
        CREATE POLICY "Users can delete their own confessions"
          ON public.confessions
          FOR DELETE
          USING (
            auth.uid() = user_id OR
            (is_anonymous = true AND auth.uid() = creator_id)
          );
    END IF;
END $$;