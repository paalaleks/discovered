import { saveTrack } from "@/lib/actions/spotify.actions";
import { createClient } from "@/lib/supabase/server";
import { User, SupabaseClient } from "@supabase/supabase-js"; // Import SupabaseClient directly

// Mock dependencies
jest.mock("@/lib/supabase/server");

// Mock global fetch
global.fetch = jest.fn();

// Type mocks
const mockCreateClient = createClient as jest.MockedFunction<
  typeof createClient
>;
const mockFetch = global.fetch as jest.Mock;

// Helper to mock Supabase auth chain
const mockSupabaseAuth = (
  userData: { user: User } | null = null,
  userError: { message: string; status?: number } | null = null
) => {
  const mockGetUser = jest
    .fn()
    .mockResolvedValue({ data: userData, error: userError });
  const mockUpdateUser = jest.fn().mockResolvedValue({ data: {}, error: null });

  const mockAuth = {
    getUser: mockGetUser,
    updateUser: mockUpdateUser,
  };

  const mockSupabaseInstance = {
    auth: mockAuth,
  } as unknown as SupabaseClient;

  mockCreateClient.mockResolvedValue(mockSupabaseInstance);
  // Return the mocked instance or specific mocks if needed for setup, but not usually for assertion
  return { mockGetUser, mockUpdateUser }; // Return specific mocks if needed elsewhere
};

describe("Spotify Server Actions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset process.env mocks if any were set
    // process.env = { ...originalEnv };
  });

  describe("saveTrack", () => {
    const testTrackId = "testTrack123";
    const mockAccessToken = "mock-access-token";
    const mockUser = {
      user: {
        id: "user-id",
        app_metadata: { provider: "spotify" },
        user_metadata: {
          provider_token: mockAccessToken,
          provider_token_expires_at: Date.now() / 1000 + 3600,
        },
        aud: "authenticated",
        created_at: new Date().toISOString(),
      } as User,
    };

    test("should save track successfully with valid token and trackId", async () => {
      mockSupabaseAuth(mockUser);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        // No body needed for successful PUT /me/tracks
      });

      const result = await saveTrack(testTrackId);

      expect(mockCreateClient).toHaveBeenCalledTimes(1);
      // Assert against the mock resolved by createClient
      const supabaseInstance = await mockCreateClient.mock.results[0].value;
      expect(supabaseInstance.auth.getUser).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        `https://api.spotify.com/v1/me/tracks`,
        expect.objectContaining({
          method: "PUT",
          headers: expect.objectContaining({
            Authorization: `Bearer ${mockAccessToken}`,
            "Content-Type": "application/json",
          }),
          body: JSON.stringify({ ids: [testTrackId] }),
        })
      );
      expect(result).toEqual({ success: true });
    });

    test("should return error if trackId is missing", async () => {
      const result = await saveTrack(""); // Pass empty string
      expect(result).toEqual({
        success: false,
        error: "Track ID is required.",
      });
      expect(mockCreateClient).not.toHaveBeenCalled();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    test("should return error if user is not authenticated", async () => {
      // Simulate auth error by passing an error object
      const authError = { message: "Auth error", status: 401 };
      mockSupabaseAuth(null, authError);

      const result = await saveTrack(testTrackId);

      expect(mockCreateClient).toHaveBeenCalledTimes(1);
      // Assert against the mock resolved by createClient
      const supabaseInstance = await mockCreateClient.mock.results[0].value;
      expect(supabaseInstance.auth.getUser).toHaveBeenCalledTimes(1);
      // Check the specific error message expected from getSpotifyAccessToken
      expect(result).toEqual({
        success: false,
        error: "Authentication required.",
      });
      expect(mockFetch).not.toHaveBeenCalled();
    });

    test("should return error if access token is missing in metadata", async () => {
      const userMissingToken = {
        user: {
          id: "user-id",
          app_metadata: { provider: "spotify" },
          user_metadata: {},
          aud: "authenticated",
          created_at: new Date().toISOString(),
        } as User,
      };
      mockSupabaseAuth(userMissingToken);

      const result = await saveTrack(testTrackId);

      expect(mockCreateClient).toHaveBeenCalledTimes(1);
      // Assert against the mock resolved by createClient
      const supabaseInstance = await mockCreateClient.mock.results[0].value;
      expect(supabaseInstance.auth.getUser).toHaveBeenCalledTimes(1);
      expect(result).toEqual({
        success: false,
        error: "Could not retrieve Spotify access token.",
      });
      expect(mockFetch).not.toHaveBeenCalled();
    });

    test("should return specific error on Spotify API 401 (Unauthorized)", async () => {
      mockSupabaseAuth(mockUser);
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => "Invalid access token", // Mock text() method
      });

      const result = await saveTrack(testTrackId);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(result).toEqual({
        success: false,
        error: "Authentication failed. Please re-login.",
      });
    });

    test("should return specific error on Spotify API 403 (Forbidden)", async () => {
      mockSupabaseAuth(mockUser);
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        text: async () => "Insufficient scope",
      });

      const result = await saveTrack(testTrackId);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(result).toEqual({
        success: false,
        error: "Permission denied (check scopes?).",
      });
    });

    test("should return specific error on Spotify API 404 (Not Found)", async () => {
      mockSupabaseAuth(mockUser);
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => "Invalid track id",
      });

      const result = await saveTrack(testTrackId);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ success: false, error: "Track not found." });
    });

    test("should return generic error on other Spotify API errors", async () => {
      mockSupabaseAuth(mockUser);
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => "Internal Server Error",
      });

      const result = await saveTrack(testTrackId);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(result).toEqual({
        success: false,
        error: "Failed to save track.",
      }); // Default error message
    });

    test("should return generic error on fetch network error", async () => {
      mockSupabaseAuth(mockUser);
      mockFetch.mockRejectedValueOnce(new Error("Network error")); // Simulate fetch throwing an error

      const result = await saveTrack(testTrackId);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(result).toEqual({
        success: false,
        error: "An unexpected error occurred.",
      });
    });

    // Add test for token refresh if saveTrack implicitly uses it via getSpotifyAccessToken
    // This depends on how getSpotifyAccessToken is structured and tested separately.
    // Assuming getSpotifyAccessToken handles refresh, we just need to ensure saveTrack gets the token.
  });

  // Add describe blocks for other actions (getSpotifyAccessToken, refreshSpotifyToken, checkTracksSaved, etc.) if needed
  // ...
});
