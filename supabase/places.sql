-- Create places table for storing custom locations
create table public.places (
  id serial primary key,
  type text not null,
  name text not null,
  city text not null,
  district text null,
  state text not null,
  country text not null,
  latitude numeric null,
  longitude numeric null,
  created_at timestamp with time zone default now(),
  created_by uuid references auth.users(id)
);

-- Create index on name for faster searches
create index if not exists places_name_idx on public.places using btree (name);

-- Create index on city for faster searches
create index if not exists places_city_idx on public.places using btree (city);

-- Create RLS policies for places table
alter table public.places enable row level security;

-- Allow anyone to read places
create policy "Anyone can view places"
  on public.places
  for select
  to authenticated, anon
  using (true);

-- Allow authenticated users to insert places
create policy "Authenticated users can insert places"
  on public.places
  for insert
  to authenticated
  with check (auth.uid() = created_by);

-- Allow users to update their own places
create policy "Users can update their own places"
  on public.places
  for update
  to authenticated
  using (auth.uid() = created_by);

-- Allow users to delete their own places
create policy "Users can delete their own places"
  on public.places
  for delete
  to authenticated
  using (auth.uid() = created_by);