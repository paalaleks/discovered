"use server";

// This file will contain Server Actions related to rooms.

export {}; // Add empty export for module treatment

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Database } from "@/lib/types/database.types";
import {
  PlaylistInputSchema,
  extractSpotifyPlaylistId,
  SimplePlaylistDetails,
} from "@/lib/types/index";
import {
  getPlaylistDetails,
  SpotifyPlaylist,
} from "@/lib/actions/spotify.actions";

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

// Define the state structure returned by the action
// Used for prevState in the action and useFormState hook
type AddPlaylistActionResult = {
  message: string;
  error: boolean;
  errors?: {
      roomId?: string[];
      playlistInput?: string[];
  };
};

// --- Add Playlist Action ---

// Remove unused ActionResult type
// type ActionResult = { success: true } | { success: false; error: string };

// Update prevState type annotation
export async function addPlaylistToRoom(prevState: AddPlaylistActionResult | null, formData: FormData): Promise<AddPlaylistActionResult> {
  const supabase = await createClient();

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return { message: "User not authenticated.", error: true };
  }

  const validatedFields = PlaylistInputSchema.safeParse({
    roomId: formData.get("roomId"),
    playlistInput: formData.get("playlistInput"),
  });

  if (!validatedFields.success) {
    console.error("Validation errors:", validatedFields.error.flatten().fieldErrors);
    return {
      message: "Invalid input.",
      errors: validatedFields.error.flatten().fieldErrors,
      error: true,
    };
  }

  const { roomId, playlistInput } = validatedFields.data;
  const userId = userData.user.id;

  // 1. Verify User Role (Check if DJ)
  try {
    const { data: roleData, error: roleError } = await supabase.rpc(
      "get_user_role_in_room",
      { p_user_id: userId, p_room_id: roomId }
    );

    if (roleError) {
      console.error(`Error checking user role for room ${roomId}:`, roleError);
      return { message: "Error checking permissions.", error: true };
    }

    // ---- Safely check roleData ----
    const userRole = roleData && Array.isArray(roleData) && roleData.length > 0 ? roleData[0]?.role : null;

    if (userRole !== "dj") {
      console.warn(`User ${userId} is not a DJ in room ${roomId}. Role: ${userRole}`);
      return { message: "Only DJs can add playlists.", error: true };
    }
     console.log(`User ${userId} confirmed as DJ in room ${roomId}`);

  } catch (e) {
      console.error("Unexpected error during role check:", e);
      return { message: "Error verifying user role.", error: true };
  }

  // 2. Extract and Verify Spotify Playlist ID
  const spotifyPlaylistId = extractSpotifyPlaylistId(playlistInput);
  if (!spotifyPlaylistId) {
    return { message: "Invalid Spotify Playlist ID or URL format.", error: true };
  }

  // 3. Verify Playlist Exists via Spotify API
  const playlistDetails = await getPlaylistDetails(spotifyPlaylistId);
  if (!playlistDetails) {
    return { message: "Could not find playlist on Spotify or verify its details.", error: true };
  }
  const playlistName = playlistDetails.name; // Get name from Spotify details

  // 4. Insert into database
  try {
    const { error: insertError } = await supabase
      .from("room_playlists")
      .insert({
        room_id: roomId,
        spotify_playlist_id: spotifyPlaylistId,
        added_by: userId,
        name: playlistName, // Store the name fetched from Spotify
      });

    if (insertError) {
      console.error("Error inserting playlist into DB:", insertError);
      // Handle potential unique constraint violation (playlist already added)
      if (insertError.code === "23505") { // Postgres unique violation code
        return { message: "This playlist has already been added to the room.", error: true };
      }
      return { message: "Failed to add playlist to the room.", error: true };
    }

     console.log(`Playlist ${spotifyPlaylistId} (${playlistName}) added successfully to room ${roomId} by user ${userId}`);
    revalidatePath(`/rooms/${roomId}`); // Revalidate room page
    return { message: `Playlist '${playlistName}' added successfully!`, error: false };

  } catch (error) {
      console.error("Unexpected error during DB insertion:", error);
      return { message: "An unexpected error occurred while adding the playlist.", error: true };
  }
}

// --- BEGIN NEW SERVER ACTION ---
/**
 * Server Action to get the current authenticated user's role in a specific room.
 * @param roomId The ID of the room to check.
 * @returns The user's role ('DJ', 'member') or null if not a member or error.
 */
