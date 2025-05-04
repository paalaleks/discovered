import type { ChatMessage } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDistanceToNowStrict } from "date-fns";
import { Trash2, AlertCircle, Pencil, X, Check } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { useState, useEffect } from "react";
import { useDeviceType } from "@/hooks/use-device-type";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface ChatMessageItemProps {
  message: ChatMessage;
  isOwnMessage: boolean;
  showHeader: boolean;
  currentUserId?: string;
  onDelete?: (messageId: string) => void;
  onEdit?: (messageId: string, newContent: string) => Promise<void>;
}

export const ChatMessageItem = ({
  message,
  isOwnMessage,
  showHeader,
  currentUserId,
  onDelete,
  onEdit,
}: ChatMessageItemProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(message.content);
  const [isSaving, setIsSaving] = useState(false);
  const { isTouchDevice } = useDeviceType();
  const [popoverOpen, setPopoverOpen] = useState(false);

  useEffect(() => {
    if (!isEditing) {
      setEditedContent(message.content);
    }
  }, [message.content, isEditing]);

  const canModify =
    (onDelete || onEdit) &&
    currentUserId === message.user.id &&
    (message.status === "sent" || message.status === undefined);

  const hasFailed = message.status === "failed";

  const timeAgo = formatDistanceToNowStrict(new Date(message.createdAt), {
    addSuffix: true,
  });

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase();
  };

  const handleEdit = () => {
    console.log(
      "[ChatMessageItem] handleEdit triggered for message:",
      message.id
    );
    setIsEditing(true);
    setPopoverOpen(false);
  };

  const handleCancelEdit = () => {
    console.log("[ChatMessageItem] handleCancelEdit triggered");
    setIsEditing(false);
    setEditedContent(message.content);
  };

  const handleSaveEdit = async () => {
    console.log("[ChatMessageItem] handleSaveEdit triggered. Saving:", {
      id: message.id,
      content: editedContent.trim(),
    });
    if (
      !onEdit ||
      editedContent.trim() === message.content ||
      isSaving ||
      !editedContent.trim()
    ) {
      console.log(
        "[ChatMessageItem] handleSaveEdit: Skipping save (no change, no onEdit, isSaving, or empty)"
      );
      return;
    }
    setIsSaving(true);
    try {
      console.log("[ChatMessageItem] Calling onEdit...");
      await onEdit(message.id, editedContent.trim());
      console.log("[ChatMessageItem] onEdit finished successfully.");
      setIsEditing(false);
    } catch (error) {
      console.error("[ChatMessageItem] Failed to save edit:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = () => {
    console.log(
      "[ChatMessageItem] handleDelete triggered for message:",
      message.id
    );
    if (!onDelete) return;
    onDelete(message.id);
    setPopoverOpen(false);
  };

  const MessageContent = (
    <div
      className={cn(
        "relative max-w-xs sm:max-w-md md:max-w-lg rounded-lg px-3 py-2 text-sm group",
        {
          "bg-primary text-primary-foreground": isOwnMessage,
          "bg-muted": !isOwnMessage,
          "rounded-tr-none": isOwnMessage && showHeader,
          "rounded-tl-none": !isOwnMessage && showHeader,
        }
      )}
    >
      {isEditing ? (
        <div className="flex flex-col gap-1">
          <Input
            value={editedContent}
            onChange={(e) => setEditedContent(e.target.value)}
            className="h-8 bg-background text-foreground"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSaveEdit();
              } else if (e.key === "Escape") {
                handleCancelEdit();
              }
            }}
          />
          <div className="flex justify-end gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
              onClick={handleCancelEdit}
              title="Cancel edit"
            >
              <X className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-green-600 hover:text-green-700 disabled:opacity-50"
              onClick={handleSaveEdit}
              disabled={
                isSaving ||
                editedContent.trim() === message.content ||
                !editedContent.trim()
              }
              title="Save edit"
            >
              <Check className="size-4" />
            </Button>
          </div>
        </div>
      ) : (
        <p className="break-words whitespace-pre-wrap">{message.content}</p>
      )}

      {!isEditing && (
        <span
          className={cn(
            "absolute bottom-0.5 text-[10px] text-muted-foreground/70 flex items-center gap-1",
            isOwnMessage ? "left-1.5" : "right-1.5",
            "group-hover:opacity-0 transition-opacity duration-150"
          )}
          style={{ bottom: "-1.2em" }}
          title={new Date(message.createdAt).toLocaleString()}
          suppressHydrationWarning={true}
        >
          {hasFailed && (
            <span title="Failed to send">
              <AlertCircle className="size-3 text-destructive" />
            </span>
          )}
          {timeAgo}
        </span>
      )}

      {canModify && !isEditing && !isTouchDevice && (
        <div
          className={cn(
            "absolute top-1/2 -translate-y-1/2 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity bg-secondary rounded-md p-1",
            isOwnMessage ? "left-[-70px]" : "right-[-70px]"
          )}
        >
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-foreground"
            onClick={handleEdit}
            title="Edit message"
          >
            <Pencil className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-destructive/70 hover:text-destructive"
            onClick={handleDelete}
            title="Delete message"
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      )}
    </div>
  );

  const MessageWrapper = ({ children }: { children: React.ReactNode }) =>
    isTouchDevice && canModify && !isEditing ? (
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>{children}</PopoverTrigger>
        <PopoverContent className="w-auto p-1">
          <div className="flex flex-col gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="justify-start px-2 py-1 h-auto"
              onClick={handleEdit}
            >
              <Pencil className="size-4 mr-2" /> Edit
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="justify-start px-2 py-1 h-auto text-destructive hover:text-destructive"
              onClick={handleDelete}
            >
              <Trash2 className="size-4 mr-2" /> Delete
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    ) : (
      <>{children}</>
    );

  return (
    <div
      className={cn("relative flex w-full mb-2", {
        "justify-end": isOwnMessage,
        "justify-start": !isOwnMessage,
        "opacity-60": message.status === "pending",
      })}
    >
      {!isOwnMessage && showHeader && (
        <Avatar className="size-6 mr-2 self-end mb-1">
          <AvatarImage
            src={message.user.avatarUrl}
            alt={`${message.user.name}'s avatar`}
          />
          <AvatarFallback className="text-xs">
            {getInitials(message.user.name)}
          </AvatarFallback>
        </Avatar>
      )}

      <div
        className={cn("flex flex-col", {
          "items-end": isOwnMessage,
          "items-start": !isOwnMessage,
        })}
      >
        {showHeader && (
          <div className={cn("flex items-center gap-2 mb-1", {})}>
            <span className="text-xs font-semibold text-muted-foreground">
              {isOwnMessage ? "You" : message.user.name}
            </span>
          </div>
        )}
        <MessageWrapper>{MessageContent}</MessageWrapper>
      </div>

      {isOwnMessage && showHeader && (
        <Avatar className="size-6 ml-2 self-end mb-1">
          <AvatarImage
            src={message.user.avatarUrl}
            alt={`${message.user.name}'s avatar`}
          />
          <AvatarFallback className="text-xs">
            {getInitials(message.user.name)}
          </AvatarFallback>
        </Avatar>
      )}
    </div>
  );
};
