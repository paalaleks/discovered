-- Migration: remove_message_select_rls
-- Purpose: Remove Row Level Security policies related to SELECT operations from the public.messages table.
-- These policies will be replaced by Supabase Realtime RLS configuration.

-- Drop the standard SELECT policy
drop policy "Allow members to view messages in their rooms" on public.messages;

-- Drop the redundant SELECT policy potentially intended for Realtime
drop policy "Allow members to view messages in their rooms (Realtime)" on public.messages; 