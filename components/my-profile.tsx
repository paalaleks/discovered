"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useRoomContext } from "@/lib/contexts/room-context";
import { AddPlaylistForm } from "./add-playlist-form";
import { PlusCircle } from "lucide-react";

export function MyProfile() {
  const { roomId } = useRoomContext();
  const [isAddPlaylistDialogOpen, setIsAddPlaylistDialogOpen] = useState(false);
  const closeDialog = () => setIsAddPlaylistDialogOpen(false);

  return (
    <div>
      <h2>My Profile</h2>
      {/* Placeholder for other profile info */}

      <Dialog
        open={isAddPlaylistDialogOpen}
        onOpenChange={setIsAddPlaylistDialogOpen}
      >
        <DialogTrigger asChild>
          <Button>
            <PlusCircle className="mr-2 h-4 w-4" /> Add Playlist
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Spotify Playlist</DialogTitle>
            <DialogDescription>
              Enter the Spotify Playlist ID or URL to add it to this room.
            </DialogDescription>
          </DialogHeader>
          <AddPlaylistForm roomId={roomId!} onFormSuccess={closeDialog} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
