-- Enable Row Level Security for follows table
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

-- Create policy for viewing follows
CREATE POLICY "Follows are viewable by everyone"
  ON public.follows
  FOR SELECT
  USING (true);

-- Create policy for inserting follows
CREATE POLICY "Users can follow others"
  ON public.follows
  FOR INSERT
  WITH CHECK (auth.uid() = follower_id);

-- Create policy for deleting follows
CREATE POLICY "Users can unfollow"
  ON public.follows
  FOR DELETE
  USING (auth.uid() = follower_id);