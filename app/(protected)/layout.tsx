"use client";

import React from "react";
import { PlayerContextProvider } from "@/lib/contexts/player-context";
import { RoomContextProvider } from "@/lib/contexts/room-context";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PlayerContextProvider>
      <RoomContextProvider>
        <div className="flex min-h-screen flex-col relative">
          <div className="absolute top-0 left-0 w-full h-full z-0 noise" />
          <div className="absolute top-0 left-0 w-full h-full z-10 bg-linear-[170deg,_var(--teal-dark)_25%,_oklch(from_var(--seafoam-green)_l_c_h_/_0.4)_50%,_transparent_70%,_transparent_100%]" />
          <main className="flex-1">{children}</main>
        </div>
      </RoomContextProvider>
    </PlayerContextProvider>
  );
}