export async function getUserRoleInCurrentRoom(
  roomId: string
): Promise<Database["public"]["Enums"]["room_role"] | null> {
  if (!roomId) return null;

  try {
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData?.user) {
      console.error("Get Role Action Error: User not authenticated.", userError);
      return null;
    }
    const userId = userData.user.id;

    // Option 1: Use the RPC function (if it correctly returns null when not found)
    // const { data: roleData, error: rpcError } = await supabase.rpc(
    //   "get_user_role_in_room",
    //   {
    //     room_uuid: roomId,
    //     user_uuid: userId,
    //   }
    // );
    // if (rpcError) {
    //   console.error(`Get Role Action Error: RPC failed for room ${roomId}`, rpcError);
    //   return null;
    // }
    // return roleData as Database["public"]["Enums"]["room_role"] | null;

    // Option 2: Direct query (potentially clearer for null handling)
    const { data, error } = await supabase
      .from("room_members")
      .select("role")
      .eq("room_id", roomId)
      .eq("user_id", userId)
      .maybeSingle(); // Use maybeSingle to return null if not found

    if (error) {
      console.error(
        `Get Role Action Error: Failed to query role for user ${userId} in room ${roomId}`,
        error
      );
      return null;
    }

    return data?.role ?? null; // Return the role or null if no record found
  } catch (error) {
    console.error(
      `Get Role Action Error: Unexpected error for room ${roomId}`,
      error
    );
    return null;
  }
}
// --- END NEW SERVER ACTION ---

// --- END Add Playlist Action ---

// --- BEGIN Get Room Playlist Details Action ---

/**
 * Fetches details for all playlists associated with a room.
 * Combines basic info from DB with details from Spotify API.
 */
export async function getRoomPlaylistDetails(
  roomId: string
): Promise<SimplePlaylistDetails[] | null> {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) {
    console.error(
      "LOG: getRoomPlaylistDetails - User not authenticated",
      userError
    );
    return null;
  }

  try {
    // 1. Fetch playlist IDs and names from your database
    const { data: roomPlaylists, error: dbError } = await supabase
      .from("room_playlists")
      .select("id, spotify_playlist_id, name")
      .eq("room_id", roomId);

    // Log DB query result
    if (dbError) {
      console.error(
        `LOG: getRoomPlaylistDetails - DB Error fetching playlists:`,
        dbError
      );
      return null;
    }

    if (!roomPlaylists || roomPlaylists.length === 0) {
      console.log(
        `LOG: getRoomPlaylistDetails - No playlists found in DB for room ${roomId}.`
      );
      return [];
    }

    // Define type for DB result explicitly
    type RoomPlaylistRecord = {
      id: string;
      spotify_playlist_id: string;
      name: string | null;
    };

    const dbPlaylistRecords = roomPlaylists as RoomPlaylistRecord[];

    // 2. Fetch details for each playlist from Spotify API
    let loggedFirstApiCall = false; // Flag to log only first API call attempt
    const playlistDetailsPromises = dbPlaylistRecords.map(
      async (playlist: RoomPlaylistRecord) => {
        if (!loggedFirstApiCall) {
          console.log(
            `LOG: getRoomPlaylistDetails - Calling Spotify API getPlaylistDetails for ID: ${playlist.spotify_playlist_id}`
          );
          loggedFirstApiCall = true;
        }
        const spotifyDetails: SpotifyPlaylist | null = await getPlaylistDetails(
          playlist.spotify_playlist_id
        );
        // Log first Spotify API result
        // if (loggedFirstApiCall && !loggedFirstApiResult) { // This logic is a bit complex, maybe simpler log later
        //     console.log(`LOG: getRoomPlaylistDetails - Spotify API Result for ${playlist.spotify_playlist_id}:`, spotifyDetails);
        //     loggedFirstApiResult = true;
        // }

        // 3. Combine DB data and Spotify data, mapping fields correctly
        if (spotifyDetails) {
          return {
            spotify_playlist_id: playlist.spotify_playlist_id,
            name: playlist.name ?? spotifyDetails.name,
            owner: spotifyDetails.owner?.display_name,
            images: spotifyDetails.images,
            uri: spotifyDetails.uri,
          } as SimplePlaylistDetails;
        } else {
          console.warn(
            `LOG: getRoomPlaylistDetails - Failed to get Spotify details for ID: ${playlist.spotify_playlist_id}`
          ); // Log Spotify failures
          return {
            spotify_playlist_id: playlist.spotify_playlist_id,
            name: playlist.name ?? "Playlist not found",
            owner: "Unknown",
            images: [],
            uri: undefined,
          } as SimplePlaylistDetails;
        }
      }
    );

    const combinedDetails = await Promise.all(playlistDetailsPromises);

    return combinedDetails;
  } catch (error) {
    console.error(
      `LOG: getRoomPlaylistDetails - Unexpected error for room ${roomId}:`,
      error
    );
    return null;
  }
}

// --- END Get Room Playlist Details Action ---
