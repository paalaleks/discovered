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

import { SimplePlaylistDetails } from "@/lib/types/index";
import MarqueeText from "./ui/marquee-text";

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
    position,
    handleSeekChange,
    handleSeekCommit,
  } = usePlayerContext();

  // Local UI state derived from playbackState or for controls
  const [volume, setVolume] = useState(50); // Local volume 0-100 for slider
  const [isMuted, setIsMuted] = useState(false);
  const [duration, setDuration] = useState(0); // Track duration in ms

  const [isVolumePopoverOpen, setIsVolumePopoverOpen] = useState(false);

  // Keep local shuffle state for immediate UI feedback, synced from context
  const [isShuffleActive, setIsShuffleActive] = useState(false);

  // Use derived state for checking if playing
  const isPlayingDerived = playbackState ? !playbackState.paused : false;

  // Effect to sync local UI state from context playbackState
  useEffect(() => {
    if (!playbackState) {
      setDuration(0);
      setIsShuffleActive(false);
      return;
    }

    // Sync duration and shuffle state directly from playbackState
    setDuration(playbackState.duration);
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
  const displayPositionStr = formatDuration(position);
  const totalDurationStr = formatDuration(duration);
  const displayProgressPercent = duration > 0 ? (position / duration) * 100 : 0;

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

  return (
    <div className="flex flex-col gap-4 p-4 w-full">
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
        <div className="min-w-0 group">
          <MarqueeText
            text={trackName}
            className="font-semibold text-sm"
            title={trackName}
            pauseOnHover
            animationDuration={trackName.length > 60 ? 20 : 10}
          />
          <MarqueeText
            text={artistName}
            className="text-xs text-muted-foreground"
            title={artistName}
            pauseOnHover
            animationDuration={artistName.length > 40 ? 15 : 10}
          />
          <div className="flex items-center gap-1 text-xs text-muted-foreground group">
            <ListMusic className="h-3 w-3 flex-shrink-0" />
            <MarqueeText
              text={isLoadingPlaylists ? "Loading..." : currentPlaylistName}
              className="flex-1"
              title={currentPlaylistName}
              pauseOnHover
              animationDuration={currentPlaylistName.length > 30 ? 15 : 10}
            />
          </div>
        </div>
      </div>

      {/* Playback Controls use isPlayerReady, isPlayerActive from context */}
      <div className="flex items-center justify-center gap-2 w-72">
        <Button
          variant="ghost"
          size="icon"
          className={`rounded-full ${!isShuffleActive ? "opacity-50" : ""}`}
          onClick={togglePlayerShuffle}
          disabled={!isPlayerReady || isTogglingShuffle}
        >
          <Shuffle className="h-5 w-5" />
        </Button>
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
        <Button
          variant="ghost"
          size="icon"
          className={`rounded-full w-8 h-8 ${
            isCurrentTrackSaved ? "text-green-500" : ""
          }`}
          onClick={saveCurrentTrack}
          disabled={!currentTrack || isSavingTrack}
          title={
            isCurrentTrackSaved ? "Saved to Liked Songs" : "Save to Liked Songs"
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
      </div>

      {/* Progress Bar uses local state synced from context */}
      <div className="flex items-center gap-2 w-72">
        <span className="text-xs text-muted-foreground w-8 text-right">
          {displayPositionStr}
        </span>
        <Slider
          value={[displayProgressPercent]}
          max={100}
          step={0.1}
          className="flex-1 [&>span:first-child]:bg-primary"
          disabled={
            !isPlayerReady || !isPlayerActive || duration <= 0 || !playbackState
          }
          onValueChange={handleSeekChange}
          onValueCommit={handleSeekCommit}
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
        <div className="px-2">
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
        <Button
          variant="ghost"
          size="icon"
          className={`rounded-full h-7 w-7 ${
            isCurrentPlaylistFollowed ? "text-green-500" : ""
          }`}
          onClick={followCurrentPlaylist}
          disabled={isFollowingPlaylist || isCurrentPlaylistFollowed}
          title={
            isCurrentPlaylistFollowed ? "Playlist Followed" : "Follow Playlist"
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
