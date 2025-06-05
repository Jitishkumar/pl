-- Add cover_is_video column to profiles table
alter table profiles add column if not exists cover_is_video boolean default false;

-- Add comment to describe the column
comment on column profiles.cover_is_video is 'Flag indicating if the cover media is a video';

-- Grant access to authenticated users
grant all on profiles to authenticated;

-- Update RLS policies to include the new column
alter policy "Public profiles are viewable by everyone."
    on profiles
    using (true);

alter policy "Users can insert their own profile."
    on profiles
    with check (auth.uid() = id);

alter policy "Users can update own profile."
    on profiles
    using (auth.uid() = id);