"use client";

import { useState, useTransition } from "react";
// import { useRouter } from "next/navigation"; // Not needed as action redirects
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { createRoom } from "@/app/(protected)/rooms/actions"; // Import the Server Action
import { toast } from "sonner"; // Assuming sonner for toasts
// Re-use or import Zod schema if possible, but define here for clarity
const formSchema = z.object({
  roomName: z.string().optional(),
  playlistUrl: z.string().min(1, "Playlist URL/ID is required"), // Basic client-side required check
});

type FormData = z.infer<typeof formSchema>;

export function CreateRoomForm() {
  // const router = useRouter(); // Not needed
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      roomName: "",
      playlistUrl: "",
    },
  });

  async function onSubmit(values: FormData) {
    setServerError(null); // Clear previous errors

    // Create FormData object for the Server Action
    const formData = new FormData();
    if (values.roomName) {
      formData.append("roomName", values.roomName);
    }
    formData.append("playlistUrl", values.playlistUrl);

    startTransition(async () => {
      // Server action redirects on success, throws error on failure handled by Next.js
      // We catch potential validation errors returned *before* redirection/throw
      try {
        const result = await createRoom(undefined, formData);
        // If createRoom returns an error object instead of throwing/redirecting:
        if (result && !result.success) {
          const errorMessage = result.error || "An unexpected error occurred.";
          setServerError(errorMessage);
          toast.error(errorMessage); // Display error toast
        }
        // If createRoom *throws* an error on DB failure etc, it should be caught below
        // or handled by a Next.js error boundary.
      } catch (error) {
        // Catch errors thrown by the server action itself (e.g., during DB operation)
        const errorMessage =
          error instanceof Error
            ? error.message
            : "An unexpected error occurred during room creation.";
        setServerError(errorMessage);
        toast.error(errorMessage);
      }
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <FormField
          control={form.control}
          name="roomName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Room Name (Optional)</FormLabel>
              <FormControl>
                <Input placeholder="Enter a name for your room" {...field} />
              </FormControl>
              <FormDescription>
                If left blank, one might be generated based on the playlist.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="playlistUrl"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Spotify Playlist URL or ID</FormLabel>
              <FormControl>
                <Input
                  placeholder="https://open.spotify.com/playlist/... or ID"
                  {...field}
                />
              </FormControl>
              <FormDescription>
                The first playlist for your new room.
              </FormDescription>
              <FormMessage /> {/* Shows client-side validation errors */}
            </FormItem>
          )}
        />
        {serverError && (
          <p className="text-sm font-medium text-destructive">{serverError}</p>
        )}
        <Button type="submit" disabled={isPending}>
          {isPending ? "Creating Room..." : "Create Room"}
        </Button>
      </form>
    </Form>
  );
}
