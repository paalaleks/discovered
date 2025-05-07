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
export function useSpotifyPlayerSDK(options?: {
  initialize?: boolean;
}): SpotifyPlayerSDKHookState & {
  playerRef: React.RefObject<SpotifyPlayer | null>;
} {
  const { initialize = true } = options ?? {}; // Default initialize to true

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
    if (isConnecting) {
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
      setPlayer(newPlayer);
      setIsReady(true);
      setDeviceId(instance.device_id);
      playerRef.current = newPlayer;
      setIsConnecting(false); // Connection successful
    };

    const handleNotReady = () => {
      setIsReady(false);
      setIsActive(false);
      setDeviceId(null);
      setIsConnecting(false); // Connection failed/stopped
    };

    const handleError = (error: SpotifyError) => {
      console.error(
        "useSpotifyPlayerSDK: Spotify Player Error Received.",
        error // Log the raw error object first
      );

      // More robustly extract and log the message
      let errorMessage = "Unknown Spotify Player Error";
      if (
        error &&
        typeof error === "object" &&
        "message" in error &&
        typeof error.message === "string"
      ) {
        errorMessage = error.message;
      } else if (typeof error === "string") {
        errorMessage = error; // Handle if error is just a string
      }
      console.error("useSpotifyPlayerSDK: Error Message:", errorMessage);

      setIsReady(false);
      setIsActive(false);
      setDeviceId(null);
      setIsConnecting(false); // Ensure connecting flag is reset

      // Conditionally attempt reconnect based on error type
      if (errorMessage) {
        // Check using the extracted message
        const message = errorMessage.toLowerCase();
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
          attemptReconnectRef.current();
        }
      }
    };

    const handleStateChange = (state: SpotifyPlaybackState | null) => {
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
      newPlayer.connect().then((success) => {
        if (success) {
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
      initializePlayer(true);
    }, 500); // 500ms delay
  }, [initializePlayer]);

  // Keep the ref updated with the latest attemptReconnect function
  useEffect(() => {
    attemptReconnectRef.current = attemptReconnect;
  }, [attemptReconnect]);

  // const handleVisibilityChange = useCallback(() => {
  // const isHidden = document.hidden; // No longer needed
  // --- REMOVED RECONNECT LOGIC ---
  // We no longer trigger reconnect solely based on tab visibility.
  // Reconnection is handled by 'handleOnline' and SDK error events.
  // We might still want to do something when hidden, e.g., pause?
  // Or update some internal state if needed when visibility changes.
  // }, []); // Removed dependencies as they are no longer used here

  const handleOnline = useCallback(() => {
    if (!document.hidden && !isReady && !isConnecting) {
      attemptReconnect();
    }
  }, [isReady, isConnecting, attemptReconnect]);

  const handleOffline = useCallback(() => {
    setIsActive(false);
    setIsReady(false); // Assume player is no longer ready
    setIsConnecting(false); // Stop any connection attempts
    // No need to call disconnect here, it will fail anyway.
  }, []);

  useEffect(() => {
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
  }, [handleOnline, handleOffline]);

  // Implement getOAuthToken logic
  const getOAuthToken = useCallback(
    async (callback: (token: string) => void) => {
      let tokenInfo: Awaited<ReturnType<typeof getSpotifyAccessToken>> | null =
        null;
      let refreshedTokenInfo: Awaited<
        ReturnType<typeof refreshSpotifyToken>
      > | null = null;

      // 1. Attempt to get current token info
      try {
        console.log(
          "useSpotifyPlayerSDK: Attempting to get access token info..."
        );
        tokenInfo = await getSpotifyAccessToken();
        console.log(
          "useSpotifyPlayerSDK: Got token info:",
          tokenInfo ? "Yes" : "No",
          tokenInfo
        );
      } catch (error) {
        console.error(
          "useSpotifyPlayerSDK: Network error fetching initial token info:",
          error
        );
        // If fetching token info fails entirely, we can't proceed.
        console.log(
          "useSpotifyPlayerSDK: Calling SDK callback with empty token due to fetch error."
        );
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
      console.log(
        "useSpotifyPlayerSDK: Needs refresh?",
        needsRefresh,
        "Refresh Token available?",
        !!tokenInfo?.providerRefreshToken
      );

      // 3. Attempt refresh if needed
      if (needsRefresh && tokenInfo?.providerRefreshToken) {
        console.log("useSpotifyPlayerSDK: Attempting token refresh...");
        try {
          refreshedTokenInfo = await refreshSpotifyToken(
            tokenInfo.providerRefreshToken
          );
          if (refreshedTokenInfo?.accessToken) {
            console.log(
              "useSpotifyPlayerSDK: Token refresh successful. Calling SDK callback with refreshed token."
            );
            callback(refreshedTokenInfo.accessToken);
            return;
          } else {
            console.error(
              "useSpotifyPlayerSDK: Refresh attempt failed, no access token returned.",
              refreshedTokenInfo
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
        // This case should technically be handled above, but added for completeness
        console.log(
          "useSpotifyPlayerSDK: Calling SDK callback with refreshed token (fallback check)."
        );
        callback(refreshedTokenInfo.accessToken);
      } else if (tokenInfo?.accessToken) {
        // Check expiry again just in case, though SDK might handle it
        const isExpired =
          tokenInfo.expiresAt && Date.now() / 1000 > tokenInfo.expiresAt;
        console.log(
          `useSpotifyPlayerSDK: Calling SDK callback with existing token (Expired: ${isExpired}).`
        );
        callback(tokenInfo.accessToken);
      } else {
        console.error(
          "useSpotifyPlayerSDK: No valid access token available after get/refresh attempts. Calling SDK callback with empty token."
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
    // Only run initialization logic if the initialize flag is true
    if (!initialize) {
      // If not initializing, ensure any existing player is disconnected and state is reset
      console.log(
        "useSpotifyPlayerSDK: initialize is false. Checking if player exists.",
        { exists: !!playerRef.current }
      ); // Added Log
      if (playerRef.current) {
        console.log(
          "useSpotifyPlayerSDK: Player exists. Disconnecting player due to initialize=false"
        );
        try {
          playerRef.current.disconnect();
          console.log("useSpotifyPlayerSDK: Disconnect called successfully."); // Added Log
        } catch (error) {
          console.error("useSpotifyPlayerSDK: Error during disconnect:", error); // Added Log
        }
        playerRef.current = null;
        setPlayer(null);
        setIsReady(false);
        setDeviceId(null);
        setIsActive(false);
        setCurrentTrack(null);
        setPlaybackState(null);
        if (reconnectionAttemptRef.current) {
          clearTimeout(reconnectionAttemptRef.current);
        }
      }
      return; // Exit early if initialize is false
    }

    // Define the OAuth callback function
    getOAuthTokenRef.current = (cb) => {
      getOAuthToken(cb).catch((error) => {
        console.error(
          "useSpotifyPlayerSDK: Error in getOAuthToken callback:",
          error
        );
        // Handle token fetch error - maybe set an error state?
      });
    };

    // Check if the SDK script is already loaded
    if (window.Spotify && window.Spotify.Player) {
      console.log("useSpotifyPlayerSDK: SDK script already loaded.");
      if (!playerRef.current && !isConnecting) {
        initializePlayer();
      }
    } else {
      console.log("useSpotifyPlayerSDK: SDK script not loaded, attaching...");
      // Define the global callback
      window.onSpotifyWebPlaybackSDKReady = () => {
        console.log("useSpotifyPlayerSDK: SDK script loaded via callback.");
        if (!playerRef.current && !isConnecting) {
          initializePlayer();
        }
      };

      // Inject the script
      const script = document.createElement("script");
      script.src = "https://sdk.scdn.co/spotify-player.js";
      script.async = true;
      script.onerror = () => {
        console.error(
          "useSpotifyPlayerSDK: Failed to load Spotify SDK script."
        );
        // Handle script load failure
      };
      document.body.appendChild(script);

      // Cleanup function for script tag
      return () => {
        const existingScript = document.querySelector(
          'script[src="https://sdk.scdn.co/spotify-player.js"]'
        );
        if (existingScript) {
          // Optional: Consider removing the script tag on cleanup
          // document.body.removeChild(existingScript);
          // console.log("useSpotifyPlayerSDK: Cleaned up SDK script tag.");
        }
        // Clear the global callback
        window.onSpotifyWebPlaybackSDKReady = () => {};
      };
    }

    // No script cleanup needed if already loaded
    return undefined;
  }, [initialize, initializePlayer, isConnecting]); // Add initialize and isConnecting dependency

  return {
    player,
    isReady,
    deviceId,
    isActive,
    currentTrack,
    playbackState,
    playerRef,
  };
}
