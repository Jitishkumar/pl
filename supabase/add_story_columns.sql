-- Migration to add missing columns to stories table

-- First check if the type column exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'stories' 
                   AND column_name = 'type') THEN
        -- Add type column with check constraint
        ALTER TABLE public.stories ADD COLUMN type TEXT CHECK (type IN ('image', 'video')) NOT NULL;
    END IF;
END $$;

-- Check if cloudinary_public_id column exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'stories' 
                   AND column_name = 'cloudinary_public_id') THEN
        -- Add cloudinary_public_id column
        ALTER TABLE public.stories ADD COLUMN cloudinary_public_id TEXT NOT NULL;
    END IF;
END $$;

-- Grant necessary permissions
GRANT ALL ON stories TO authenticated;

-- Update RLS policies
DROP POLICY IF EXISTS "Users can view all stories" ON public.stories;
DROP POLICY IF EXISTS "Users can insert their own stories" ON public.stories;
DROP POLICY IF EXISTS "Users can update their own stories" ON public.stories;
DROP POLICY IF EXISTS "Users can delete their own stories" ON public.stories;

CREATE POLICY "Users can view all stories"
    ON public.stories FOR SELECT
    USING (true);

CREATE POLICY "Users can insert their own stories"
    ON public.stories FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own stories"
    ON public.stories FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own stories"
    ON public.stories FOR DELETE
    USING (auth.uid() = user_id);