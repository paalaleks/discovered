"use client";

import { useState, useEffect } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Music,
  Shuffle,
  ListMusic,
  Loader2,
  Heart,
  Plus,
  Check,
} from "lucide-react";
import { VerticalVolumeControl } from "./vertical-volume-control";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { usePlayerContext } from "@/lib/contexts/player-context";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";
import { SimplePlaylistDetails } from "@/lib/types/index";

// Remove props interface
// interface PlayerPopoverProps {
//   player: Spotify.Player | null;
//   isReady: boolean;
//   isActive: boolean;
//   currentTrack: Spotify.Track | null;
//   playbackState: Spotify.PlaybackState | null;
// }

// Remove props from function signature
export default function PlayerPopover() {
  const {
    player,
    isPlayerReady,
    isPlayerActive,
    currentTrack,
    playbackState,
    roomPlaylists,
    currentPlaylistIndex,
    isLoadingPlaylists,
    playerDeviceId,
    isChangingPlaylist,
    isTogglingShuffle,
    playNextPlaylist,
    playPreviousPlaylist,
    togglePlayerShuffle,
    togglePlayPause,
    skipToNextTrack,
    skipToPreviousTrack,
    isSavingTrack,
    isFollowingPlaylist,
    isCurrentTrackSaved,
    isCurrentPlaylistFollowed,
    saveCurrentTrack,
    followCurrentPlaylist,
  } = usePlayerContext();

  // Local UI state derived from playbackState or for controls
  const [volume, setVolume] = useState(50); // Local volume 0-100 for slider
  const [isMuted, setIsMuted] = useState(false);
  const [position, setPosition] = useState(0); // Track position in ms
  const [duration, setDuration] = useState(0); // Track duration in ms

  const [isVolumePopoverOpen, setIsVolumePopoverOpen] = useState(false);

  // Keep local shuffle state for immediate UI feedback, synced from context
  const [isShuffleActive, setIsShuffleActive] = useState(false);

  // Sync local state from context playbackState
  useEffect(() => {
    if (!playbackState) {
      // Reset local state derived from playbackState
      setPosition(0);
      setDuration(0);
      setIsShuffleActive(false); // Reset shuffle state too
      return;
    }
    // Don't sync isPlaying locally, use isPlayingDerived
    setPosition(playbackState.position);
    setDuration(playbackState.duration);
    // Sync local shuffle state from context
    setIsShuffleActive(playbackState.shuffle ?? false);
  }, [playbackState]);

  // Handlers now use `player` from context
  // const handleTogglePlay = () => {
  //   if (!player) return;
  //   player.togglePlay();
  // };

  const handleVolumeChange = (value: number[]) => {
    const newVolume = value[0];
    const sdkVolume = newVolume / 100;
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
    if (!player) {
      return;
    }
    player.setVolume(sdkVolume).catch((err) => {
      console.error("Error setting volume:", err);
    });
  };

  const handleToggleMute = () => {
    const newMuteState = !isMuted;
    const restoreVolume = 50;
    const newVolumePercent = newMuteState
      ? 0
      : volume > 0
      ? volume
      : restoreVolume;
    const newSdkVolume = newVolumePercent / 100;

    setIsMuted(newMuteState);
    setVolume(newVolumePercent);
    if (!player) {
      return;
    }
    player.setVolume(newSdkVolume).catch((err) => {
      console.error("Error toggling mute:", err);
    });
  };

  // --- UI Logic ---
  const VolumeIcon = isMuted ? VolumeX : Volume2;
  const currentPositionStr = formatDuration(position);
  const totalDurationStr = formatDuration(duration);
  const progressPercent = duration > 0 ? (position / duration) * 100 : 0;

  // Use currentTrack from context for track details
  const trackName = currentTrack?.name ?? "Track Name Placeholder";
  const artistName =
    currentTrack?.artists[0]?.name ?? "Artist Name Placeholder";
  const imageUrl = currentTrack?.album?.images[0]?.url;

  // Derived state for the current playlist object
  const currentPlaylist: SimplePlaylistDetails | null =
    !isLoadingPlaylists &&
    roomPlaylists.length > 0 &&
    currentPlaylistIndex !== null
      ? roomPlaylists[currentPlaylistIndex]
      : null;

  // Use the derived currentPlaylist object for playlist details
  const currentPlaylistName = currentPlaylist?.name ?? "Playlist Name";
  // Potential future use: const currentPlaylistImageUrl = currentPlaylist?.images?.[0]?.url;

  const canGoNextPlaylist = currentPlaylistIndex < roomPlaylists.length - 1;
  const canGoPrevPlaylist = currentPlaylistIndex > 0;

  const isPlayingDerived = playbackState ? !playbackState.paused : false;

  return (
    <div className="grid gap-4 w-80 p-4">
      {/* Status Indicator uses isPlayerReady, isPlayerActive from context */}
      <div className="flex items-center justify-center text-xs text-muted-foreground mb-2">
        {isPlayerReady ? (
          isPlayerActive ? (
            <span className="text-green-500 flex items-center gap-1">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              Player Active
            </span>
          ) : (
            <span className="text-blue-500 flex items-center gap-1">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              Player Ready (Inactive)
            </span>
          )
        ) : (
          <span className="text-yellow-500 flex items-center gap-1">
            <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
            Connecting Player...
          </span>
        )}
      </div>

      {/* Now Playing uses currentTrack from context and currentPlaylistName */}
      <div className="flex items-center gap-4 mb-4">
        <Avatar className="h-16 w-16 rounded">
          <AvatarImage src={imageUrl} alt={trackName} />
          <AvatarFallback className="rounded bg-muted">
            <Music className="h-8 w-8 text-muted-foreground" />
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate" title={trackName}>
            {trackName}
          </p>
          <p
            className="text-xs text-muted-foreground truncate"
            title={artistName}
          >
            {artistName}
          </p>
          <p
            className="text-xs text-muted-foreground truncate flex items-center gap-1"
            title={currentPlaylistName}
          >
            <ListMusic className="h-3 w-3" />
            {isLoadingPlaylists ? "Loading..." : currentPlaylistName}
          </p>
        </div>
      </div>

      {/* Playback Controls use isPlayerReady, isPlayerActive from context */}
      <div className="flex items-center justify-center gap-2">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={`rounded-full ${
                  isShuffleActive ? "text-primary" : ""
                }`}
                onClick={togglePlayerShuffle}
                disabled={
                  !isPlayerReady || !isPlayerActive || isTogglingShuffle
                }
                title={isShuffleActive ? "Disable Shuffle" : "Enable Shuffle"}
              >
                {isTogglingShuffle ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Shuffle
                    className={`h-4 w-4 ${
                      isShuffleActive ? "text-primary" : ""
                    }`}
                  />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Toggle Shuffle ({isShuffleActive ? "On" : "Off"})</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full"
                onClick={skipToPreviousTrack}
                disabled={(() => {
                  const isDisabled =
                    !isPlayerReady ||
                    !isPlayerActive ||
                    !playbackState ||
                    playbackState?.disallows.skipping_prev;
                  return isDisabled;
                })()}
                title="Previous Track"
              >
                <SkipBack className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Previous track</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <Button
          variant="default"
          size="icon"
          className="rounded-full h-12 w-12"
          onClick={togglePlayPause}
          disabled={!isPlayerReady || !isPlayerActive || !playbackState}
        >
          {/* isPlaying is local state synced from context */}
          {isPlayingDerived ? (
            <Pause className="h-6 w-6 fill-current" />
          ) : (
            <Play className="h-6 w-6 fill-current" />
          )}
        </Button>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full"
                onClick={skipToNextTrack}
                disabled={
                  !isPlayerReady ||
                  !isPlayerActive ||
                  !playbackState ||
                  playbackState?.disallows.skipping_next
                }
                title="Next Track"
              >
                <SkipForward className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Next track</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={`rounded-full w-8 h-8 ${
                  isCurrentTrackSaved ? "text-green-500" : ""
                }`}
                onClick={saveCurrentTrack}
                disabled={!currentTrack || isSavingTrack}
                title={
                  isCurrentTrackSaved
                    ? "Saved to Liked Songs"
                    : "Save to Liked Songs"
                }
              >
                {isSavingTrack ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Heart
                    className={`h-4 w-4 ${
                      isCurrentTrackSaved ? "fill-green-500" : ""
                    }`}
                  />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{isCurrentTrackSaved ? "Saved" : "Save Song"}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Progress Bar uses local state synced from context */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground w-8 text-right">
          {currentPositionStr}
        </span>
        <Slider
          value={[progressPercent]} // Display progress, disable seeking
          max={100}
          step={1}
          className="flex-1 [&>span:first-child]:bg-primary"
          disabled={true} // Seeking not implemented
          aria-label="Track progress"
        />
        <span className="text-xs text-muted-foreground w-8 text-left">
          {totalDurationStr}
        </span>
      </div>

      {/* Volume & Playlist Navigation */}
      <div className="flex justify-between items-center mt-2">
        <Button
          variant="ghost"
          size="sm"
          className="text-xs px-2"
          onClick={playPreviousPlaylist}
          disabled={
            !isPlayerReady ||
            !playerDeviceId ||
            !canGoPrevPlaylist ||
            isChangingPlaylist
          }
          title="Previous Playlist"
        >
          {isChangingPlaylist ? (
            <Loader2 className="h-4 w-4 animate-spin mr-1" />
          ) : (
            <SkipBack className="h-4 w-4 mr-1" />
          )}
          Prev
        </Button>
        <div className="flex justify-center">
          <Popover
            open={isVolumePopoverOpen}
            onOpenChange={setIsVolumePopoverOpen}
          >
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full h-7 w-7"
                disabled={!isPlayerReady}
              >
                <VolumeIcon className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent
              side="top"
              align="center"
              className="w-auto p-0 border-none bg-transparent shadow-none"
              onInteractOutside={() => setIsVolumePopoverOpen(false)}
            >
              <VerticalVolumeControl
                value={volume} // Use local state
                onVolumeChange={handleVolumeChange}
                isMuted={isMuted} // Use local state
                onMuteToggle={handleToggleMute}
                disabled={!isPlayerReady}
              />
            </PopoverContent>
          </Popover>
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={`rounded-full h-7 w-7 ${
                  isCurrentPlaylistFollowed ? "text-green-500" : ""
                }`}
                onClick={followCurrentPlaylist}
                disabled={isFollowingPlaylist || isCurrentPlaylistFollowed}
                title={
                  isCurrentPlaylistFollowed
                    ? "Playlist Followed"
                    : "Follow Playlist"
                }
              >
                {isFollowingPlaylist ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : isCurrentPlaylistFollowed ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>
                {isCurrentPlaylistFollowed
                  ? "Playlist Followed"
                  : "Follow Playlist"}
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs px-2"
          onClick={playNextPlaylist}
          disabled={
            !isPlayerReady ||
            !playerDeviceId ||
            !canGoNextPlaylist ||
            isChangingPlaylist
          }
          title="Next Playlist"
        >
          Next
          {isChangingPlaylist ? (
            <Loader2 className="h-4 w-4 animate-spin ml-1" />
          ) : (
            <SkipForward className="h-4 w-4 ml-1" />
          )}
        </Button>
      </div>
    </div>
  );
}

// Helper function to format duration (ms to mm:ss)
function formatDuration(ms: number): string {
  if (typeof ms !== "number" || ms < 0) return "0:00";
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
}
