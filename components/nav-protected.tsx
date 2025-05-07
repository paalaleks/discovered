"use client";

import Link from "next/link";
import { CurrentUserAvatar } from "./current-user-avatar";
import { LogoutButton } from "./logout-button";
import { Suspense } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "./ui/button";
/**
 * Renders the navigation header specific to the rooms section.
 * Includes user avatar popover with logout and conditional playlist adding.
 */
export function NavProtected({ children }: { children?: React.ReactNode }) {
  return (
    <nav className="absolute top-0 z-50 w-full px-4 sm:px-8">
      <div className="flex h-14 items-center">
        <div className="mr-4 hidden md:flex">
          <Link href="/rooms" className="mr-6 flex items-center space-x-2">
            <span className="hidden font-bold sm:inline-block">
              PlaylistRooms
            </span>
          </Link>
        </div>
        <div className="flex flex-1 items-center space-x-2 justify-end">
          <nav className="flex items-center space-x-2">
            {children}
            <Suspense
              fallback={<div className="h-8 w-8 rounded-full bg-muted" />}
            >
              <Popover>
                <PopoverTrigger asChild>
                  <button className="relative flex h-8 w-8 items-center justify-center rounded-full transition-all duration-300 ease-in-out hover:ring-2 hover:ring-primary hover:ring-offset-2 data-[state=open]:ring-2 data-[state=open]:ring-ring data-[state=open]:ring-offset-2 data-[state=open]:ring-offset-background">
                    <CurrentUserAvatar />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-56" align="end" forceMount>
                  <div className="flex flex-col gap-2">
                    <Button variant="ghost" asChild>
                      <Link href="/my-profile">My profile</Link>
                    </Button>
                    <Button variant="ghost" asChild>
                      <Link href="/rooms">Music Rooms</Link>
                    </Button>

                    <Suspense fallback={null}>
                      <LogoutButton />
                    </Suspense>
                  </div>
                </PopoverContent>
              </Popover>
            </Suspense>
          </nav>
        </div>
      </div>
    </nav>
  );
}
