"use server";

import { createClient } from "@/lib/supabase/server";
import { Buffer } from "buffer";

const SPOTIFY_ACCOUNTS_URL = "https://accounts.spotify.com/api/token";

// Define the expected return structure for the access token info
// Updated to reflect potential error state more clearly
export type SpotifyTokenResult =
  | {
      accessToken: string;
      expiresAt: number | null;
      providerRefreshToken: string | null;
      error?: never;
    }
  | {
      accessToken?: null;
      expiresAt?: null;
      providerRefreshToken?: null;
      error: string;
    };

/**
 * Server Action to retrieve the stored Spotify OAuth tokens for the current user.
 * Fetches data stored by Supabase Auth during the OAuth flow.
 * Handles token refresh automatically if the stored token is expired.
 * @returns {Promise<SpotifyTokenResult>} An object containing token information or an error.
 */
export async function getSpotifyAccessToken(): Promise<SpotifyTokenResult> {
  console.log("Server Action: getSpotifyAccessToken called");
  try {
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData?.user) {
      const errorMsg = userError
        ? "Failed to get user"
        : "No authenticated user found.";
      console.error(`getSpotifyAccessToken Error: ${errorMsg}`, userError);
      return { error: "Authentication required." };
    }
    const { user } = userData;
    const userMetadata = user.user_metadata ?? {};

    let accessToken = (userMetadata.provider_token as string) ?? null;
    const providerRefreshToken =
      (userMetadata.provider_refresh_token as string) ?? null;
    let expiresAtTimestamp =
      (userMetadata.provider_token_expires_at as number) ?? null;

    // --- Token Refresh Logic ---
    const nowInSeconds = Math.floor(Date.now() / 1000);
    // Check if expired (add a 60-second buffer)
    if (expiresAtTimestamp && expiresAtTimestamp < nowInSeconds + 60) {
      console.log(
        `getSpotifyAccessToken: Token expired or expiring soon (Expires: ${expiresAtTimestamp}, Now: ${nowInSeconds}). Attempting refresh.`
      );
      if (!providerRefreshToken) {
        console.error(
          "getSpotifyAccessToken Error: Token expired, but no refresh token found."
        );
        return {
          error:
            "Spotify token expired, refresh token missing. Please re-login.",
        };
      }

      const refreshedTokenInfo = await refreshSpotifyToken(
        providerRefreshToken
      );

      if (refreshedTokenInfo) {
        console.log("getSpotifyAccessToken: Token refreshed successfully.");
        accessToken = refreshedTokenInfo.accessToken;
        const newExpiresAt = nowInSeconds + refreshedTokenInfo.expiresIn;
        expiresAtTimestamp = newExpiresAt; // Update local variable for return

        // Update Supabase user metadata with the new token and expiry
        const { error: updateError } = await supabase.auth.updateUser({
          data: {
            ...userMetadata, // Preserve existing metadata
            provider_token: accessToken,
            provider_token_expires_at: newExpiresAt,
            // Keep the same refresh token unless Spotify provides a new one (usually doesn't)
          },
        });

        if (updateError) {
          console.error(
            "getSpotifyAccessToken Error: Failed to update user metadata with refreshed token:",
            updateError
          );
          // Proceed with the refreshed token for this request, but warn about persistence issue
          // Or return an error? Let's return error for now to be safe.
          return { error: "Failed to save refreshed Spotify token." };
        }
        console.log(
          "getSpotifyAccessToken: User metadata updated with new token info."
        );
      } else {
        console.error(
          "getSpotifyAccessToken Error: Refresh token attempt failed."
        );
        return { error: "Failed to refresh Spotify token. Please re-login." };
      }
    } else {
      console.log(
        `getSpotifyAccessToken: Token is valid (Expires: ${expiresAtTimestamp}, Now: ${nowInSeconds}).`
      );
    }
    // --- End Refresh Logic ---

    if (!accessToken) {
      console.warn(
        "getSpotifyAccessToken Warn: Spotify access token is missing after check/refresh."
      );
      return { error: "Could not retrieve Spotify access token." };
    }

    console.log("getSpotifyAccessToken Result: Returning valid token info.");
    return {
      accessToken,
      expiresAt: expiresAtTimestamp,
      providerRefreshToken, // Still return the refresh token if needed elsewhere
    };
  } catch (error) {
    console.error("getSpotifyAccessToken Error: Unexpected error", error);
    return { error: "An unexpected error occurred retrieving Spotify token." };
  }
}

