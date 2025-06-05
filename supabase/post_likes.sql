-- Create post_likes table with proper foreign key relationships
create table public.post_likes (
  id uuid not null default gen_random_uuid(),
  post_id uuid not null,
  user_id uuid not null,
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  constraint post_likes_pkey primary key (id),
  constraint post_likes_post_id_user_id_key unique (post_id, user_id),
  constraint post_likes_post_id_fkey foreign key (post_id) references public.posts(id) on delete cascade,
  constraint post_likes_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade
);

-- Create indexes for better query performance
create index if not exists idx_post_likes_post_id on public.post_likes using btree (post_id);
create index if not exists idx_post_likes_user_id on public.post_likes using btree (user_id);

-- Enable Row Level Security
alter table public.post_likes enable row level security;

-- Create policies
create policy "Users can view all post likes"
  on public.post_likes for select
  to authenticated
  using (true);

create policy "Users can like posts"
  on public.post_likes for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can unlike their own likes"
  on public.post_likes for delete
  to authenticated
  using (auth.uid() = user_id);