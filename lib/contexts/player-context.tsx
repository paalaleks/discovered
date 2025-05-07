"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
} from "react";
import { useSpotifyPlayerSDK } from "@/hooks/use-spotify-player-sdk";
import { usePathname } from "next/navigation";
import { getRoomPlaylistDetails } from "@/lib/actions/supabase.actions";
import { SimplePlaylistDetails } from "@/lib/types/index";
import {
  startPlayback,
  toggleShuffle,
  saveTrack,
  followPlaylist,
  checkTracksSaved,
  checkPlaylistFollowed,
} from "@/lib/actions/spotify.actions";
import { toast } from "sonner";

// Default values for when the player is not active/needed

// Define the shape of the context state
interface PlayerContextType {
  player: Spotify.Player | null;
  isPlayerReady: boolean;
  playerDeviceId: string | null;
  isPlayerActive: boolean;
  currentTrack: Spotify.Track | null;
  playbackState: Spotify.PlaybackState | null;
  roomPlaylists: SimplePlaylistDetails[];
  currentPlaylistIndex: number;
  setCurrentPlaylistIndex: (index: number) => void;
  isLoadingPlaylists: boolean;
  isChangingPlaylist: boolean;
  isTogglingShuffle: boolean;
  isSavingTrack: boolean;
  isFollowingPlaylist: boolean;
  isCurrentTrackSaved: boolean;
  isCurrentPlaylistFollowed: boolean;
  originalTrackId: string | null;
  playNextPlaylist: () => Promise<void>;
  playPreviousPlaylist: () => Promise<void>;
  togglePlayerShuffle: () => Promise<void>;
  togglePlayPause: () => void;
  skipToNextTrack: () => void;
  skipToPreviousTrack: () => void;
  saveCurrentTrack: () => Promise<void>;
  followCurrentPlaylist: () => Promise<void>;
  position: number;
  duration: number;
  isSeeking: boolean;
  handleSeekChange: (value: number[]) => void;
  handleSeekCommit: (value: number[]) => void;
}

// Create the context
const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