// Define the expected return structure for the refresh token action
export interface SpotifyRefreshedTokenInfo {
  accessToken: string;
  expiresIn: number; // Duration in seconds until the new token expires
}

/**
 * Server Action to refresh a Spotify access token using a provider refresh token.
 * Requires SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET environment variables.
 * @param providerRefreshToken The refresh token obtained from Supabase session.
 * @returns {Promise<SpotifyRefreshedTokenInfo | null>} New token info or null if refresh failed.
 */
export async function refreshSpotifyToken(
  providerRefreshToken: string
): Promise<SpotifyRefreshedTokenInfo | null> {
  console.log("Server Action: refreshSpotifyToken called");
  if (!providerRefreshToken) {
    console.error("refreshSpotifyToken Error: Missing provider refresh token.");
    return null;
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error(
      "refreshSpotifyToken Error: Missing SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET env vars."
    );
    return null;
  }

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString(
    "base64"
  );

  try {
    const response = await fetch(SPOTIFY_ACCOUNTS_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basicAuth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: providerRefreshToken,
      }),
      // Important: Use no-store cache to ensure fresh request
      cache: "no-store",
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error(
        `refreshSpotifyToken Error (${response.status}): Failed to refresh token.`,
        errorData
      );
      // Specific handling for invalid refresh token? Spotify might return 400 Bad Request
      return null;
    }

    const data = await response.json();

    // Check if the expected fields are present
    if (!data.access_token || typeof data.expires_in !== "number") {
      console.error(
        "refreshSpotifyToken Error: Invalid response format from Spotify.",
        data
      );
      return null;
    }

    console.log("refreshSpotifyToken Success: Token refreshed successfully.");

    return {
      accessToken: data.access_token,
      expiresIn: data.expires_in,
    };
  } catch (error) {
    console.error("refreshSpotifyToken Error: Network or other error.", error);
    return null;
  }
}

const SPOTIFY_API_BASE = "https://api.spotify.com/v1";

// Helper function to make authenticated Spotify API calls
async function fetchSpotifyApi(
  endpoint: string,
  token: string,
  options: RequestInit = {}
): Promise<Response> {
  return fetch(`${SPOTIFY_API_BASE}${endpoint}`, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json", // Often needed for PUT/POST
    },
    cache: "no-store", // Ensure fresh requests for player actions
  });
}

// --- New Server Actions for Player Control ---

/**
 * Server Action to start or resume playback on a specific device,
 * optionally playing a specific context URI (like a playlist).
 * @param deviceId The ID of the device to play on.
 * @param contextUri The Spotify context URI to play (e.g., "spotify:playlist:..."). Optional.
 * @param positionMs The position in milliseconds to start playback from. Optional.
 * @returns {Promise<{ success: boolean; error?: string }>} Status of the operation.
 */
