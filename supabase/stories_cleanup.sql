-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create a function to delete expired stories
CREATE OR REPLACE FUNCTION delete_expired_stories()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Delete expired stories
  DELETE FROM stories
  WHERE expires_at < NOW();
  
  RETURN NULL;
END;
$$;

-- Create a trigger to automatically delete expired stories
DROP TRIGGER IF EXISTS trigger_delete_expired_stories ON stories;
CREATE TRIGGER trigger_delete_expired_stories
  AFTER INSERT OR UPDATE ON stories
  FOR EACH STATEMENT
  EXECUTE FUNCTION delete_expired_stories();

-- Create a cron job to periodically clean up expired stories
SELECT cron.schedule(
  'cleanup-expired-stories',   -- unique job name
  '*/30 * * * *',             -- every 30 minutes
  $$
    SELECT delete_expired_stories();
  $$
);