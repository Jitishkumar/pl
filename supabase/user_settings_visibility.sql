-- Add policy to allow users to view private_account status of other users
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'user_settings' 
    AND policyname = 'Users can view private_account status of other users'
  ) THEN
    CREATE POLICY "Users can view private_account status of other users"
      ON public.user_settings
      FOR SELECT
      USING (
        -- Allow viewing private_account status of any user
        true
      );
  END IF;
END $$;