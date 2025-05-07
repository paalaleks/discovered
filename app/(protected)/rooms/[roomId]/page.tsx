import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
// import type { Tables } from "@/lib/types/database.types"; // Keep if needed elsewhere, otherwise remove
import type { ChatMessage } from "@/lib/types";
// import { Database } from "@/lib/types/database.types"; // Assuming generated types
// import { CopyInviteButton } from "@/components/rooms/copy-invite-button"; // Removed unused import
import { RoomJoinHandler } from "@/components/rooms/room-join-handler"; // Import the join handler
import { RealtimeChat } from "@/components/realtime-chat"; // Import Chat Component
import { NavProtected } from "@/components/nav-protected";
import PlayerTrigger from "@/components/player-trigger";
// import { RealtimeAvatarStack } from "@/components/realtime-avatar-stack"; // Removed unused import
// Import Button component later when needed

type RoomPageProps = {
  params: Promise<{
    roomId: string;
  }>;
};

// Use the generated type for messages Row - THIS CAN BE REMOVED if MessageRow is only used inside ChatMessage type
// type MessageRow = Tables<"messages">;

// REMOVED ChatMessage definition from here
// export type ChatMessage = {
//   id: string; // Keep as string to match frontend usage, even if DB ID is number (id field is number in DB)
//   createdAt: MessageRow["created_at"];
//   updatedAt: MessageRow["updated_at"];
//   content: MessageRow["content"];
//   roomId: MessageRow["room_id"];
//   isDeleted: MessageRow["is_deleted"];
//   user: {
//     // Assuming user details like name are fetched separately
//     id: NonNullable<MessageRow["user_id"]>; // User ID from the message row (non-nullable assuming we only show messages from logged-in users?)
//     name: string; // User name needs to be fetched/joined
//   };
// };

export default async function RoomPage({ params }: RoomPageProps) {
  const supabase = await createClient();
  const { roomId } = await params;

  // 1. Use getUser() for authenticated check and fresh user data
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    console.error("User fetch error or no user on room page:", userError);
    redirect(`/login?redirect=/rooms/${roomId}`); // Redirect to login if no user
  }

  const userId = user.id;

  // 2. Fetch Room Data
  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .select("id, name, created_by")
    .eq("id", roomId)
    .single();

  // Add loading/error state check for room data
  if (roomError) {
    // Log the error but maybe don't redirect, show an error message?
    console.error("Error fetching room data:", roomError);
    // For now, let's prevent rendering the chat if room data fails
    // You might want a more user-friendly error display here
    return (
      <div className="container mx-auto p-4 text-red-500">
        Error loading room details.
      </div>
    );
  }

  if (!room) {
    // Room not found or RLS prevents access
    notFound();
  }

  // 3. Fetch User Role in this Room (Removed as role is not currently used)
  // const { data: member, error: memberError } = await supabase
  //   .from("room_members")
  //   .select("role")
  //   .eq("room_id", roomId)
  //   .eq("user_id", userId)
  //   .maybeSingle();
  //
  // if (memberError) {
  //   console.error(
  //     "Error fetching room member role:",
  //     JSON.stringify(memberError, null, 2)
  //   );
  // }
  //
  // const userRole = member?.role; // Removed unused variable
  // const isDJ = userRole === "DJ"; // Removed unused variable

  // Extract username for chat component, provide fallback using validated user object
  const username =
    user.user_metadata?.display_name || user.email || "Unknown User";

  // 4. Fetch Initial Messages (Step 1)
  const { data: initialDbMessages, error: messagesError } = await supabase
    .from("messages")
    .select(
      `
      id,
      created_at,
      updated_at,
      content,
      room_id,
      is_deleted,
      user_id
    `
    ) // Select only message fields first
    .eq("room_id", roomId)
    .order("created_at", { ascending: true });

  if (messagesError) {
    console.error("Error fetching initial messages:", messagesError);
    // Handle error appropriately
  }

  // 5. Fetch Profiles for Message Authors (Step 2)
  const userProfiles: Map<string, { name: string; avatarUrl?: string }> =
    new Map();
  if (initialDbMessages && initialDbMessages.length > 0) {
    const userIds = [...new Set(initialDbMessages.map((msg) => msg.user_id))];
    const { data: profilesData, error: profilesError } = await supabase
      .from("profiles")
      .select("id, display_name, avatar_url")
      .in("id", userIds);

    if (profilesError) {
      console.error(
        "Error fetching user profiles for messages:",
        profilesError
      );
      // Proceed without names, or handle error
    } else {
      profilesData.forEach((profile) => {
        userProfiles.set(profile.id, {
          name: profile.display_name || "Unknown User",
          avatarUrl: profile.avatar_url || undefined,
        });
      });
    }
  }

  // Format messages for the RealtimeChat component, merging profile data
  const initialMessages: ChatMessage[] = initialDbMessages
    ? initialDbMessages.map((msg) => ({
        id: msg.id.toString(),
        createdAt: msg.created_at,
        updatedAt: msg.updated_at,
        content: msg.content,
        roomId: msg.room_id,
        isDeleted: msg.is_deleted,
        user: {
          id: msg.user_id,
          name: userProfiles.get(msg.user_id)?.name || "Unknown User",
          avatarUrl: userProfiles.get(msg.user_id)?.avatarUrl,
        },
      }))
    : [];

  // We have confirmed user and room exist by this point
  const currentUserId = userId;

  return (
    // Apply flex column layout and min screen height to the main container
    <div className="mx-auto flex flex-col relative z-20 h-screen">
      <NavProtected>
        <PlayerTrigger />
      </NavProtected>

      {/* Gradient Overlay: Starts from the bottom of NavProtected and fades down */}
      <div
        className="absolute left-0 right-0 top-14
                   bg-gradient-to-b from-teal-dark to-transparent
                   h-24
                   z-40
                   pointer-events-none"
      />

      {/* RoomJoinHandler might also need room.id, ensure it's available */}
      {room && <RoomJoinHandler roomId={room.id} userId={userId} />}

      {/* Make the main content area grow and establish a flex context for the grid */}
      <main className="flex-grow pt-14 w-full">
        {/* Ensure the chat column takes full height */}
        {/* Conditionally render RealtimeChat only when room.id and currentUserId are valid */}
        {room?.id && currentUserId ? (
          <RealtimeChat
            key={room.id}
            roomId={room.id}
            username={username}
            userId={currentUserId}
            initialMessages={initialMessages} // Pass fetched messages
          />
        ) : (
          <div className="p-4 text-center text-muted-foreground">
            Loading Chat...
          </div>
        )}
      </main>
    </div>
  );
}
