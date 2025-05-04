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

  // Player SDK State
  const {
    player,
    isReady: isPlayerReady,
    deviceId: playerDeviceId,
    isActive: isPlayerActive,
    currentTrack,
    playbackState,
  } = useSpotifyPlayerSDK();

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
    if (roomIdFromPath !== currentRoomIdRef.current) {
      setRoomPlaylists([]);
      setCurrentPlaylistIndex(0);
      setIsLoadingPlaylists(true);
      setIsChangingPlaylist(false);
      setIsTogglingShuffle(false);
      setIsSavingTrack(false);
      setIsFollowingPlaylist(false);
      setIsCurrentTrackSaved(false);
      setIsCurrentPlaylistFollowed(false);
      setInitialPlaybackAttempted(false);
      currentRoomIdRef.current = roomIdFromPath;
      setOriginalTrackId(null);
    }
  }, [pathname]);

  // Effect to fetch playlists when player is ready and we have a room ID
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

            if (
              fetchedPlaylists.length > 0 &&
              playerDeviceId &&
              !initialPlaybackAttempted &&
              !playbackState
            ) {
              setInitialPlaybackAttempted(true);
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
      console.log(
        `Checking saved status for track ID: ${idToCheck} (Playable: ${trackId}, Linked From: ${linkedFromId})`
      );
      checkTracksSaved([idToCheck]).then((result) => {
        if (result.error) {
          console.error("Error checking track saved status:", result.error);
          setIsCurrentTrackSaved(false); // Assume not saved on error
        } else if (result.data) {
          console.log(`Track ${idToCheck} saved status: ${result.data[0]}`);
          setIsCurrentTrackSaved(result.data[0] ?? false);
        }
      });
    } else {
      setIsCurrentTrackSaved(false);
    }

    // Check Playlist Followed Status
    if (currentPlaylistSpotifyId) {
      console.log(
        `Checking followed status for playlist ID: ${currentPlaylistSpotifyId}`
      );
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
          console.log(
            `Playlist ${currentPlaylistSpotifyId} followed status: ${result.isFollowing}`
          );
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
    player
      ?.togglePlay()
      .catch((err) => console.error("Error toggling play", err));
  }, [player]);

  const skipToNextTrack = useCallback(() => {
    player
      ?.nextTrack()
      .catch((err) => console.error("Error skipping next", err));
  }, [player]);

  const skipToPreviousTrack = useCallback(() => {
    if (!player) {
      return;
    }
    player?.previousTrack().catch((err) => {
      console.error("Error skipping previous track:", err);
    });
  }, [player]);

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
    ]
  );

  return (
    <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>
  );
}

// Create a custom hook for easy consumption
export function usePlayerContext() {
  const context = useContext(PlayerContext);
  if (context === undefined) {
    throw new Error(
      "usePlayerContext must be used within a PlayerContextProvider"
    );
  }
  return context;
}
