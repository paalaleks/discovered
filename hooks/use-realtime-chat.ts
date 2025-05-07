import { createClient } from "@/lib/supabase/client";
import { RealtimeChannel } from "@supabase/supabase-js";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatMessage, UserProfile } from "@/lib/types";

interface UseRealtimeChatProps {
  roomId: string;
  userId: string;
  username: string;
  initialMessages?: ChatMessage[];
  userProfile?: Pick<UserProfile, "name" | "avatarUrl">;
}

interface UseRealtimeChatReturn {
  messages: ChatMessage[];
  sendMessage: (content: string) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;
  editMessage: (messageId: string, newContent: string) => Promise<void>;
  isConnected: boolean;
}

export const useRealtimeChat = ({
  roomId,
  userId,
  username,
  initialMessages = [],
  userProfile,
}: UseRealtimeChatProps): UseRealtimeChatReturn => {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [isConnected, setIsConnected] = useState(false);
  const channel = useRef<RealtimeChannel | null>(null);
  const supabase = createClient();

  const updateLocalMessage = useCallback(
    (messageId: string, updates: Partial<ChatMessage>) => {
      setMessages((prevMessages) =>
        prevMessages.map((msg) =>
          msg.id === messageId ? { ...msg, ...updates } : msg
        )
      );
    },
    []
  );

  const sendMessage = useCallback(
    async (content: string): Promise<void> => {
      if (!userId || !roomId) {
        console.error("User ID or Room ID missing, cannot send message.");
        return;
      }

      const tempId = crypto.randomUUID();
      const optimisticMessage: ChatMessage = {
        id: tempId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        content: content,
        roomId: roomId,
        isDeleted: false,
        user: {
          id: userId,
          name: userProfile?.name ?? username,
          avatarUrl: userProfile?.avatarUrl,
        },
        status: "pending",
        _key: tempId,
      };

      setMessages((prevMessages) => [...prevMessages, optimisticMessage]);

      const messageData = {
        room_id: roomId,
        user_id: userId,
        content: content,
      };

      const { error } = await supabase.from("messages").insert(messageData);

      if (error) {
        console.error("Error inserting message:", error);
        updateLocalMessage(tempId, { status: "failed" });
      }
    },
    [supabase, roomId, userId, username, userProfile, updateLocalMessage]
  );

  const deleteMessage = useCallback(
    async (messageId: string): Promise<void> => {
      if (!channel.current) return;

      const messageToDelete = messages.find((msg) => msg.id === messageId);
      if (!messageToDelete) return;

      setMessages((prevMessages) =>
        prevMessages.filter((msg) => msg.id !== messageId)
      );

      const messageIdAsNumber = parseInt(messageId, 10);
      if (isNaN(messageIdAsNumber)) {
        console.error("Invalid message ID format for deletion:", messageId);
        return;
      }

      const { error } = await supabase.rpc("delete_message", {
        message_id: messageIdAsNumber,
      });

      if (error) {
        console.error("Error deleting message:", error);
        setMessages((prevMessages) =>
          [...prevMessages, messageToDelete].sort((a, b) =>
            a.createdAt.localeCompare(b.createdAt)
          )
        );
      }
    },
    [supabase, messages]
  );

  const editMessage = useCallback(
    async (messageId: string, newContent: string): Promise<void> => {
      console.log(
        `[useRealtimeChat] editMessage called: msgId=${messageId}, newContent="${newContent}"`
      );
      if (!supabase || !messageId || !newContent.trim()) {
        console.warn(
          "[useRealtimeChat] editMessage: Aborting (missing supabase, messageId, or newContent)"
        );
        return Promise.reject("Missing required data for edit."); // Indicate failure
      }

      const messageIdAsNumber = parseInt(messageId, 10);
      if (isNaN(messageIdAsNumber)) {
        console.error(
          "[useRealtimeChat] editMessage: Invalid message ID format for editing:",
          messageId
        );
        return Promise.reject("Invalid message ID format."); // Indicate failure
      }

      let originalMessageContent: string | undefined;
      let originalUpdatedAt: string | undefined;

      // Perform optimistic update using functional setMessages

      setMessages((currentMessages) => {
        const messageIndex = currentMessages.findIndex(
          (msg) => msg.id === messageId
        );
        if (messageIndex === -1) {
          console.warn(
            `[useRealtimeChat] editMessage: Message ${messageId} not found inside setMessages callback.`
          );

          // Don't update state if message not found
          return currentMessages;
        }

        const messageToUpdate = currentMessages[messageIndex];
        if (messageToUpdate.content === newContent.trim()) {
          // No actual change, return current state but resolve promise later
          return currentMessages;
        }

        originalMessageContent = messageToUpdate.content;
        originalUpdatedAt = messageToUpdate.updatedAt;

        const updatedMessages = [...currentMessages];
        updatedMessages[messageIndex] = {
          ...messageToUpdate,
          content: newContent.trim(),
          updatedAt: new Date().toISOString(),
          // Keep status as 'sent' or whatever it was, don't mark as 'pending'
        };
        return updatedMessages.sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
      });

      // Check if the message was actually found and content was different before proceeding
      if (originalMessageContent === undefined) {
        // This means the message wasn't found in the functional update
        // We already logged a warning inside setMessages
        return Promise.reject(`Message ${messageId} not found.`); // Indicate failure
      }
      if (originalMessageContent === newContent.trim()) {
        // This means content was the same
        return Promise.resolve(); // Indicate success (as no change needed)
      }

      try {
        const { error } = await supabase
          .from("messages")
          .update({
            content: newContent.trim(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", messageIdAsNumber)
          .eq("user_id", userId);

        if (error) {
          console.error(
            "[useRealtimeChat] editMessage: Error updating message in Supabase:",
            error
          );

          // Revert optimistic update on failure using functional update
          setMessages((currentMessages) =>
            currentMessages
              .map((msg) =>
                msg.id === messageId
                  ? {
                      ...msg,
                      content: originalMessageContent!,
                      updatedAt: originalUpdatedAt!,
                    }
                  : msg
              )
              .sort(
                (a, b) =>
                  new Date(a.createdAt).getTime() -
                  new Date(b.createdAt).getTime()
              )
          );
          throw error; // Re-throw error to indicate failure to the component
        }

        // No need to update state here, optimistic update is already done
        // and Supabase broadcast should handle external updates
        return Promise.resolve(); // Indicate success
      } catch (error) {
        console.error(
          "[useRealtimeChat] editMessage: Exception during Supabase call or revert:",
          error
        );
        // Attempt to revert if not already done
        if (originalMessageContent !== undefined) {
          setMessages((currentMessages) =>
            currentMessages
              .map((msg) =>
                msg.id === messageId
                  ? {
                      ...msg,
                      content: originalMessageContent!,
                      updatedAt: originalUpdatedAt!,
                    }
                  : msg
              )
              .sort(
                (a, b) =>
                  new Date(a.createdAt).getTime() -
                  new Date(b.createdAt).getTime()
              )
          );
        }
        throw error; // Re-throw error after attempting revert
      }
    },
    [supabase, userId]
  );

  useEffect(() => {
    if (!roomId) {
      console.log(
        "[useRealtimeChat Effect] Skipping setup: roomId is undefined/falsy."
      );
      return;
    }

    const channelName = `chat:${roomId}`;

    channel.current = supabase
      .channel(channelName, {
        config: {
          broadcast: { self: true },
          presence: { key: username },
        },
      })
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `room_id=eq.${roomId}`,
        },
        async (payload) => {
          if (payload.eventType === "INSERT") {
            const newMessage = payload.new as {
              id: number;
              created_at: string;
              updated_at: string;
              content: string;
              room_id: string;
              is_deleted: boolean;
              user_id: string;
            };
            if (!newMessage || !newMessage.id) {
              console.warn("Received INSERT without new data or ID:", payload);
              return;
            }
            let userName = "Unknown User";
            let userAvatarUrl: string | undefined = undefined;
            const { data: profile, error: profileError } = await supabase
              .from("profiles")
              .select("display_name, avatar_url")
              .eq("id", newMessage.user_id)
              .single();

            if (profileError) {
              console.error(
                `Error fetching profile for user ${newMessage.user_id}:`,
                profileError
              );
            } else if (profile) {
              userName = profile.display_name || userName;
              userAvatarUrl = profile.avatar_url || undefined;
            }

            const dbMessage: ChatMessage = {
              id: newMessage.id.toString(),
              createdAt: newMessage.created_at,
              updatedAt: newMessage.updated_at,
              content: newMessage.content,
              roomId: newMessage.room_id,
              isDeleted: newMessage.is_deleted,
              user: {
                id: newMessage.user_id,
                name: userName,
                avatarUrl: userAvatarUrl,
              },
              status: "sent",
            };

            setMessages((prevMessages) => {
              const existingIndex = prevMessages.findIndex(
                (m) => m.id === dbMessage.id
              );
              if (existingIndex !== -1) {
                if (prevMessages[existingIndex].status === "pending") {
                  const updated = [...prevMessages];
                  updated[existingIndex] = {
                    ...dbMessage,
                    _key: prevMessages[existingIndex]._key,
                  };
                  return updated.sort(
                    (a, b) =>
                      new Date(a.createdAt).getTime() -
                      new Date(b.createdAt).getTime()
                  );
                }
                return prevMessages;
              }

              const pendingIndex = prevMessages.findIndex(
                (msg) =>
                  msg.status === "pending" &&
                  msg.user.id === dbMessage.user.id &&
                  msg.content === dbMessage.content
              );

              if (pendingIndex !== -1) {
                const updatedMessages = [...prevMessages];
                updatedMessages[pendingIndex] = {
                  ...dbMessage,
                  _key: prevMessages[pendingIndex]._key,
                };
                return updatedMessages.sort((a, b) =>
                  a.createdAt.localeCompare(b.createdAt)
                );
              } else {
                return [
                  ...prevMessages,
                  { ...dbMessage, _key: dbMessage.id },
                ].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
              }
            });
          } else if (payload.eventType === "UPDATE") {
            const updatedRecord = payload.new as {
              id: number;
              content: string;
              updated_at: string;
              is_deleted: boolean;
            };
            if (!updatedRecord || !updatedRecord.id) {
              console.warn("Received UPDATE without new data or ID:", payload);
              return;
            }
            updateLocalMessage(updatedRecord.id.toString(), {
              content: updatedRecord.content,
              updatedAt: updatedRecord.updated_at,
              isDeleted: updatedRecord.is_deleted,
            });
          } else if (payload.eventType === "DELETE") {
            const deletedRecord = payload.old as { id?: number };
            if (!deletedRecord || !deletedRecord.id) {
              console.warn("Received DELETE without old data or ID:", payload);
              return;
            }
            setMessages((prevMessages) =>
              prevMessages.filter(
                (msg) => msg.id !== deletedRecord.id?.toString()
              )
            );
          }
        }
      )
      .on("presence", { event: "sync" }, () => {
        if (!channel.current) return;
        channel.current.presenceState(); // Call is needed even if result isn't used
        // console.log("Presence sync:", presenceState);
      })
      .on("presence", { event: "join" }, () => {
        // console.log("Presence join:", key, newPresences);
      })
      .on("presence", { event: "leave" }, () => {
        // console.log("Presence leave:", key, leftPresences);
      })
      .subscribe((status) => {
        // console.log(`Realtime channel status for "${channelName}": ${status}`);
        if (status === "SUBSCRIBED") {
          setIsConnected(true);
          channel.current?.track({ user: username, user_id: userId });
        } else {
          setIsConnected(false);
        }
      });

    return () => {
      if (channel.current) {
        supabase.removeChannel(channel.current);
        channel.current = null;
      }
    };
  }, [roomId, supabase, userId, username, updateLocalMessage]);

  return { messages, sendMessage, deleteMessage, editMessage, isConnected };
};
