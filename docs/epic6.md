# Epic 6: Application Resilience

**Goal:** Ensure the application gracefully handles network interruptions and resumes state after browser sleep or visibility changes, providing a seamless user experience without requiring manual page reloads.

**Rationale:** Users frequently encounter network fluctuations or put their devices to sleep. The application must automatically recover its connections (Spotify Player SDK, Supabase Realtime) and state upon resuming to avoid errors and maintain usability. This is critical for long-running interactive sessions like chat rooms and music playback.

**Dependencies:**
- Epic 4: Music Player & Controls (Spotify SDK integration)
- Epic 5: Real-Time Chat & Mentions (Supabase Realtime integration)

**User Stories (Examples - to be refined):**

-   **Story 6.1:** As a user, when my computer wakes from sleep or my browser tab becomes visible again, the Spotify player should automatically attempt to reconnect so that music playback can resume or be controlled without errors.
    -   *Acceptance Criteria:*
        -   The `useSpotifyPlayerSDK` hook detects visibility/online changes.
        -   If the player is disconnected or in an error state upon resume, it attempts to disconnect the old instance and re-initialize/reconnect.
        -   The `getOAuthToken` callback handles potential network errors during the fetch call gracefully (e.g., retries).
        -   Errors related to failed reconnection are handled and potentially surfaced to the user non-intrusively.
-   **Story 6.2:** As a user, when my network connection is temporarily lost and then restored, or my browser tab becomes visible again, the chat interface should automatically re-establish its connection to the real-time service so that I don't miss messages and can continue chatting.
    -   *Acceptance Criteria:*
        -   The `useRealtimeChat` hook detects visibility/online changes and Supabase channel errors (`CHANNEL_ERROR`, `CLOSED`, `TIMED_OUT`).
        -   Upon detecting reconnection needs, the hook attempts to unsubscribe/resubscribe to the appropriate Supabase Realtime channel.
        -   Retry logic (e.g., exponential backoff) is implemented for connection attempts.
        -   Presence status is correctly updated upon successful reconnection.
-   **Story 6.3:** As a developer, browser event listeners (Page Visibility API, `navigator.onLine`) are implemented efficiently to detect relevant state changes without causing performance issues.
    -   *Acceptance Criteria:*
        -   Listeners are added and cleaned up correctly within relevant React hooks.
        -   Throttling/debouncing is used if necessary to prevent excessive checks.

**Non-Functional Requirements:**
- Recovery attempts should be efficient and not block the UI excessively.
- Error messages related to recovery failures should be clear but not overly disruptive.

**Out of Scope:**
- Handling server-side outages beyond client-side reconnection attempts.
- Complex state synchronization beyond re-establishing basic connections.

**Related Documents:**
- `ai/prd.md` (NFR: Resilience)
- `ai/architecture.md` (Resilience strategies for Spotify SDK and Supabase Realtime) 