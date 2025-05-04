"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  getSpotifyAccessToken,
  refreshSpotifyToken, // Import the refresh action
} from "@/lib/actions/spotify.actions";

// Declare the global callback used by the SDK script
declare global {
  interface Window {
    onSpotifyWebPlaybackSDKReady: () => void;
  }
}

// Use the actual SDK Player type
type SpotifyPlayer = Spotify.Player;

// Define specific event types based on SDK documentation if needed
// For example:
type SpotifyPlaybackState = Spotify.PlaybackState;
type SpotifyWebPlaybackInstance = Spotify.WebPlaybackInstance;
type SpotifyError = Spotify.Error;
type SpotifyTrack = Spotify.Track;

interface SpotifyPlayerSDKHookState {
  player: SpotifyPlayer | null;
  isReady: boolean;
  deviceId: string | null;
  isActive: boolean; // Is the player currently active in Spotify Connect?
  currentTrack: SpotifyTrack | null; // Current playing track object
  playbackState: SpotifyPlaybackState | null; // Full playback state
}

/**
 * Hook to manage the Spotify Web Playback SDK instance and state,
 * including playback status updates.
 */
export function useSpotifyPlayerSDK(): SpotifyPlayerSDKHookState {
  const [player, setPlayer] = useState<SpotifyPlayer | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<SpotifyTrack | null>(null);
  const [playbackState, setPlaybackState] =
    useState<SpotifyPlaybackState | null>(null);
  const playerRef = useRef<SpotifyPlayer | null>(null); // Define the playerRef
  const [isConnecting, setIsConnecting] = useState(false); // State to prevent multiple concurrent connections
  const reconnectionAttemptRef = useRef<NodeJS.Timeout | null>(null);

  // Use refs to store callbacks that might change, preventing unnecessary effect re-runs
  const getOAuthTokenRef = useRef<
    ((cb: (token: string) => void) => void) | null
  >(null);

  // Ref for attemptReconnect to break circular dependency for initializePlayer's handleError
  const attemptReconnectRef = useRef<() => void>(() => {});

  // --- Resilience: Event Listeners / Reconnection ---

  // Function to initialize the player (extracted for re-use)
  const initializePlayer = useCallback((shouldConnect: boolean = true) => {
    console.log("useSpotifyPlayerSDK: Initializing/Re-initializing Player...");
    if (isConnecting) {
      console.log("useSpotifyPlayerSDK: Already connecting, skipping re-init.");
      return;
    }

    if (!getOAuthTokenRef.current) {
      console.error(
        "useSpotifyPlayerSDK: getOAuthToken callback is not set during init."
      );
      return;
    }

    setIsConnecting(true);
    setIsReady(false); // Assume not ready until 'ready' event fires
    setIsActive(false);
    setDeviceId(null);

    // Clean up previous instance if exists
    if (playerRef.current) {
      console.log(
        "useSpotifyPlayerSDK: Disconnecting previous player instance."
      );
      playerRef.current.disconnect();
      playerRef.current = null; // Clear the ref
      // Clear related state immediately
      setPlayer(null);
      setCurrentTrack(null);
      setPlaybackState(null);
    }

    const newPlayer = new window.Spotify.Player({
      name: "Playlist Chat Rooms Player",
      getOAuthToken: getOAuthTokenRef.current,
      volume: 0.5,
    });

    // Setup listeners for the new player instance
    const handleReady = (instance: SpotifyWebPlaybackInstance) => {
      console.log(
        "useSpotifyPlayerSDK: Player Ready with Device ID",
        instance.device_id
      );
      setPlayer(newPlayer);
      setIsReady(true);
      setDeviceId(instance.device_id);
      playerRef.current = newPlayer;
      setIsConnecting(false); // Connection successful
    };

    const handleNotReady = (instance: SpotifyWebPlaybackInstance) => {
      console.log(
        "useSpotifyPlayerSDK: Player Device ID has gone offline",
        instance.device_id
      );
      setIsReady(false);
      setIsActive(false);
      setDeviceId(null);
      setIsConnecting(false); // Connection failed/stopped
    };

    const handleError = (error: SpotifyError) => {
      console.error(
        "useSpotifyPlayerSDK: Spotify Player Error Received.",
        error
      );

      // Basic Error Logging (as implemented before)
      if (error && typeof error === "object" && "message" in error) {
        console.error("Error Message:", error.message);
      }

      setIsReady(false);
      setIsActive(false);
      setDeviceId(null);
      setIsConnecting(false); // Ensure connecting flag is reset

      // Conditionally attempt reconnect based on error type
      if (
        error &&
        typeof error === "object" &&
        "message" in error &&
        typeof error.message === "string"
      ) {
        const message = error.message.toLowerCase();
        // Avoid reconnecting on persistent auth/account issues immediately
        if (
          message.includes("authentication failed") ||
          message.includes("account error")
        ) {
          console.warn(
            "useSpotifyPlayerSDK: Authentication/Account error detected, not attempting immediate reconnect."
          );
          // Surface this error more clearly to the user elsewhere?
        } else {
          // For other errors (e.g., initialization, playback), attempt reconnect after a delay
          console.log(
            "useSpotifyPlayerSDK: Attempting reconnect after error...",
            error.message
          );
          // Use the ref to call the latest version of attemptReconnect
          attemptReconnectRef.current();
        }
      }
    };

    const handleStateChange = (state: SpotifyPlaybackState | null) => {
      console.log(
        "useSpotifyPlayerSDK: Player state changed",
        state ?? "(null state)"
      );
      setPlaybackState(state);
      setCurrentTrack(state?.track_window.current_track ?? null);
      setIsActive(!!state); // Active if state is not null
    };

    newPlayer.addListener("ready", handleReady);
    newPlayer.addListener("not_ready", handleNotReady);
    newPlayer.addListener("player_state_changed", handleStateChange);
    newPlayer.addListener("initialization_error", handleError);
    newPlayer.addListener("authentication_error", handleError);
    newPlayer.addListener("account_error", handleError);
    newPlayer.addListener("playback_error", handleError);

    if (shouldConnect) {
      console.log("useSpotifyPlayerSDK: Connecting new player instance...");
      newPlayer.connect().then((success) => {
        if (success) {
          console.log(
            "useSpotifyPlayerSDK: The Web Playback SDK successfully connected!"
          );
        } else {
          console.error(
            "useSpotifyPlayerSDK: The Web Playback SDK failed to connect."
          );
          setIsConnecting(false);
        }
      });
    } else {
      // If we only initialize but don't connect yet
      setIsConnecting(false);
    }
  }, []);

  const attemptReconnect = useCallback(() => {
    if (reconnectionAttemptRef.current) {
      clearTimeout(reconnectionAttemptRef.current);
    }
    // Debounce reconnection slightly
    reconnectionAttemptRef.current = setTimeout(() => {
      console.log("useSpotifyPlayerSDK: Attempting reconnection...");
      // Re-initialize and connect
      initializePlayer(true);
    }, 500); // 500ms delay
  }, [initializePlayer]);

  // Keep the ref updated with the latest attemptReconnect function
  useEffect(() => {
    attemptReconnectRef.current = attemptReconnect;
  }, [attemptReconnect]);

  const handleVisibilityChange = useCallback(() => {
    const isHidden = document.hidden;
    console.log(
      `useSpotifyPlayerSDK: Visibility changed. Hidden: ${isHidden}. Online: ${navigator.onLine}`
    );
    if (!isHidden && navigator.onLine && !isReady && !isConnecting) {
      console.log(
        "useSpotifyPlayerSDK: Tab became visible, online, and player not ready. Triggering reconnect."
      );
      attemptReconnect();
    }
  }, [isReady, isConnecting, attemptReconnect]);

  const handleOnline = useCallback(() => {
    console.log(
      `useSpotifyPlayerSDK: Network came online. Visible: ${!document.hidden}`
    );
    // Only reconnect if tab is visible and player isn't ready/connecting
    if (!document.hidden && !isReady && !isConnecting) {
      console.log(
        "useSpotifyPlayerSDK: Network online and tab visible, player not ready. Triggering reconnect."
      );
      attemptReconnect();
    }
  }, [isReady, isConnecting, attemptReconnect]);

  const handleOffline = useCallback(() => {
    console.log("useSpotifyPlayerSDK: Network went offline.");
    // Optionally force player state to inactive
    setIsActive(false);
    setIsReady(false); // Assume player is no longer ready
    setIsConnecting(false); // Stop any connection attempts
    // No need to call disconnect here, it will fail anyway.
  }, []);

  useEffect(() => {
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    console.log("useSpotifyPlayerSDK: Added visibility/network listeners.");

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      if (reconnectionAttemptRef.current) {
        clearTimeout(reconnectionAttemptRef.current);
      }
      console.log("useSpotifyPlayerSDK: Removed visibility/network listeners.");
    };
  }, [handleVisibilityChange, handleOnline, handleOffline]);

  // Implement getOAuthToken logic
  const getOAuthToken = useCallback(
    async (callback: (token: string) => void) => {
      console.log("useSpotifyPlayerSDK: getOAuthToken called by SDK");
      let tokenInfo: Awaited<ReturnType<typeof getSpotifyAccessToken>> | null =
        null;
      let refreshedTokenInfo: Awaited<
        ReturnType<typeof refreshSpotifyToken>
      > | null = null;

      // 1. Attempt to get current token info
      try {
        tokenInfo = await getSpotifyAccessToken();
      } catch (error) {
        console.error(
          "useSpotifyPlayerSDK: Network error fetching initial token info:",
          error
        );
        // If fetching token info fails entirely, we can't proceed.
        callback(""); // Indicate failure to SDK
        return;
      }

      // 2. Check if refresh is needed
      let needsRefresh = false;
      if (
        tokenInfo?.providerRefreshToken &&
        (!tokenInfo.accessToken ||
          (tokenInfo.expiresAt && Date.now() / 1000 > tokenInfo.expiresAt - 60))
      ) {
        needsRefresh = true;
      }

      // 3. Attempt refresh if needed
      if (needsRefresh && tokenInfo?.providerRefreshToken) {
        console.log(
          "useSpotifyPlayerSDK: Access token missing or expired, attempting refresh."
        );
        try {
          refreshedTokenInfo = await refreshSpotifyToken(
            tokenInfo.providerRefreshToken
          );
          if (refreshedTokenInfo?.accessToken) {
            console.log(
              "useSpotifyPlayerSDK: Token refreshed successfully for SDK."
            );
            callback(refreshedTokenInfo.accessToken);
            return;
          } else {
            console.error(
              "useSpotifyPlayerSDK: Refresh attempt failed, no access token returned."
            );
            // Fall through to potentially use stale token if available
          }
        } catch (error) {
          console.error(
            "useSpotifyPlayerSDK: Network error during token refresh:",
            error
          );
          // Fall through to potentially use stale token if refresh fetch failed
        }
      }

      // 4. Provide best available token (refreshed, original, or indicate failure)
      if (refreshedTokenInfo?.accessToken) {
        // This case should ideally be handled within the try block above,
        // but included for completeness if fall-through logic changes.
        callback(refreshedTokenInfo.accessToken);
      } else if (tokenInfo?.accessToken) {
        console.log(
          "useSpotifyPlayerSDK: Providing original (potentially stale) access token to SDK."
        );
        callback(tokenInfo.accessToken);
      } else {
        console.error(
          "useSpotifyPlayerSDK: No valid access token available after get/refresh attempts."
        );
        callback(""); // Indicate failure to SDK
      }
    },
    []
  );

  // Store the latest getOAuthToken in the ref
  useEffect(() => {
    getOAuthTokenRef.current = getOAuthToken;
  }, [getOAuthToken]);

  // SDK Initialization Effect (runs only once on initial mount)
  useEffect(() => {
    console.log("useSpotifyPlayerSDK: Initial mount effect running...");

    // Check if the SDK script has loaded
    if (window.Spotify) {
      console.log("useSpotifyPlayerSDK: Spotify SDK already loaded.");
      initializePlayer();
    } else {
      console.log(
        "useSpotifyPlayerSDK: Spotify SDK not loaded yet, waiting..."
      );
      // Define the global callback
      window.onSpotifyWebPlaybackSDKReady = () => {
        console.log(
          "useSpotifyPlayerSDK: onSpotifyWebPlaybackSDKReady called."
        );
        initializePlayer();
      };
    }

    // Cleanup function to disconnect player on component unmount
    return () => {
      if (playerRef.current) {
        console.log(
          "useSpotifyPlayerSDK: Disconnecting player on component unmount."
        );
        playerRef.current.disconnect();
        playerRef.current = null;
      }
      if (reconnectionAttemptRef.current) {
        clearTimeout(reconnectionAttemptRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array ensures this runs only once on mount

  return {
    player,
    isReady,
    deviceId,
    isActive,
    currentTrack,
    playbackState,
  };
}
