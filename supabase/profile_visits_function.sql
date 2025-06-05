-- Drop existing function first
DROP FUNCTION IF EXISTS public.get_monthly_visit_counts(uuid, date);

-- Function to get monthly visit counts for a profile
CREATE OR REPLACE FUNCTION public.get_monthly_visit_counts(
  target_profile_id uuid,
  current_month date DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  visitor_id uuid,
  visit_count bigint,
  visitor_username text,
  visitor_avatar_url text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pv.visitor_id,
    COUNT(*) as visit_count,
    p.username as visitor_username,
    p.avatar_url as visitor_avatar_url
  FROM profile_visits pv
  LEFT JOIN profiles p ON p.id = pv.visitor_id
  WHERE 
    pv.profile_id = target_profile_id
    AND DATE_TRUNC('month', pv.created_at) = DATE_TRUNC('month', current_month::date)
  GROUP BY pv.visitor_id, p.username, p.avatar_url
  ORDER BY visit_count DESC;
END;
$$;