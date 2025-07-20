-- Create a function to get a user's privacy settings that bypasses RLS
CREATE OR REPLACE FUNCTION public.get_user_privacy(target_user_id UUID)
RETURNS TABLE (private_account BOOLEAN) 
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT us.private_account
  FROM public.user_settings us
  WHERE us.user_id = target_user_id;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_user_privacy(UUID) TO authenticated;