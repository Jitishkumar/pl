-- Add gender column to profiles table
alter table profiles add column if not exists gender text;

-- Add comment to describe the column
comment on column profiles.gender is 'User''s gender (male, female, or third)';

-- Grant access to authenticated users
grant all on profiles to authenticated;

-- Update RLS policies to include the new column
alter policy "Public profiles are viewable by everyone."
    on profiles
    to select using (true);

alter policy "Users can insert their own profile."
    on profiles
    to insert with check (auth.uid() = id);

alter policy "Users can update own profile."
    on profiles
    to update using (auth.uid() = id);