// Create the provider component
export function PlayerContextProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  // Reinstate specific check for actual room paths with IDs
  const isRoomPath = /^\/rooms\/[a-fA-F0-9-]+$/.test(pathname);

  // Call hook unconditionally, but pass flag to control initialization
  const {
    player,
    isReady: isPlayerReady,
    deviceId: playerDeviceId,
    isActive: isPlayerActive,
    currentTrack,
    playbackState,
    playerRef,
  } = useSpotifyPlayerSDK({ initialize: isRoomPath }); // Pass initialization flag

  // State for timer/seek logic
  const [position, setPosition] = useState(0); // Track position in ms
  const [duration, setDuration] = useState(0); // Track duration in ms
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekPosition, setSeekPosition] = useState(0); // Target position during seek
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // State for room playlists
  const [roomPlaylists, setRoomPlaylists] = useState<SimplePlaylistDetails[]>(
    []
  );
  const [currentPlaylistIndex, setCurrentPlaylistIndex] = useState<number>(0);
  const [isLoadingPlaylists, setIsLoadingPlaylists] = useState<boolean>(true);
  const [isChangingPlaylist, setIsChangingPlaylist] = useState<boolean>(false);
  const [isTogglingShuffle, setIsTogglingShuffle] = useState<boolean>(false);
  const [isSavingTrack, setIsSavingTrack] = useState<boolean>(false);
  const [isFollowingPlaylist, setIsFollowingPlaylist] =
    useState<boolean>(false);
  const [isCurrentTrackSaved, setIsCurrentTrackSaved] =
    useState<boolean>(false);
  const [isCurrentPlaylistFollowed, setIsCurrentPlaylistFollowed] =
    useState<boolean>(false);
  const [initialPlaybackAttempted, setInitialPlaybackAttempted] =
    useState<boolean>(false);
  const currentRoomIdRef = useRef<string | null>(null);
  const [originalTrackId, setOriginalTrackId] = useState<string | null>(null);

  // Effect to extract room ID from pathname
  useEffect(() => {
    const match = pathname.match(/\/rooms\/([a-fA-F0-9-]+)/);
    const roomIdFromPath = match ? match[1] : null;

    // Clear state if room ID changes OR if we navigate away from a room path
    if (roomIdFromPath !== currentRoomIdRef.current || !isRoomPath) {
      console.log(
        `[PlayerContext] Path changed. Path: ${pathname}, New Room ID: ${roomIdFromPath}, Is Room Path: ${isRoomPath}`
      );
      setRoomPlaylists([]);
      setCurrentPlaylistIndex(0);
      setIsLoadingPlaylists(isRoomPath); // Only set loading if it's a room path
      setIsChangingPlaylist(false);
      setIsTogglingShuffle(false);
      setIsSavingTrack(false);
      setIsFollowingPlaylist(false);
      setIsCurrentTrackSaved(false);
      setIsCurrentPlaylistFollowed(false);
      setInitialPlaybackAttempted(false);
      currentRoomIdRef.current = roomIdFromPath;
      setOriginalTrackId(null);
      // If we are not on a room path, ensure player state doesn't persist visually if needed
      // (This might be handled by the conditional hook already, but explicit reset can be safer)
      if (!isRoomPath) {
          // Potentially dispatch actions or clear local state related to UI if needed
      }
    }
  }, [pathname, isRoomPath]); // Add isRoomPath dependency

  // Effect to fetch playlists when player is ready and we have a room ID
  // This effect should now only run meaningfully when isRoomPath is true due to hook logic
  useEffect(() => {
    const currentRoomId = currentRoomIdRef.current;
    if (
      isPlayerReady &&
      currentRoomId &&
      isLoadingPlaylists &&
      roomPlaylists.length === 0
    ) {
      const fetchPlaylists = async () => {
      
        try {
          const fetchedPlaylists = await getRoomPlaylistDetails(currentRoomId);
          if (fetchedPlaylists) {
            setRoomPlaylists(fetchedPlaylists);
            setCurrentPlaylistIndex(0);
            // Condition to start initial playback
            if (
              fetchedPlaylists.length > 0 &&
              playerDeviceId &&
              !initialPlaybackAttempted // Removed !playbackState check
            ) {
              setInitialPlaybackAttempted(true); // Mark attempt immediately
              const firstPlaylistUri = fetchedPlaylists[0]?.uri;
              if (firstPlaylistUri) {
             
                const result = await startPlayback(
                  playerDeviceId,
                  firstPlaylistUri
                );
                if (result.success) {
                  toast.success(
                    `Started playback: ${fetchedPlaylists[0].name}`
                  );
                } else {
                  toast.error(
                    `Failed to start initial playback: ${result.error}`
                  );
                }
              } else {
                  console.error("[PlayerContext] Cannot start playback: First playlist URI is missing.");
                  setInitialPlaybackAttempted(false); // Reset if URI was bad
              }
            }
          } else {
            setRoomPlaylists([]);
          }
        } catch (error) {
          console.error("Error fetching room playlists:", error);
          setRoomPlaylists([]);
        } finally {
          setIsLoadingPlaylists(false);
        }
      };

      fetchPlaylists();
    }
  }, [
    isPlayerReady,
    isLoadingPlaylists,
    playerDeviceId,
    initialPlaybackAttempted,
    playbackState,
    roomPlaylists.length,
    pathname,
  ]);

  // Effect to check saved/followed status when track or playlist changes
  useEffect(() => {
    const trackId = currentTrack?.id;
    const linkedFromId = currentTrack?.linked_from?.id ?? null;
    const idToCheck = linkedFromId ?? trackId ?? null;
    const currentPlaylistSpotifyId =
      roomPlaylists[currentPlaylistIndex]?.spotify_playlist_id ?? null;

    // Check Track Saved Status
    if (idToCheck) {
      checkTracksSaved([idToCheck]).then((result) => {
        if (result.error) {
          console.error("Error checking track saved status:", result.error);
          setIsCurrentTrackSaved(false); // Assume not saved on error
        } else if (result.data) {
          setIsCurrentTrackSaved(result.data[0] ?? false);
        }
      });
    } else {
      setIsCurrentTrackSaved(false);
    }

    // Check Playlist Followed Status
    if (currentPlaylistSpotifyId) {
      // Reset follow status immediately before checking, prevents stale state if check fails
      // Consider if this flicker is acceptable or if loading state is better
      // setIsCurrentPlaylistFollowed(false);
      checkPlaylistFollowed(currentPlaylistSpotifyId).then((result) => {
        if (result.error) {
          console.error(
            "Error checking playlist followed status:",
            result.error
          );
          setIsCurrentPlaylistFollowed(false); // Assume not followed on error
        } else if (result.isFollowing !== null) {
          setIsCurrentPlaylistFollowed(result.isFollowing);
        } else {
          // Handle case where isFollowing is null but no error (shouldn't happen with current action)
          setIsCurrentPlaylistFollowed(false);
        }
      });
    } else {
      setIsCurrentPlaylistFollowed(false); // Reset if no playlist ID
    }

    // Update original track ID state if linked_from is present
    setOriginalTrackId(linkedFromId);

    // NOTE: Removed the separate playbackState effect as checks are consolidated here
  }, [
    currentTrack?.id,
    currentTrack?.linked_from?.id,
    roomPlaylists,
    currentPlaylistIndex,
  ]); // Depend on track/playlist identifiers

  // Effect to manage the track progress timer
  useEffect(() => {
    // Clear previous interval if playbackState changes or seeking starts
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // If playbackState exists, sync duration. Sync position only if not seeking.
    if (playbackState) {
      setDuration(playbackState.duration);
      if (!isSeeking) {
        setPosition(playbackState.position);
      }

      // If playing and not seeking, start the interval timer
      if (!playbackState.paused && !isSeeking) {
        intervalRef.current = setInterval(() => {
          setPosition((prevPosition) => {
            const newPosition = prevPosition + 1000;
            // Ensure position doesn't exceed duration
            return Math.min(newPosition, playbackState.duration);
          });
        }, 1000);
      }
    } else {
      // Reset position and duration if no playback state
      setPosition(0);
      setDuration(0);
    }

    // Cleanup function to clear interval on unmount or dependency change
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [playbackState, isSeeking]); // Dependencies: state and seeking status

  // Effect to automatically stop seeking if track changes or playback catches up
  useEffect(() => {
    if (!playbackState || !isSeeking) return;

    const currentPlaybackPosition = playbackState.position;
    const currentTrackId = playbackState.track_window.current_track.id;
    const seekTargetTrackId = currentTrack?.id; // Track ID when seek started

    // Stop seeking if:
    // 1. The track has changed since the seek started.
    // 2. The actual playback position is now very close to the seek target.
    if (
      currentTrackId !== seekTargetTrackId ||
      Math.abs(currentPlaybackPosition - seekPosition) < 1000
    ) {
      setIsSeeking(false);
    }
  }, [playbackState, isSeeking, seekPosition, currentTrack?.id]);

  // --- Player Actions ---

  const playNextPlaylist = useCallback(async () => {
    if (
      !playerDeviceId ||
      roomPlaylists.length <= 1 ||
      currentPlaylistIndex >= roomPlaylists.length - 1 ||
      isChangingPlaylist
    )
      return;

    const nextIndex = currentPlaylistIndex + 1;
    const nextPlaylist = roomPlaylists[nextIndex];
    if (!nextPlaylist || !nextPlaylist.uri) {
      toast.error("Cannot switch: Invalid next playlist data.");
      return;
    }

    setIsChangingPlaylist(true);
    toast.info(`Switching to playlist: ${nextPlaylist.name}...`);
    const result = await startPlayback(playerDeviceId, nextPlaylist.uri);
    setIsChangingPlaylist(false);

    if (result.success) {
      setCurrentPlaylistIndex(nextIndex);
      toast.success(`Now playing: ${nextPlaylist.name}`);
    } else {
      toast.error(
        `Failed to switch playlist: ${result.error || "Unknown error"}`
      );
    }
  }, [playerDeviceId, roomPlaylists, currentPlaylistIndex, isChangingPlaylist]);

  const playPreviousPlaylist = useCallback(async () => {
    if (
      !playerDeviceId ||
      roomPlaylists.length <= 1 ||
      currentPlaylistIndex <= 0 ||
      isChangingPlaylist
    )
      return;

    const prevIndex = currentPlaylistIndex - 1;
    const prevPlaylist = roomPlaylists[prevIndex];
    if (!prevPlaylist || !prevPlaylist.uri) {
      toast.error("Cannot switch: Invalid previous playlist data.");
      return;
    }

    setIsChangingPlaylist(true);
    toast.info(`Switching to playlist: ${prevPlaylist.name}...`);
    const result = await startPlayback(playerDeviceId, prevPlaylist.uri);
    setIsChangingPlaylist(false);

    if (result.success) {
      setCurrentPlaylistIndex(prevIndex);
      toast.success(`Now playing: ${prevPlaylist.name}`);
    } else {
      toast.error(
        `Failed to switch playlist: ${result.error || "Unknown error"}`
      );
    }
  }, [playerDeviceId, roomPlaylists, currentPlaylistIndex, isChangingPlaylist]);

  const togglePlayerShuffle = useCallback(async () => {
    if (!playbackState || isTogglingShuffle) return;

    const currentShuffleState = playbackState.shuffle;
    setIsTogglingShuffle(true);
    const result = await toggleShuffle(!currentShuffleState);
    setIsTogglingShuffle(false);

    if (result.success) {
      toast.success(`Shuffle ${!currentShuffleState ? "enabled" : "disabled"}`);
    } else {
      toast.error(
        `Failed to toggle shuffle: ${result.error || "Unknown error"}`
      );
    }
  }, [playbackState, isTogglingShuffle]);

  const togglePlayPause = useCallback(() => {
    playerRef.current
      ?.togglePlay()
      .catch((err) => console.error("Error toggling play", err));
  }, [playerRef]);

  const skipToNextTrack = useCallback(() => {
    playerRef.current
      ?.nextTrack()
      .catch((err) => console.error("Error skipping next", err));
  }, [playerRef]);

  const skipToPreviousTrack = useCallback(() => {
    if (!playerRef.current) {
      console.warn("Attempted skip previous when playerRef is null.");
      return;
    }
    playerRef.current?.previousTrack().catch((err) => {
      if (err?.message?.includes("playable_item")) {
          console.error("Spotify SDK Error (previousTrack):", err.message, err);
          toast.error("Spotify playback error. Try again shortly.");
      } else {
          console.error("Error skipping previous track:", err);
      }
    });
  }, [playerRef]);

  // Save Current Track Action
  const saveCurrentTrack = useCallback(async () => {
    const trackIdToSave = originalTrackId ?? currentTrack?.id;

    if (!trackIdToSave || isSavingTrack || isCurrentTrackSaved) {
      if (isCurrentTrackSaved) {
        toast.info("Track already saved.");
      } else if (!trackIdToSave) {
        toast.error("No track active to save.");
      }
      return;
    }

    setIsSavingTrack(true);
    const result = await saveTrack(trackIdToSave);
    setIsSavingTrack(false);

    if (result.success) {
      toast.success("Track saved to your Liked Songs!");
      setIsCurrentTrackSaved(true);
    } else {
      toast.error(`Failed to save track: ${result.error || "Unknown error"}`);
    }
  }, [currentTrack?.id, originalTrackId, isSavingTrack, isCurrentTrackSaved]);

  // Follow Current Playlist Action
  const followCurrentPlaylist = useCallback(async () => {
    const playlistId =
      roomPlaylists[currentPlaylistIndex]?.spotify_playlist_id ?? null;

    if (!playlistId || isFollowingPlaylist || isCurrentPlaylistFollowed) {
      if (isCurrentPlaylistFollowed) {
        toast.info("Playlist already followed.");
      } else if (!playlistId) {
        toast.error("No playlist active to follow.");
      }
      return;
    }

    setIsFollowingPlaylist(true);
    const result = await followPlaylist(playlistId);
    setIsFollowingPlaylist(false);

    if (result.success) {
      toast.success("Playlist followed!");
      setIsCurrentPlaylistFollowed(true); // Update state on success
    } else {
      toast.error(
        `Failed to follow playlist: ${result.error || "Unknown error"}`
      );
      // Optional: Re-check status on failure? Might be overkill
    }
  }, [
    roomPlaylists,
    currentPlaylistIndex,
    isFollowingPlaylist,
    isCurrentPlaylistFollowed,
  ]);

  // --- Seek Handlers ---
  const handleSeekChange = useCallback(
    (value: number[]) => {
      if (!duration) return; // Don't allow seek if duration is 0
      if (!isSeeking) setIsSeeking(true);
      const newSeekPosition = Math.round((value[0] / 100) * duration);
      // Update visual position immediately while dragging
      setPosition(newSeekPosition);
      setSeekPosition(newSeekPosition); // Store the target seek position
    },
    [duration, isSeeking] // Include isSeeking to ensure setIsSeeking(true) works
  );

  const handleSeekCommit = useCallback(
    (value: number[]) => {
      if (!player || !playbackState || !duration) {
        setIsSeeking(false); // Ensure seeking is reset if commit fails early
        return;
      }

      const finalPositionMs = Math.round((value[0] / 100) * duration);
      // Set the final target position
      setSeekPosition(finalPositionMs);
      // Update the displayed position one last time
      setPosition(finalPositionMs);
      // Keep isSeeking true - the effect watching playbackState will set it false

      player.seek(finalPositionMs).catch((err) => {
        console.error("Error seeking track:", err);
        toast.error("Failed to seek track.");
        // If seek fails, revert seeking state immediately and resync position
        setIsSeeking(false);
        if (playbackState) {
          setPosition(playbackState.position);
        }
      });
    },
    [player, playbackState, duration] // Dependencies for seek operation
  );

  // Memoize the context value to prevent unnecessary re-renders
  const value = useMemo(
    () => ({
      player,
      isPlayerReady,
      playerDeviceId,
      isPlayerActive,
      currentTrack,
      playbackState,
      roomPlaylists,
      currentPlaylistIndex,
      setCurrentPlaylistIndex,
      isLoadingPlaylists,
      isChangingPlaylist,
      isTogglingShuffle,
      isSavingTrack,
      isFollowingPlaylist,
      isCurrentTrackSaved,
      isCurrentPlaylistFollowed,
      originalTrackId,
      playNextPlaylist,
      playPreviousPlaylist,
      togglePlayerShuffle,
      togglePlayPause,
      skipToNextTrack,
      skipToPreviousTrack,
      saveCurrentTrack,
      followCurrentPlaylist,
      position: isSeeking ? seekPosition : position,
      duration,
      isSeeking,
      handleSeekChange,
      handleSeekCommit,
    }),
    [
      player,
      isPlayerReady,
      playerDeviceId,
      isPlayerActive,
      currentTrack,
      playbackState,
      roomPlaylists,
      currentPlaylistIndex,
      isLoadingPlaylists,
      isChangingPlaylist,
      isTogglingShuffle,
      isSavingTrack,
      isFollowingPlaylist,
      isCurrentTrackSaved,
      isCurrentPlaylistFollowed,
      originalTrackId,
      playNextPlaylist,
      playPreviousPlaylist,
      togglePlayerShuffle,
      togglePlayPause,
      skipToNextTrack,
      skipToPreviousTrack,
      saveCurrentTrack,
      followCurrentPlaylist,
      position,
      duration,
      isSeeking,
      seekPosition,
      handleSeekChange,
      handleSeekCommit,
    ]
  );

  // Render provider only if it's a room path OR if player is active
  // This prevents unnecessary context updates on non-room pages unless music is playing
  if (!isRoomPath && !isPlayerActive) {
    // Render children without the provider if not needed
    // Or potentially provide a default/inactive context value
    return <>{children}</>;
  }

  return (
    <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>
  );
}

// Custom hook to use the player context
export function usePlayerContext() {
  const context = useContext(PlayerContext);
  if (context === undefined) {
    throw new Error("usePlayerContext must be used within a PlayerContextProvider");
  }
  // Check if the context value seems initialized (e.g., player exists or ready flag is set)
  // This helps catch cases where the provider might have rendered null
  // Adapt this check based on what signifies an 'active' context
  if (context.player === undefined && !context.isPlayerReady && context.playerDeviceId === undefined) {
      console.warn("[PlayerContext] Consumer is accessing context, but provider might not be active or initialized. Check conditional rendering.");
      // Consider returning a default state or throwing a more specific error if this is unexpected
  }
  return context;
}
