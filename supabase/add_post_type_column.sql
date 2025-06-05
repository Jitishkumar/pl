-- Add type column to posts table
alter table public.posts
  add column type text not null default 'text';

-- Add comment to describe the column
comment on column public.posts.type is 'Type of post content (text, image, video)';

-- Update RLS policies to include the new column
alter policy "Enable read access for all users" on public.posts
  using (true);

alter policy "Enable insert for authenticated users only" on public.posts
  with check (auth.uid() = user_id);

alter policy "Enable update for users based on user_id" on public.posts
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

alter policy "Enable delete for users based on user_id" on public.posts
  using (auth.uid() = user_id);