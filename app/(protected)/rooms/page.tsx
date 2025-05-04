import Link from "next/link";
import { CreateRoomForm } from "@/components/rooms/create-room-form";
import { Toaster } from "@/components/ui/sonner";
import { getUserRooms } from "./actions"; // Import the new server action
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { User } from "@supabase/supabase-js"; // Import the User type
import { CopyInviteButton } from "@/components/rooms/copy-invite-button"; // Import the button

// This page is within the (protected) group, so authentication is assumed
// to be handled by middleware.

// Define a type for the room data returned by the server action
type RoomSummary = {
  id: string;
  name: string | null;
  created_by: string;
};

// Make the component async to fetch data
export default async function RoomsPage() {
  // Use the imported User type
  const {
    rooms,
    user,
  }: { rooms: RoomSummary[]; user: User | null } = // Use User | null
    await getUserRooms();

  if (!user) {
    // This case should ideally be handled by middleware, but good to check
    return (
      <div className="container mx-auto p-4 text-center text-destructive">
        Error: User not authenticated.
      </div>
    );
  }

  const userId = user.id;
  // Use the RoomSummary type in the callback
  const userOwnsARoom = rooms.some(
    (room: RoomSummary) => room.created_by === userId
  );

  return (
    <div className="container mx-auto p-4">
      <main className="flex flex-col items-center gap-8 pt-10">
        {/* Conditionally render Create Room Form */}
        {!userOwnsARoom ? (
          <div className="w-full max-w-md">
            <h2 className="text-xl font-semibold mb-4 text-center">
              Create a New Room
            </h2>
            <p className="text-sm text-muted-foreground text-center mb-4">
              You can only create one room.
            </p>
            <CreateRoomForm />
          </div>
        ) : (
          <div className="w-full max-w-md text-center p-4 bg-muted rounded-lg">
            <p className="text-muted-foreground">
              You have already created your room.
            </p>
          </div>
        )}

        {/* List existing rooms user is part of */}
        <div className="w-full max-w-2xl mt-10">
          <h3 className="text-lg font-semibold mb-4 text-center">Your Rooms</h3>
          {rooms.length > 0 ? (
            <div className="space-y-4">
              {rooms.map((room: RoomSummary) => {
                // Determine if the current user is the DJ for this room
                const isDJ = room.created_by === userId;
                return (
                  <Card key={room.id}>
                    <CardHeader>
                      <CardTitle>
                        {room.name || `Room ${room.id.substring(0, 8)}...`}
                      </CardTitle>
                      {isDJ && (
                        <CardDescription>You are the DJ</CardDescription>
                      )}
                    </CardHeader>
                    <CardFooter className="flex justify-between items-center">
                      <Link href={`/rooms/${room.id}`} passHref>
                        <Button variant="outline">Enter Room</Button>
                      </Link>
                      {/* Use the CopyInviteButton component */}
                      <CopyInviteButton roomId={room.id} isDJ={isDJ} />
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          ) : (
            <p className="text-center text-muted-foreground">
              You are not a member of any rooms yet.
              {!userOwnsARoom && " Why not create one?"}
            </p>
          )}
        </div>
      </main>
      {/* Toaster might be needed here if not global */}
      <Toaster />
    </div>
  );
}
