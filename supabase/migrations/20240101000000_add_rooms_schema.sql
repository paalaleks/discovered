-- Define room role type
CREATE TYPE public.room_role AS ENUM (
  'DJ',
  'member'
);

-- Create rooms table
CREATE TABLE public.rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  name text, -- Optional room name, could be based on initial playlist
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL, -- User who created the room
  initial_playlist_url text -- Store the first playlist URL provided (Basic handling for Story 2.1)
);

-- Create room_members table
CREATE TABLE public.room_members (
  room_id uuid REFERENCES public.rooms(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role room_role DEFAULT 'member'::public.room_role NOT NULL,
  joined_at timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY (room_id, user_id) -- Composite primary key ensures unique membership
);

-- Enable RLS for rooms
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

-- RLS Policies for rooms
CREATE POLICY "Allow authenticated users to create rooms" 
ON public.rooms FOR INSERT 
TO authenticated 
WITH CHECK ( true );

CREATE POLICY "Rooms are viewable by authenticated users" 
ON public.rooms FOR SELECT 
TO authenticated 
USING ( true );

-- Enable RLS for room_members
ALTER TABLE public.room_members ENABLE ROW LEVEL SECURITY;

-- RLS Policies for room_members
CREATE POLICY "Allow users to join rooms" 
ON public.room_members FOR INSERT 
TO authenticated 
WITH CHECK ( user_id = (select auth.uid()) );

CREATE POLICY "Allow members to view other members in their rooms" 
ON public.room_members FOR SELECT 
TO authenticated 
USING ( 
  room_id IN (
    SELECT room_id
    FROM public.room_members
    WHERE user_id = (select auth.uid())
  )
);

CREATE POLICY "Allow users to leave rooms" 
ON public.room_members FOR DELETE 
TO authenticated 
USING ( user_id = (select auth.uid()) ); 