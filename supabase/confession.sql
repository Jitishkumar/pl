create table public.confessions (
  id serial not null,
  user_id uuid null,
  location_id text not null,
  location_name text not null,
  content text null,
  media jsonb null,
  is_anonymous boolean null default true,
  likes_count integer null default 0,
  comments_count integer null default 0,
  created_at timestamp with time zone null default now(),
  username text null,
  constraint confessions_pkey primary key (id),
  constraint confessions_user_id_fkey foreign KEY (user_id) references auth.users (id)
) TABLESPACE pg_default;

create index IF not exists confessions_location_id_idx on public.confessions using btree (location_id) TABLESPACE pg_default;

create index IF not exists confessions_user_id_idx on public.confessions using btree (user_id) TABLESPACE pg_default;