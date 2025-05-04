"use client";

import React from "react";
import { PlayerContextProvider } from "@/lib/contexts/player-context";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PlayerContextProvider>
      <div className="flex min-h-screen flex-col">
        <main className="flex-1">{children}</main>
      </div>
    </PlayerContextProvider>
  );
}
