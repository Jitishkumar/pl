-- Create post_comments table with proper foreign key relationships
create table if not exists public.post_comments (
  id uuid not null default gen_random_uuid(),
  post_id uuid not null,
  user_id uuid not null,
  content text not null,
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  updated_at timestamp with time zone not null default timezone('utc'::text, now()),
  parent_comment_id uuid references public.post_comments(id) on delete cascade,
  constraint post_comments_pkey primary key (id),
  constraint post_comments_post_id_fkey foreign key (post_id) references public.posts(id) on delete cascade,
  constraint post_comments_user_id_fkey foreign key (user_id) references public.profiles(id) on delete cascade
);

-- Create indexes for better query performance
create index if not exists idx_post_comments_post_id on public.post_comments using btree (post_id);
create index if not exists idx_post_comments_user_id on public.post_comments using btree (user_id);
create index if not exists idx_post_comments_parent_id on public.post_comments using btree (parent_comment_id);
create index if not exists idx_post_comments_created_at on public.post_comments using btree (created_at);

-- Enable Row Level Security
alter table public.post_comments enable row level security;

-- Create policies
create policy "Users can view all comments"
  on public.post_comments for select
  to authenticated
  using (true);

create policy "Users can create comments"
  on public.post_comments for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update their own comments"
  on public.post_comments for update
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can delete their own comments"
  on public.post_comments for delete
  to authenticated
  using (auth.uid() = user_id);