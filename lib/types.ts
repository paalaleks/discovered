// This file defines shared data types used across the application.

// import type { Tables } from "./types/database.types";

// Remove unused MessageRow alias if ChatMessage defines all fields directly
// type MessageRow = Tables<"messages">;

// Basic Profile structure
export type UserProfile = {
  id: string;
  name: string;
  avatarUrl?: string;
};

// Type for chat messages, combining DB structure with UserProfile
export type ChatMessage = {
  id: string; // Use string for consistency, even if DB is number
  createdAt: string; // ISO 8601 format
  updatedAt: string; // ISO 8601 format
  content: string;
  roomId: string;
  isDeleted: boolean;
  user: UserProfile;
  status?: "pending" | "sent" | "failed"; // Added for optimistic UI
  _key?: string; // Internal: Stable key for React during optimistic->confirmed transition
};

// Add other shared types here as needed
// export type UserProfile = { ... };
