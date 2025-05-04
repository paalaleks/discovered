"use client";

import React from "react";
import { Slider } from "@/components/ui/slider";
import { Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";

interface VerticalVolumeControlProps {
  value: number; // Current volume value (0-100)
  onVolumeChange: (value: number[]) => void; // Handler for slider change
  isMuted: boolean; // Current muted state
  onMuteToggle: () => void; // Handler for mute button click
  disabled?: boolean; // Optional disabled state
}

/**
 * Renders a controlled vertical volume slider control.
 */
export function VerticalVolumeControl({
  value,
  onVolumeChange,
  isMuted,
  onMuteToggle,
  disabled = false, // Default disabled to false
}: VerticalVolumeControlProps) {
  // Removed internal state: volume, isMuted
  // Removed internal handler: handleMuteToggle

  const handleSliderChange = (sliderValue: number[]) => {
    onVolumeChange(sliderValue);
    // The logic to set isMuted based on volume is now handled in the parent (PlayerPopover)
  };

  const VolumeIcon = isMuted || value === 0 ? VolumeX : Volume2;

  return (
    <div className="flex flex-col items-center py-4 px-2 bg-popover border rounded-md shadow-lg">
      {/* Vertical Slider */}
      <Slider
        value={[value]} // Controlled component using passed value
        onValueChange={handleSliderChange} // Use passed handler
        max={100}
        step={1}
        orientation="vertical"
        className="w-2 h-24 data-[orientation=vertical]:w-2 mb-3" // Adjusted size & margin
        aria-label="Volume"
        disabled={disabled} // Use passed disabled state
      />
      {/* Mute Button below slider */}
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        title={isMuted ? "Unmute" : "Mute"}
        onClick={onMuteToggle} // Use passed handler
        disabled={disabled} // Use passed disabled state
      >
        <VolumeIcon className="h-4 w-4" />
      </Button>
    </div>
  );
}
