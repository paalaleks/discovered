import { RoomsNav } from "@/components/rooms-nav";
import { RoomContextProvider } from "@/lib/contexts/room-context";
import React from "react";

export default function RoomsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RoomContextProvider>
      <div>
        <RoomsNav />
        {children}
      </div>
    </RoomContextProvider>
  );
}
