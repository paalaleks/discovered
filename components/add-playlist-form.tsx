"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useEffect, useRef } from "react";
import { useFormState } from "react-dom";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { addPlaylistToRoom } from "@/lib/actions/supabase.actions";
import { PlaylistInputSchema } from "@/lib/types/index"; // Corrected import path

// Define a schema specifically for the form fields, excluding roomId
const FormSchema = PlaylistInputSchema.pick({ playlistInput: true });
type FormValues = z.infer<typeof FormSchema>;

interface AddPlaylistFormProps {
  roomId: string;
  onFormSuccess?: () => void; // Optional callback to close dialog on success
}

export function AddPlaylistForm({
  roomId,
  onFormSuccess,
}: AddPlaylistFormProps) {
  const form = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      playlistInput: "",
    },
  });

  // Server Action state
  const [state, formAction] = useFormState(addPlaylistToRoom, null);
  // Ref to track the previous state reference - Use the inferred type from useFormState
  const prevStateRef = useRef<typeof state>(null);

  // Handle form submission feedback
  useEffect(() => {
    // Check if the state object reference has changed and it's not the initial null
    if (state !== prevStateRef.current && state !== null) {
      // Check for the error property instead of success
      if (state.error) {
        // Only show error if there's a message
        toast.error("Failed to add playlist", { description: state.error });
      } else {
        // Assume success if there is no error property
        toast.success("Playlist added successfully!");
        form.reset(); // Reset form fields
        onFormSuccess?.(); // Call callback (e.g., close dialog)
      }
    }
    // Update the ref *after* the check for the next render
    prevStateRef.current = state;
    // Dependencies remain the same
  }, [state, form, onFormSuccess]);

  // Handle form submission - bind roomId to formData
  const handleSubmit = (formData: FormData) => {
    formData.append("roomId", roomId); // Add roomId before calling action
    formAction(formData);
  };

  return (
    <Form {...form}>
      {/* Use action prop for progressive enhancement */}
      <form action={handleSubmit} className="space-y-6">
        <FormField
          control={form.control}
          name="playlistInput"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Spotify Playlist ID or URL</FormLabel>
              <FormControl>
                <Input
                  placeholder="Enter playlist ID or https://open.spotify.com/playlist/..."
                  {...field}
                />
              </FormControl>
              <FormDescription>
                Enter the 22-character ID or the full URL of the public Spotify
                playlist.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Adding..." : "Add Playlist"}
        </Button>
      </form>
    </Form>
  );
}
