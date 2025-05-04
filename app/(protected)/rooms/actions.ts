"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
// import { Database } from "@/lib/types/database.types"; // Commented out until generated

// Schema for room creation input
const CreateRoomSchema = z.object({
  // Room name is now optional
  roomName: z.string().optional(),
  // Require at least one Spotify playlist URL/ID
  playlistUrl: z.string().min(1, "Spotify playlist URL/ID is required"),
});

// Type for the result of createRoom action
export type CreateRoomResult = {
  success: boolean;
  message: string;
  roomId?: string;
  error?: string | null; // For form-level errors
  fieldErrors?: {
    roomName?: string[];
    playlistUrl?: string[];
  };
};

export async function createRoom(
  prevState: CreateRoomResult | undefined,
  formData: FormData
): Promise<CreateRoomResult> {
  // Await the client creation
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    // This should ideally not happen if middleware is set up correctly
    // but good practice to check.
    console.error("Authentication error:", authError);
    // Redirecting might be better if this state is reachable unauthorized
    // redirect("/auth/login");
    // Or return an error state for the form
    return {
      success: false,
      message: "Authentication required.",
      error: "User not authenticated.",
    };
  }

  const userId = user.id;

  // Check if the user already owns a room
  const { data: existingRoom, error: checkError } = await supabase
    .from("rooms")
    .select("id")
    .eq("created_by", userId)
    .maybeSingle();

  if (checkError) {
    console.error("Error checking for existing room:", checkError);
    return {
      success: false,
      message: "Failed to check for existing rooms.",
      error: "Database error during pre-check.",
    };
  }

  if (existingRoom) {
    return {
      success: false,
      message: "Room creation failed.",
      error: "You can only create one room.", // Specific error for the user
    };
  }

  const rawFormData = {
    roomName: formData.get("roomName") as string,
    playlistUrl: formData.get("playlistUrl") as string,
  };

  // Validate form data
  const validatedFields = CreateRoomSchema.safeParse(rawFormData);

  if (!validatedFields.success) {
    console.log(
      "Validation errors:",
      validatedFields.error.flatten().fieldErrors
    );
    return {
      success: false,
      message: "Validation failed.",
      fieldErrors: validatedFields.error.flatten().fieldErrors,
    };
  }

  const { roomName, playlistUrl } = validatedFields.data;

  // Prepare data for insertion
  const roomData = {
    name: roomName || null, // Use null if name is empty/undefined
    created_by: userId,
    initial_playlist_url: playlistUrl, // Store the initial playlist URL/ID
  };

  // Insert into 'rooms' table
  const { data: newRoom, error: roomInsertError } = await supabase
    .from("rooms")
    .insert(roomData)
    .select("id")
    .single();

  if (roomInsertError || !newRoom) {
    console.error("Error inserting room:", roomInsertError);
    return {
      success: false,
      message: "Failed to create room.",
      error: "Database error during room creation.",
    };
  }

  const newRoomId = newRoom.id;

  // Insert into 'room_members' table to assign the creator as DJ
  const { error: memberInsertError } = await supabase
    .from("room_members")
    .insert({
      room_id: newRoomId,
      user_id: userId,
      role: "DJ", // Assign 'DJ' role
    });

  if (memberInsertError) {
    console.error("Error inserting room member (DJ):", memberInsertError);
    // Consider cleanup: delete the room if adding the member fails?
    // For now, log the error and return failure.
    return {
      success: false,
      message: "Failed to assign DJ role.",
      error: "Database error during member creation.",
    };
  }

  // Revalidate the path to update the room list if displayed on the same page
  revalidatePath("/rooms");

  // Redirect to the newly created room page upon success
  // The redirect needs to be outside the try/catch or handled carefully
  // It throws an error which is caught by Next.js to perform the redirect.
  // We signal success before the redirect.
  // The redirect itself will handle navigation.
  redirect(`/rooms/${newRoomId}`);

  // Note: Code execution stops here due to redirect.
  // Return statement below is technically unreachable but satisfies TypeScript.
  // return { success: true, message: "Room created successfully!", roomId: newRoomId };
}

// --- BEGIN NEW SERVER ACTION ---
export async function getUserRooms() {
  // Await the client creation
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { rooms: [], user: null }; // Return empty if no user
  }

  // 1. Get the room IDs the user is a member of
  const { data: memberEntries, error: memberError } = await supabase
    .from("room_members")
    .select("room_id")
    .eq("user_id", user.id);

  if (memberError) {
    console.error("Error fetching room memberships:", memberError);
    return { rooms: [], user }; // Return empty on error
  }

  if (!memberEntries || memberEntries.length === 0) {
    return { rooms: [], user }; // Return empty if user is not in any rooms
  }

  const roomIds = memberEntries.map(
    (entry: { room_id: string }) => entry.room_id
  );

  // 2. Get the details for those rooms
  const { data: roomsData, error: roomsError } = await supabase
    .from("rooms")
    .select("id, name, created_by") // Select necessary room details
    .in("id", roomIds);

  if (roomsError) {
    console.error("Error fetching room details:", roomsError);
    return { rooms: [], user }; // Return empty on error
  }

  return { rooms: roomsData || [], user };
}
// --- END NEW SERVER ACTION ---
