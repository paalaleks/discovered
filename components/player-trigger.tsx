"use client";

import React from "react";
import { PopoverContent, PopoverTrigger } from "./ui/popover";
import { Popover } from "./ui/popover";
import { Button } from "./ui/button";
import { Music2 } from "lucide-react";
import PlayerPopover from "./player-popover";
import { usePlayerContext } from "@/lib/contexts/player-context";

export default function PlayerTrigger() {
  const { isPlayerReady } = usePlayerContext();
  return (
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
      <PopoverContent className="w-80 p-0 overflow-hidden" align="end">
        <PlayerPopover />
      </PopoverContent>
    </Popover>
  );
}
