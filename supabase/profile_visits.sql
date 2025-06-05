-- Create profile_visits table to track all visits
create table if not exists public.profile_visits (
    id uuid default gen_random_uuid() primary key,
    profile_id uuid references public.profiles(id) on delete cascade not null,
    visitor_id uuid references public.profiles(id) on delete cascade not null,
    visited_at timestamp with time zone default timezone('utc'::text, now()) not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    visit_month date generated always as ((visited_at at time zone 'UTC')::date - (extract(day from visited_at at time zone 'UTC')::integer - 1)) stored
);

-- Add RLS policies
alter table public.profile_visits enable row level security;

-- Policy to allow users to view their own profile visits (with gender check)
-- Policy to allow female users to view their profile visits
create policy "Female users can view their profile visits"
    on public.profile_visits for select
    using (
        auth.uid() = profile_id AND
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = profile_id
            AND gender = 'female'
        )
    );

-- Policy to allow male users to view their visits to female profiles
create policy "Male users can view their visits to female profiles"
    on public.profile_visits for select
    using (
        auth.uid() = visitor_id AND
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = profile_id
            AND gender = 'female'
        )
    );

-- Policy to allow users to create profile visits
create policy "Users can create profile visits"
    on public.profile_visits for insert
    with check (auth.uid() = visitor_id);

-- Create index for better query performance
create index if not exists profile_visits_profile_id_idx on public.profile_visits(profile_id);
create index if not exists profile_visits_visitor_id_idx on public.profile_visits(visitor_id);
create index if not exists profile_visits_visited_at_idx on public.profile_visits(visited_at);

-- Grant access to authenticated users
grant select, insert on public.profile_visits to authenticated;