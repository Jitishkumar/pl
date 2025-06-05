-- Enable Row Level Security for confessions table
ALTER TABLE public.confessions ENABLE ROW LEVEL SECURITY;

-- Policy to allow users to delete their own confessions
CREATE POLICY "Users can delete their own confessions"
  ON public.confessions
  FOR DELETE
  USING (
    auth.uid() = user_id AND
    NOT is_anonymous
  );