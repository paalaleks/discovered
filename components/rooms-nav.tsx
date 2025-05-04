"use client";

import Link from "next/link";
import { CurrentUserAvatar } from "./current-user-avatar";
import { LogoutButton } from "./logout-button";
import { Suspense, useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useRoomContext } from "@/lib/contexts/room-context";
import { AddPlaylistForm } from "./add-playlist-form";
import { Loader2, PlusCircle, Music2 } from "lucide-react";
import PlayerPopover from "./player-popover";
import { Button } from "@/components/ui/button";
import { usePlayerContext } from "@/lib/contexts/player-context";

/**
 * Renders the navigation header specific to the rooms section.
 * Includes user avatar popover with logout and conditional playlist adding.
 */
export function RoomsNav() {
  const { isPlayerReady } = usePlayerContext();
  const { roomId, userRole, isLoadingRole } = useRoomContext();
  const [isAddPlaylistDialogOpen, setIsAddPlaylistDialogOpen] = useState(false);
  const isDJ = !isLoadingRole && userRole === "DJ" && roomId;
  const closeDialog = () => setIsAddPlaylistDialogOpen(false);

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 sm:px-8">
      <div className="container flex h-14 max-w-screen-2xl items-center">
        <div className="mr-4 hidden md:flex">
          <Link href="/rooms" className="mr-6 flex items-center space-x-2">
            <span className="hidden font-bold sm:inline-block">
              PlaylistRooms
            </span>
          </Link>
        </div>
        <div className="flex flex-1 items-center space-x-2 justify-end">
          <nav className="flex items-center space-x-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  title="Open Player"
                  disabled={!isPlayerReady}
                >
                  <Music2 className="h-5 w-5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <PlayerPopover />
              </PopoverContent>
            </Popover>

            <Suspense
              fallback={<div className="h-8 w-8 rounded-full bg-muted" />}
            >
              <Dialog
                open={isAddPlaylistDialogOpen}
                onOpenChange={setIsAddPlaylistDialogOpen}
              >
                <Popover>
                  <PopoverTrigger asChild>
                    <button className="relative flex h-8 w-8 items-center justify-center rounded-full transition-all duration-300 ease-in-out hover:ring-2 hover:ring-primary hover:ring-offset-2 data-[state=open]:ring-2 data-[state=open]:ring-ring data-[state=open]:ring-offset-2 data-[state=open]:ring-offset-background">
                      <CurrentUserAvatar />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-56 p-2" align="end" forceMount>
                    {isLoadingRole ? (
                      <button
                        className="relative flex cursor-not-allowed select-none items-center rounded-sm px-2 py-1.5 text-sm opacity-50 outline-none w-full"
                        disabled
                      >
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Checking Role...
                      </button>
                    ) : isDJ ? (
                      <DialogTrigger asChild>
                        <button className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 w-full text-left hover:bg-accent">
                          <PlusCircle className="mr-2 h-4 w-4" />
                          Add Playlist
                        </button>
                      </DialogTrigger>
                    ) : null}

                    <Suspense fallback={null}>
                      <LogoutButton />
                    </Suspense>
                  </PopoverContent>
                </Popover>

                {isDJ && (
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Spotify Playlist</DialogTitle>
                      <DialogDescription>
                        Enter the Spotify Playlist ID or URL to add it to this
                        room.
                      </DialogDescription>
                    </DialogHeader>
                    <AddPlaylistForm
                      roomId={roomId!}
                      onFormSuccess={closeDialog}
                    />
                  </DialogContent>
                )}
              </Dialog>
            </Suspense>
          </nav>
        </div>
      </div>
    </nav>
  );
}