export async function startPlayback(
  deviceId: string,
  contextUri?: string,
  positionMs?: number
): Promise<{ success: boolean; error?: string }> {
  console.log(`Server Action: startPlayback called for device ${deviceId}`, {
    contextUri,
    positionMs,
  });
  try {
    const tokenInfo = await getSpotifyAccessToken();
    if (!tokenInfo?.accessToken) {
      console.error("startPlayback Error: Could not get access token.");
      return { success: false, error: "Authentication required." };
    }

    const body: { context_uri?: string; position_ms?: number } = {};
    if (contextUri) {
      body.context_uri = contextUri;
    }
    if (positionMs !== undefined) {
      body.position_ms = positionMs;
    }

    const response = await fetchSpotifyApi(
      `/me/player/play?device_id=${deviceId}`,
      tokenInfo.accessToken,
      {
        method: "PUT",
        body: Object.keys(body).length > 0 ? JSON.stringify(body) : undefined, // Only include body if non-empty
      }
    );

    if (!response.ok) {
      const errorData = await response.text(); // Get text for more info
      console.error(
        `startPlayback Error (${response.status}): Failed to start playback.`,
        errorData
      );
      // Specific error handling (e.g., 404 device not found, 403 premium required)
      let errorMessage = "Failed to start playback.";
      if (response.status === 404)
        errorMessage = "Device not found or inactive.";
      if (response.status === 403)
        errorMessage = "Spotify Premium required or action forbidden.";
      return { success: false, error: errorMessage };
    }

    // Spotify returns 204 No Content on success
    console.log("startPlayback Success: Playback command sent.");
    return { success: true };
  } catch (error) {
    console.error("startPlayback Error: Unexpected error", error);
    return { success: false, error: "An unexpected error occurred." };
  }
}

/**
 * Server Action to toggle shuffle mode for the user's playback.
 * @param deviceId The ID of the device (optional, but recommended).
 * @param shuffleState The desired shuffle state (true for on, false for off).
 * @returns {Promise<{ success: boolean; error?: string }>} Status of the operation.
 */
