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

/**
 * Renders the main header navigation for the application.
 * Uses Suspense to handle loading states of user-specific components.
 */
export function Nav() {
  return (
    <nav className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 sm:px-8">
      <div className="container flex h-14 max-w-screen-2xl items-center">
        <div className="mr-4 hidden md:flex">
          <Link href="/" className="mr-6 flex items-center space-x-2">
            {/* <Icons.logo className="h-6 w-6" /> */}
            <span className="hidden font-bold sm:inline-block">
              PlaylistRooms
            </span>
          </Link>
          {/* Add other nav links here if needed */}
        </div>
        <div className="flex flex-1 items-center space-x-2 justify-end">
          <nav className="flex items-center space-x-2">
            {/* Suspense is important here to prevent layout shifts or errors 
                if auth state takes time to resolve on initial load */}
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
                  {/* Add User Profile Info or other links here later */}
                  <Suspense fallback={null}>
                    <LogoutButton />
                  </Suspense>
                </PopoverContent>
              </Popover>
            </Suspense>
          </nav>
        </div>
      </div>
    </nav>
  );
}
