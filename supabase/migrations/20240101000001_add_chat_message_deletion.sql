-- Enable Row Level Security on messages if not already enabled
-- (It's good practice to ensure it's enabled before adding policies)
alter table public.messages enable row level security;

-- Remove existing delete policy if it exists (to avoid conflicts)
drop policy if exists "Allow authenticated users to delete their own messages" on public.messages;

-- Add policy to allow users to delete their own messages
create policy "Allow authenticated users to delete their own messages"
on public.messages
for delete
to authenticated
using ( (select auth.uid()) = user_id );

-- Function to delete a specific message owned by the calling user
create or replace function public.delete_message(message_id bigint) -- Change function name and parameter type if ID is bigint
returns void
language plpgsql
security invoker -- Use invoker security to check the user's permissions via RLS
set search_path = '' -- Prevent search path hijacking
as $$
begin
  -- The RLS policy defined above will automatically enforce that
  -- the user can only delete messages where auth.uid() matches user_id.
  delete from public.messages -- Change table name
  where id = message_id;

  -- Check if the delete operation actually removed a row.
  -- If not, it means either the message_id didn't exist or RLS prevented the delete.
  -- You could optionally raise an exception here if needed, but for chat,
  -- simply not deleting might be acceptable.
  -- Example:
  -- if not found then
  --   raise exception 'Message not found or permission denied to delete message ID %', message_id;
  -- end if;
end;
$$; 