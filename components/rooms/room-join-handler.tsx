"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
// Assuming database types are correctly set up for client-side usage if needed
// import { Database } from "@/lib/types/database.types";

type RoomJoinHandlerProps = {
  roomId: string;
  userId: string | undefined; // Passed from server component
};

export function RoomJoinHandler({ roomId, userId }: RoomJoinHandlerProps) {
  useEffect(() => {
    const joinRoomIfNeeded = async () => {
      if (!userId) {
        console.warn("RoomJoinHandler: userId not provided.");
        return;
      }
      if (!roomId) {
        console.warn("RoomJoinHandler: roomId not provided.");
        return;
      }

      const supabase = createClient(); // Client-side Supabase client

      try {
        // 1. Check if user is already a member
        const { data: existingMember, error: checkError } = await supabase
          .from("room_members")
          .select("user_id")
          .eq("room_id", roomId)
          .eq("user_id", userId)
          .maybeSingle(); // Use maybeSingle to handle 0 or 1 row

        if (checkError && checkError.code !== "PGRST116") {
          // PGRST116: "Searched for one row but found 0" - expected if not a member
          console.error("Error checking room membership:", checkError);
          return;
        }

        // 2. If not already a member, insert them
        if (!existingMember) {
          console.log(
            `User ${userId} not found in room ${roomId}. Attempting to join...`
          );
          const { error: insertError } = await supabase
            .from("room_members")
            .insert({
              room_id: roomId,
              user_id: userId,
              role: "member", // Assign the default 'member' role
            });

          if (insertError) {
            console.error("Error joining room:", insertError);
            // Potentially show a toast notification to the user here
          }
        }
      } catch (error) {
        console.error("Unexpected error in joinRoomIfNeeded:", error);
      }
    };

    joinRoomIfNeeded();
  }, [roomId, userId]); // Re-run if roomId or userId changes

  // This component does not render anything visual
  return null;
}
