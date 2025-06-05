create table public.follows (
  follower_id uuid not null,
  following_id uuid not null,
  id uuid not null default gen_random_uuid (),
  constraint follows_pkey primary key (id),
  constraint unique_follow unique (follower_id, following_id),
  constraint follows_follower_id_fkey foreign KEY (follower_id) references profiles (id),
  constraint follows_following_id_fkey foreign KEY (following_id) references profiles (id)
) TABLESPACE pg_default;