export async function toggleShuffle(
  shuffleState: boolean,
  deviceId?: string
): Promise<{ success: boolean; error?: string }> {
  console.log(
    `Server Action: toggleShuffle called with state: ${shuffleState}`,
    { deviceId }
  );
  try {
    const tokenInfo = await getSpotifyAccessToken();
    if (!tokenInfo?.accessToken) {
      console.error("toggleShuffle Error: Could not get access token.");
      return { success: false, error: "Authentication required." };
    }

    let endpoint = `/me/player/shuffle?state=${shuffleState}`;
    if (deviceId) {
      endpoint += `&device_id=${deviceId}`;
    }

    const response = await fetchSpotifyApi(endpoint, tokenInfo.accessToken, {
      method: "PUT",
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error(
        `toggleShuffle Error (${response.status}): Failed to toggle shuffle.`,
        errorData
      );
      let errorMessage = "Failed to toggle shuffle.";
      if (response.status === 404)
        errorMessage = "Device not found or inactive.";
      if (response.status === 403) errorMessage = "Action forbidden.";
      return { success: false, error: errorMessage };
    }

    // Spotify returns 204 No Content on success
    console.log(`toggleShuffle Success: Shuffle state set to ${shuffleState}.`);
    return { success: true };
  } catch (error) {
    console.error("toggleShuffle Error: Unexpected error", error);
    return { success: false, error: "An unexpected error occurred." };
  }
}

// --- Save Track Action ---
export async function saveTrack(
  trackId: string
): Promise<{ success: boolean; error?: string }> {
  console.log(`Server Action: saveTrack called for track ${trackId}`);
  if (!trackId) {
    return { success: false, error: "Track ID is required." };
  }

  const tokenInfo = await getSpotifyAccessToken();
  if (tokenInfo.error || !tokenInfo.accessToken) {
    return {
      success: false,
      error: tokenInfo.error || "Spotify token unavailable.",
    };
  }

  try {
    const response = await fetchSpotifyApi(
      `/me/tracks`,
      tokenInfo.accessToken,
      {
        method: "PUT",
        body: JSON.stringify({ ids: [trackId] }), // Ensure trackId is used here
      }
    );

    if (!response.ok) {
      const errorData = await response.text(); // Read text for potential non-JSON errors
      console.error(
        `saveTrack Error (${response.status}): Failed to save track ${trackId}.`,
        errorData
      );
      let userError = "Failed to save track.";
      if (response.status === 401) {
        userError = "Authentication failed. Please re-login.";
      } else if (response.status === 403) {
        userError = "Permission denied (check scopes?).";
      } else if (response.status === 404) {
        userError = "Track not found.";
      }
      return { success: false, error: userError };
    }

    console.log(`saveTrack Success: Track ${trackId} saved.`);
    return { success: true };
  } catch (error) {
    console.error(
      `saveTrack Error: Unexpected error saving track ${trackId}.`,
      error
    );
    return { success: false, error: "An unexpected error occurred." };
  }
}

// --- Follow Playlist Action ---
export async function followPlaylist(
  playlistId: string
): Promise<{ success: boolean; error?: string }> {
  if (!playlistId) {
    return { success: false, error: "Playlist ID is required." };
  }

  const tokenInfo = await getSpotifyAccessToken();

  // Token Check (same as saveTrack)
  if (!tokenInfo || typeof tokenInfo !== "object") {
    return { success: false, error: "Invalid token info received." };
  }
  if ("error" in tokenInfo && typeof tokenInfo.error === "string") {
    return { success: false, error: tokenInfo.error };
  }
  if (
    !("accessToken" in tokenInfo) ||
    typeof tokenInfo.accessToken !== "string" ||
    !tokenInfo.accessToken
  ) {
    return {
      success: false,
      error: "Could not retrieve valid Spotify access token.",
    };
  }
  const accessToken = tokenInfo.accessToken;

  // Note: The API endpoint uses PUT, but doesn't strictly require a body for following.
  // Some docs suggest sending an empty body or `{"public": false}` might be needed,
  // but often just the PUT request is sufficient.
  const url = `https://api.spotify.com/v1/playlists/${playlistId}/followers`;

  try {
    const response = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        // "Content-Type": "application/json", // Often not needed for this endpoint
      },
      // body: JSON.stringify({}), // Optional empty body if required by Spotify
    });

    // Check for 200 OK (Success)
    if (response.status === 200) {
      console.log(`Successfully followed playlist: ${playlistId}`);
      return { success: true };
    } else {
      // Handle errors (e.g., 401 Unauthorized, 403 Forbidden, 404 Not Found)
      let errorDetails = `Spotify API Error: ${response.status} ${response.statusText}`;
      try {
        const errorBody = await response.json();
        errorDetails = errorBody?.error?.message || errorDetails;
      } catch (e) {
        console.error("Could not parse Spotify error response body:", e);
      }
      console.error(`Failed to follow playlist ${playlistId}: ${errorDetails}`);
      return { success: false, error: errorDetails };
    }
  } catch (error) {
    console.error(`Unexpected error following playlist ${playlistId}:`, error);
    return {
      success: false,
      error: "An unexpected error occurred while following the playlist.",
    };
  }
}

