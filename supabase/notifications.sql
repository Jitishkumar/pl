-- Create notifications table
create table notifications (
  id uuid default uuid_generate_v4() primary key,
  recipient_id uuid references auth.users(id) on delete cascade,
  sender_id uuid references auth.users(id) on delete cascade,
  type varchar not null check (type in ('like', 'comment', 'follow', 'mention', 'follow_request', 'follow_accepted')),
  content text not null,
  reference_id uuid, -- ID of the referenced content (post, comment, etc.)
  is_read boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- Create index for faster queries
create index notifications_recipient_id_idx on notifications(recipient_id);
create index notifications_created_at_idx on notifications(created_at desc);

-- Set up Row Level Security (RLS)
alter table notifications enable row level security;

-- Create policies
create policy "Users can view their own notifications"
  on notifications for select
  using (auth.uid() = recipient_id);

create policy "Users can update their own notifications"
  on notifications for update
  using (auth.uid() = recipient_id);

-- Function to update updated_at timestamp
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

-- Create trigger for updated_at
create trigger update_notifications_updated_at
  before update on notifications
  for each row
  execute function update_updated_at_column();

-- Function to create notification
create or replace function create_notification(
  p_recipient_id uuid,
  p_sender_id uuid,
  p_type varchar,
  p_content text,
  p_reference_id uuid default null
) returns notifications as $$
declare
  v_notification notifications;
begin
  insert into notifications (recipient_id, sender_id, type, content, reference_id)
  values (p_recipient_id, p_sender_id, p_type, p_content, p_reference_id)
  returning * into v_notification;

  return v_notification;
end;
$$ language plpgsql security definer;

-- Function to delete notifications older than one week
create or replace function delete_old_notifications()
returns void as $$
begin
  delete from notifications
  where created_at < (now() - interval '1 week');
end;
$$ language plpgsql security definer;

-- Create a scheduled job to run the cleanup function daily
comment on function delete_old_notifications() is 'Deletes notifications older than one week';