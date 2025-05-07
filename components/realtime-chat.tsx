"use client";

import { cn } from "@/lib/utils";
import { ChatMessageItem } from "@/components/chat-message";
import { useChatScroll } from "@/hooks/use-chat-scroll";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useRealtimeChat } from "@/hooks/use-realtime-chat";
import type { ChatMessage } from "@/lib/types";
import { ScrollArea } from "@radix-ui/react-scroll-area";

interface RealtimeChatProps {
  roomId: string;
  userId: string;
  username: string;
  initialMessages?: ChatMessage[];
  onMessage?: (messages: ChatMessage[]) => void;
  messages?: ChatMessage[];
}

/**
 * Realtime chat component
 * @param roomId - The ID (UUID) of the room to join.
 * @param userId - The user ID of the user
 * @param username - The username of the user
 * @param onMessage - The callback function to handle the messages. Useful if you want to store the messages in a database.
 * @param messages - The messages to display in the chat. Useful if you want to display messages from a database.
 * @returns The chat component
 */
export const RealtimeChat = ({
  roomId,
  userId,
  username,
  initialMessages = [],
  onMessage,
}: RealtimeChatProps) => {
  const { containerRef, scrollToBottom } = useChatScroll();

  const {
    messages: allMessages,
    sendMessage,
    deleteMessage,
    editMessage,
    isConnected,
  } = useRealtimeChat({
    roomId,
    userId,
    username,
    initialMessages,
  });
  const [newMessage, setNewMessage] = useState("");

  useEffect(() => {
    if (onMessage) {
      onMessage(allMessages);
    }
  }, [allMessages, onMessage]);

  useEffect(() => {
    // Scroll to bottom whenever messages change
    scrollToBottom();
  }, [allMessages, scrollToBottom]);

  const handleSendMessage = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!newMessage.trim() || !isConnected) return;

      sendMessage(newMessage);
      setNewMessage("");
    },
    [newMessage, isConnected, sendMessage]
  );

  return (
    <div className="flex flex-col h-full w-full  antialiased">
      {/* Messages container now uses ScrollArea */}
      {/* The ref remains on this inner div which holds the messages */}
      <ScrollArea
        ref={containerRef}
        className="flex flex-col-reverse space-y-4 space-y-reverse h-[calc(100dvh-7.8rem)] overflow-y-auto w-full p-4 scrollbar-hide [-ms-overflow-style:none] [scrollbar-width:none]"
      >
        {allMessages.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground">
            No messages yet. Start the conversation!
          </div>
        ) : null}
        <div className="space-y-3">
          {allMessages.map((message, index) => {
            const prevMessage = index > 0 ? allMessages[index - 1] : null;
            const isOwn = message.user.id === userId;
            const isPending = message.status === "pending";

            let showHeader =
              !prevMessage || prevMessage.user.id !== message.user.id;

            if (isOwn && isPending) {
              showHeader = false;
            }

            return (
              <div key={message._key ?? message.id}>
                <ChatMessageItem
                  message={message}
                  isOwnMessage={isOwn}
                  showHeader={showHeader}
                  currentUserId={userId}
                  onDelete={deleteMessage}
                  onEdit={editMessage}
                />
              </div>
            );
          })}
        </div>
      </ScrollArea>

      <form
        onSubmit={handleSendMessage}
        className="flex w-full gap-2 border-t border-border p-4"
      >
        <Input
          className={cn(
            "rounded-full bg-background text-sm transition-all duration-300",
            isConnected && newMessage.trim() ? "w-[calc(100%-36px)]" : "w-full"
          )}
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type a message..."
          disabled={!isConnected}
        />
        {isConnected && newMessage.trim() && (
          <Button
            className="aspect-square rounded-full animate-in fade-in slide-in-from-right-4 duration-300"
            type="submit"
            disabled={!isConnected}
          >
            <Send className="size-4" />
          </Button>
        )}
      </form>
    </div>
  );
};