// --- Check Tracks Saved Action ---
export async function checkTracksSaved(
  trackIds: string[]
): Promise<{ data: boolean[] | null; error?: string }> {
  if (!trackIds || trackIds.length === 0) {
    return { data: [] }; // Return empty array if no IDs provided
  }
  // Spotify API limit is 50 IDs per request
  if (trackIds.length > 50) {
    return { data: null, error: "Cannot check more than 50 tracks at once." };
  }

  const tokenInfo = await getSpotifyAccessToken();

  // Token Check
  if (!tokenInfo || typeof tokenInfo !== "object") {
    return { data: null, error: "Invalid token info received." };
  }
  if ("error" in tokenInfo && typeof tokenInfo.error === "string") {
    return { data: null, error: tokenInfo.error };
  }
  if (
    !("accessToken" in tokenInfo) ||
    typeof tokenInfo.accessToken !== "string" ||
    !tokenInfo.accessToken
  ) {
    return {
      data: null,
      error: "Could not retrieve valid Spotify access token.",
    };
  }
  const accessToken = tokenInfo.accessToken;

  // Construct URL with query parameter
  const url = `https://api.spotify.com/v1/me/tracks/contains?ids=${trackIds.join(
    ","
  )}`;

  try {
    const response = await fetch(url, {
      method: "GET", // This is a GET request
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    // Check for 200 OK
    if (response.status === 200) {
      const data: boolean[] = await response.json();
      console.log(
        `Check tracks saved result for IDs [${trackIds.join(", ")}]:`,
        data
      );
      // Ensure response is an array of booleans matching input length
      if (
        Array.isArray(data) &&
        data.length === trackIds.length &&
        data.every((item) => typeof item === "boolean")
      ) {
        return { data: data };
      } else {
        console.error(
          "Spotify API Error: Invalid response format from /me/tracks/contains",
          data
        );
        return { data: null, error: "Invalid response format from Spotify." };
      }
    } else {
      // Handle errors
      let errorDetails = `Spotify API Error: ${response.status} ${response.statusText}`;
      try {
        const errorBody = await response.json();
        errorDetails = errorBody?.error?.message || errorDetails;
      } catch (e) {
        console.error("Could not parse Spotify error response body:", e);
      }
      console.error(
        `Failed to check saved tracks [${trackIds.join(", ")}]: ${errorDetails}`
      );
      return { data: null, error: errorDetails };
    }
  } catch (error) {
    console.error(
      `Unexpected error checking saved tracks [${trackIds.join(", ")}]:`,
      error
    );
    return {
      data: null,
      error: "An unexpected error occurred while checking saved tracks.",
    };
  }
}

// --- Check Playlist Followed Action ---
export async function checkPlaylistFollowed(
  playlistId: string
): Promise<{ isFollowing: boolean | null; error?: string }> {
  if (!playlistId) {
    return { isFollowing: null, error: "Playlist ID is required." };
  }

  const tokenInfo = await getSpotifyAccessToken();

  // Token Check (consistent with other actions)
  if (!tokenInfo || typeof tokenInfo !== "object") {
    return { isFollowing: null, error: "Invalid token info received." };
  }
  if ("error" in tokenInfo && typeof tokenInfo.error === "string") {
    return { isFollowing: null, error: tokenInfo.error };
  }
  if (
    !("accessToken" in tokenInfo) ||
    typeof tokenInfo.accessToken !== "string" ||
    !tokenInfo.accessToken
  ) {
    return {
      isFollowing: null,
      error: "Could not retrieve valid Spotify access token.",
    };
  }
  const accessToken = tokenInfo.accessToken;

  // We need the user's Spotify ID for this check
  // Note: Using a separate helper or including it here
  let userId: string | null = null;
  try {
    const meResponse = await fetch("https://api.spotify.com/v1/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store", // Ensure we get the user ID reliably
    });
    if (meResponse.ok) {
      const meData = await meResponse.json();
      userId = meData.id;
    } else {
      throw new Error(
        `Failed to get user ID: ${meResponse.status} ${meResponse.statusText}`
      );
    }
  } catch (error: unknown) {
    console.error("checkPlaylistFollowed Error: Failed to get user ID", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      isFollowing: null,
      error: `Failed to get user details: ${message}`,
    };
  }

  if (!userId) {
    return { isFollowing: null, error: "Could not determine Spotify User ID." };
  }

  // Construct URL for checking if the user follows the playlist
  const url = `https://api.spotify.com/v1/playlists/${playlistId}/followers/contains?ids=${userId}`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    // Check for 200 OK
    if (response.status === 200) {
      const data: boolean[] = await response.json();
      // The response is an array of booleans, one for each user ID checked.
      // Since we only check one user, we expect [true] or [false].
      if (
        Array.isArray(data) &&
        data.length === 1 &&
        typeof data[0] === "boolean"
      ) {
        console.log(
          `Check playlist ${playlistId} followed status for user ${userId}: ${data[0]}`
        );
        return { isFollowing: data[0] };
      } else {
        console.error(
          "Spotify API Error: Invalid response format from /playlists/.../followers/contains",
          data
        );
        return {
          isFollowing: null,
          error: "Invalid response format from Spotify.",
        };
      }
    } else {
      // Handle errors (401, 403, 404, etc.)
      let errorDetails = `Spotify API Error: ${response.status} ${response.statusText}`;
      try {
        const errorBody = await response.json();
        errorDetails = errorBody?.error?.message || errorDetails;
      } catch {
        // Ignore if error body isn't JSON
      }
      console.error(
        `Failed to check follow status for playlist ${playlistId}: ${errorDetails}`
      );
      return { isFollowing: null, error: errorDetails };
    }
  } catch (error: unknown) {
    console.error(
      `Unexpected error checking follow status for playlist ${playlistId}:`,
      error
    );
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      isFollowing: null,
      error: `An unexpected error occurred: ${message}`,
    };
  }
}

