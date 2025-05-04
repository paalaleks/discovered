import { z } from "zod";

// Regular expression to match Spotify playlist IDs (22 alphanumeric characters)
const spotifyPlaylistIdRegex = /^[a-zA-Z0-9]{22}$/;

// Regular expression to match Spotify playlist URLs
// Handles open.spotify.com/playlist/..., spotify:playlist:...
const spotifyPlaylistUrlRegex =
  /^(https:\/\/open\.spotify\.com\/playlist\/|spotify:playlist:)([a-zA-Z0-9]{22})/; // Captures the ID

export const PlaylistInputSchema = z.object({
  roomId: z.string().uuid({ message: "Invalid Room ID format." }),
  playlistInput: z
    .string()
    .min(1, "Playlist ID or URL cannot be empty.")
    .refine(
      (input) =>
        spotifyPlaylistIdRegex.test(input) ||
        spotifyPlaylistUrlRegex.test(input),
      {
        message:
          "Invalid input. Please provide a valid Spotify Playlist ID (22 characters) or URL.",
      }
    ),
});

export type PlaylistInput = z.infer<typeof PlaylistInputSchema>;

// Helper function to extract playlist ID (can be used in Server Action)
export function extractSpotifyPlaylistId(input: string): string | null {
  // Check if it's just the ID
  if (spotifyPlaylistIdRegex.test(input)) {
    return input;
  }
  // Check if it's a URL and extract the ID
  const match = input.match(spotifyPlaylistUrlRegex);
  if (match && match[2]) {
    return match[2]; // The captured group with the 22-character ID
  }
  // Invalid format
  return null;
}

/**
 * Simplified playlist details for UI display.
 */
export interface SimplePlaylistDetails {
  spotify_playlist_id: string;
  name: string;
  owner?: string; // e.g., "Spotify" or user display name
  images?: { url: string; height?: number; width?: number }[]; // Array of images, typically used for cover art
  uri?: string; // e.g., "spotify:playlist:37i9dQZF1DXcBWIGoYBM5M"
  // Add other relevant fields if needed, like description or track count
}
