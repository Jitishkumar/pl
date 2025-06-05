-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Function to clean up profile visits older than 30 days
CREATE OR REPLACE FUNCTION cleanup_old_profile_visits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Delete profile visits older than 30 days
  DELETE FROM profile_visits
  WHERE visited_at < (NOW() - INTERVAL '30 days');
  
  RAISE NOTICE 'Profile visits cleanup completed at %', NOW();
END;
$$;

-- Drop existing cron job if it exists
SELECT cron.unschedule('cleanup-profile-visits');

-- Create a cron job to clean up profile visits at midnight UTC on the 2nd day of every month
SELECT cron.schedule(
  'cleanup-profile-visits',    -- unique job name
  '0 0 2 * *',                -- At 00:00 on day-of-month 2
  'SELECT cleanup_old_profile_visits();'
);

-- Create an index to improve cleanup performance
CREATE INDEX IF NOT EXISTS idx_profile_visits_cleanup
ON profile_visits (visited_at);