import React from "react";
import { render, act, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import {
  PlayerContextProvider,
  usePlayerContext,
} from "@/lib/contexts/player-context";
import * as sdkHook from "@/hooks/use-spotify-player-sdk";
import * as actions from "@/lib/actions/spotify.actions";
import * as navigation from "next/navigation";
import * as sonner from "sonner";

// Mock dependencies
jest.mock("@/hooks/use-spotify-player-sdk");
jest.mock("@/app/(protected)/spotify/actions");
jest.mock("next/navigation", () => ({
  usePathname: jest.fn(),
}));
jest.mock("sonner", () => ({
  toast: {
    info: jest.fn(),
    success: jest.fn(),
    error: jest.fn(),
  },
}));

// Type mocks
const mockUseSpotifyPlayerSDK = sdkHook.useSpotifyPlayerSDK as jest.Mock;
const mockCheckTracksSaved = actions.checkTracksSaved as jest.Mock;
const mockSaveTrack = actions.saveTrack as jest.Mock;
const mockUsePathname = navigation.usePathname as jest.Mock;
const mockToast = sonner.toast;

// Mock PlaybackState type (simplified)
type MockPlaybackState = {
  track_window: {
    current_track: Spotify.Track | null;
  };
  // Add other properties if needed by the context logic being tested
} | null;

// Mock Track type
const mockTrackPlayableOnly: Spotify.Track = {
  id: "playable123",
  uri: "spotify:track:playable123",
  name: "Playable Track",
  artists: [{ name: "Artist A", uri: "spotify:artist:aaa", url: "" }],
  album: {
    uri: "spotify:album:abc",
    name: "Album X",
    images: [{ url: "http://example.com/image.jpg", height: 640, width: 640 }],
  },
  duration_ms: 200000,
  is_playable: true,
  linked_from: { id: null, uri: null },
  type: "track",
  media_type: "audio",
  uid: "mock-uid-123",
  track_type: "audio",
};

const mockTrackWithLink: Spotify.Track = {
  ...mockTrackPlayableOnly,
  id: "playable456",
  uri: "spotify:track:playable456",
  linked_from: {
    id: "original789",
    uri: "spotify:track:original789",
  },
  name: mockTrackPlayableOnly.name,
  artists: mockTrackPlayableOnly.artists,
  album: mockTrackPlayableOnly.album,
  duration_ms: mockTrackPlayableOnly.duration_ms,
  is_playable: mockTrackPlayableOnly.is_playable,
  type: mockTrackPlayableOnly.type,
  media_type: mockTrackPlayableOnly.media_type,
  uid: "mock-uid-456",
  track_type: "audio",
};

// Helper component to consume context
const TestConsumerComponent = () => {
  const context = usePlayerContext();
  return (
    <div>
      <span data-testid="original-track-id">
        {context.originalTrackId ?? "null"}
      </span>
      <span data-testid="is-saved">
        {context.isCurrentTrackSaved.toString()}
      </span>
      <button onClick={context.saveCurrentTrack}>Save Track</button>
    </div>
  );
};

describe("PlayerContext - Track Relinking Logic", () => {
  let mockSetPlaybackState: (state: MockPlaybackState) => void;
  let mockSetCurrentTrack: (track: Spotify.Track | null) => void;

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset mock return values for each test
    mockUsePathname.mockReturnValue("/rooms/some-room-id");
    mockCheckTracksSaved.mockResolvedValue({ data: [false], error: undefined });
    mockSaveTrack.mockResolvedValue({ success: true });

    // Setup mutable state for the mocked hook
    let currentPlaybackState: MockPlaybackState = null;
    let currentTrackState: Spotify.Track | null = null;

    mockSetPlaybackState = (state) => {
      currentPlaybackState = state;
    };
    mockSetCurrentTrack = (track) => {
      currentTrackState = track;
    };

    mockUseSpotifyPlayerSDK.mockImplementation(() => ({
      player: null,
      isReady: true,
      deviceId: "mockDeviceId",
      isActive: true,
      currentTrack: currentTrackState, // Use mutable state
      playbackState: currentPlaybackState, // Use mutable state
    }));
  });

  test("should set originalTrackId and check saved status using linked_from.id when track is relinked", async () => {
    const { rerender } = render(
      <PlayerContextProvider>
        <TestConsumerComponent />
      </PlayerContextProvider>
    );

    // Initial state (no track)
    expect(screen.getByTestId("original-track-id")).toHaveTextContent("null");
    expect(mockCheckTracksSaved).not.toHaveBeenCalled();

    // Simulate SDK hook updating with a relinked track
    act(() => {
      mockSetCurrentTrack(mockTrackWithLink); // Context logic depends on currentTrack from SDK hook
      mockSetPlaybackState({
        track_window: { current_track: mockTrackWithLink },
      });
    });
    // Rerender with updated mock hook values
    rerender(
      <PlayerContextProvider>
        <TestConsumerComponent />
      </PlayerContextProvider>
    );

    // Wait for async effect (checkTracksSaved)
    await waitFor(() => {
      expect(screen.getByTestId("original-track-id")).toHaveTextContent(
        "original789" // linked_from.id
      );
    });
    await waitFor(() => {
      expect(mockCheckTracksSaved).toHaveBeenCalledTimes(1);
      expect(mockCheckTracksSaved).toHaveBeenCalledWith(["original789"]); // Called with linked_from.id
    });
  });

  test("should set originalTrackId to null and check saved status using playable id when track is not relinked", async () => {
    const { rerender } = render(
      <PlayerContextProvider>
        <TestConsumerComponent />
      </PlayerContextProvider>
    );

    // Simulate SDK hook updating with a non-relinked track
    act(() => {
      mockSetCurrentTrack(mockTrackPlayableOnly);
      mockSetPlaybackState({
        track_window: { current_track: mockTrackPlayableOnly },
      });
    });
    rerender(
      <PlayerContextProvider>
        <TestConsumerComponent />
      </PlayerContextProvider>
    );

    // Wait for async effect
    await waitFor(() => {
      expect(screen.getByTestId("original-track-id")).toHaveTextContent("null");
    });
    await waitFor(() => {
      expect(mockCheckTracksSaved).toHaveBeenCalledTimes(1);
      expect(mockCheckTracksSaved).toHaveBeenCalledWith(["playable123"]); // Called with playable id
    });
  });

  test("should reset originalTrackId and saved status when playback state becomes null", async () => {
    mockCheckTracksSaved.mockResolvedValueOnce({ data: [true] }); // Assume initially saved

    const { rerender } = render(
      <PlayerContextProvider>
        <TestConsumerComponent />
      </PlayerContextProvider>
    );

    // Setup initial state with a track
    act(() => {
      mockSetCurrentTrack(mockTrackWithLink);
      mockSetPlaybackState({
        track_window: { current_track: mockTrackWithLink },
      });
    });
    rerender(
      <PlayerContextProvider>
        <TestConsumerComponent />
      </PlayerContextProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("original-track-id")).toHaveTextContent(
        "original789"
      );
      expect(screen.getByTestId("is-saved")).toHaveTextContent("true");
    });

    // Simulate playback stopping (state becomes null)
    act(() => {
      mockSetCurrentTrack(null);
      mockSetPlaybackState(null);
    });
    rerender(
      <PlayerContextProvider>
        <TestConsumerComponent />
      </PlayerContextProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("original-track-id")).toHaveTextContent("null");
      expect(screen.getByTestId("is-saved")).toHaveTextContent("false");
    });
  });

  test("saveCurrentTrack should call saveTrack action with linked_from.id when track is relinked", async () => {
    const { rerender } = render(
      <PlayerContextProvider>
        <TestConsumerComponent />
      </PlayerContextProvider>
    );

    // Simulate SDK hook updating with a relinked track
    act(() => {
      mockSetCurrentTrack(mockTrackWithLink);
      mockSetPlaybackState({
        track_window: { current_track: mockTrackWithLink },
      });
    });
    rerender(
      <PlayerContextProvider>
        <TestConsumerComponent />
      </PlayerContextProvider>
    );

    // Wait for initial checks
    await waitFor(() => {
      expect(mockCheckTracksSaved).toHaveBeenCalledTimes(1);
    });

    // Click the save button
    await act(async () => {
      screen.getByText("Save Track").click();
    });

    expect(mockSaveTrack).toHaveBeenCalledTimes(1);
    expect(mockSaveTrack).toHaveBeenCalledWith("original789"); // Called with linked_from.id
    await waitFor(() => {
      expect(mockToast.success).toHaveBeenCalledWith(
        "Track saved to your Liked Songs!"
      );
    });
  });

  test("saveCurrentTrack should call saveTrack action with playable id when track is not relinked", async () => {
    const { rerender } = render(
      <PlayerContextProvider>
        <TestConsumerComponent />
      </PlayerContextProvider>
    );

    // Simulate SDK hook updating with a non-relinked track
    act(() => {
      mockSetCurrentTrack(mockTrackPlayableOnly);
      mockSetPlaybackState({
        track_window: { current_track: mockTrackPlayableOnly },
      });
    });
    rerender(
      <PlayerContextProvider>
        <TestConsumerComponent />
      </PlayerContextProvider>
    );

    // Wait for initial checks
    await waitFor(() => {
      expect(mockCheckTracksSaved).toHaveBeenCalledTimes(1);
    });

    // Click the save button
    await act(async () => {
      screen.getByText("Save Track").click();
    });

    expect(mockSaveTrack).toHaveBeenCalledTimes(1);
    expect(mockSaveTrack).toHaveBeenCalledWith("playable123"); // Called with playable id
    await waitFor(() => {
      expect(mockToast.success).toHaveBeenCalledWith(
        "Track saved to your Liked Songs!"
      );
    });
  });

  test("saveCurrentTrack should not call saveTrack action if track is already saved", async () => {
    mockCheckTracksSaved.mockResolvedValue({ data: [true] }); // Mock track as already saved

    const { rerender } = render(
      <PlayerContextProvider>
        <TestConsumerComponent />
      </PlayerContextProvider>
    );

    // Simulate SDK hook updating with a non-relinked track
    act(() => {
      mockSetCurrentTrack(mockTrackPlayableOnly);
      mockSetPlaybackState({
        track_window: { current_track: mockTrackPlayableOnly },
      });
    });
    rerender(
      <PlayerContextProvider>
        <TestConsumerComponent />
      </PlayerContextProvider>
    );

    // Wait for initial checks
    await waitFor(() => {
      expect(screen.getByTestId("is-saved")).toHaveTextContent("true");
    });

    // Click the save button
    await act(async () => {
      screen.getByText("Save Track").click();
    });

    expect(mockSaveTrack).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(mockToast.info).toHaveBeenCalledWith("Track already saved.");
    });
  });
});
