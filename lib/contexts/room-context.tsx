"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
} from "react";
import { useParams } from "next/navigation";
import { getUserRoleInCurrentRoom } from "@/lib/actions/supabase.actions";
import { Database } from "@/lib/types/database.types";

type RoomRole = Database["public"]["Enums"]["room_role"];

interface RoomContextType {
  roomId: string | null;
  userRole: RoomRole | null;
  isLoadingRole: boolean;
}

const RoomContext = createContext<RoomContextType | undefined>(undefined);

export function RoomContextProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const [userRole, setUserRole] = useState<RoomRole | null>(null);
  const [isLoadingRole, setIsLoadingRole] = useState<boolean>(true);

  const rawRoomId = params?.roomId;
  const roomId = typeof rawRoomId === "string" ? rawRoomId : null;

  useEffect(() => {
    let isMounted = true;
    if (roomId) {
      setIsLoadingRole(true);
      getUserRoleInCurrentRoom(roomId)
        .then((role) => {
          if (isMounted) {
            setUserRole(role);
          }
        })
        .catch((error) => {
          console.error("Failed to fetch user role in room context:", error);
          if (isMounted) {
            setUserRole(null);
          }
        })
        .finally(() => {
          if (isMounted) {
            setIsLoadingRole(false);
          }
        });
    } else {
      setUserRole(null);
      setIsLoadingRole(false);
    }

    return () => {
      isMounted = false;
    };
  }, [roomId]);

  const value = useMemo(
    () => ({
      roomId,
      userRole,
      isLoadingRole,
    }),
    [roomId, userRole, isLoadingRole]
  );

  return <RoomContext.Provider value={value}>{children}</RoomContext.Provider>;
}

export function useRoomContext() {
  const context = useContext(RoomContext);
  if (context === undefined) {
    throw new Error("useRoomContext must be used within a RoomContextProvider");
  }
  return context;
}