// --- Get Current Playback State ---

// --- Functions moved from spotify-api.ts ---

/**
 * Represents the structure of a playlist object returned by the Spotify API
 * (simplified to include only necessary fields).
 */
export interface SpotifyPlaylist {
  id: string;
  name: string;
  description: string | null;
  owner: {
    display_name?: string;
    id: string;
  };
  images: { url: string; height?: number | null; width?: number | null }[];
  tracks: {
    href: string;
    total: number;
  };
  uri: string;
  // Add other fields as needed from the Spotify API response
}

/**
 * Fetches a Spotify API access token using the Client Credentials flow.
 * Requires SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET environment variables.
 * Note: This is a simplified version. A production implementation should
 * securely cache the token and handle expiration/refresh.
 *
 * @returns {Promise<string | null>} The access token or null if an error occurred.
 */
export async function getSpotifyClientCredentialsToken(): Promise<
  string | null
> {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error(
      "Spotify API Error: SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET not set."
    );
    return null;
  }

  const authHeader = `Basic ${Buffer.from(
    `${clientId}:${clientSecret}`
  ).toString("base64")}`;

  try {
    const response = await fetch(SPOTIFY_ACCOUNTS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: authHeader,
      },
      body: "grant_type=client_credentials",
      cache: "no-store", // Consider caching strategy later
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error(
        `Spotify API Error (${response.status}): Failed to get client credentials token.`,
        errorData
      );
      return null;
    }

    const data = await response.json();
    return data.access_token || null;
  } catch (error) {
    console.error("Spotify API Error: Network error getting token.", error);
    return null;
  }
}

/**
 * Fetches detailed information for a specific Spotify playlist.
 * @param playlistId The ID of the Spotify playlist.
 * @returns A promise resolving to the playlist details or null if an error occurs.
 */
export async function getPlaylistDetails(
  playlistId: string
): Promise<SpotifyPlaylist | null> {
  if (!playlistId) {
    console.error("Playlist ID is required.");
    return null;
  }

  const token = await getSpotifyClientCredentialsToken();
  if (!token) {
    console.error("Failed to get Spotify token for getPlaylistDetails.");
    return null;
  }

  const url = `${SPOTIFY_API_BASE}/playlists/${playlistId}`; // Use existing SPOTIFY_API_BASE

  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store", // Consider caching strategy later
    });

    if (!response.ok) {
      console.error(
        `Error fetching playlist ${playlistId}: ${response.status} ${response.statusText}`
      );
      try {
        const errorBody = await response.json();
        console.error("Spotify API Error Body:", errorBody);
      } catch (parseError) {
        console.error("Could not parse error response body.", parseError); // Log parse error
      }
      return null;
    }

    const data: SpotifyPlaylist = await response.json();
    // Basic validation
    if (typeof data === "object" && data !== null && data.id === playlistId) {
      return data;
    } else {
      console.error(
        `Spotify API Error: Unexpected data format for playlist ${playlistId}`,
        data
      );
      return null;
    }
  } catch (error) {
    console.error(`Unexpected error fetching playlist ${playlistId}:`, error);
    return null;
  }
}
