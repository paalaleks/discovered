"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner"; // Assuming sonner for toasts
import { CopyIcon, CheckIcon } from "@radix-ui/react-icons"; // Using Radix icons

type CopyInviteButtonProps = {
  roomId: string;
  isDJ: boolean;
};

export function CopyInviteButton({ roomId, isDJ }: CopyInviteButtonProps) {
  const [copied, setCopied] = useState(false);

  if (!isDJ) {
    return null; // Don't render the button if the user is not the DJ
  }

  const handleCopy = async () => {
    // Construct the full URL - Ensure NEXT_PUBLIC_SITE_URL is set in env!
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
    const inviteUrl = `${siteUrl}/rooms/${roomId}`;

    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      toast.success("Invite link copied to clipboard!");
      // Reset the copied state after a delay
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy text: ", err);
      toast.error("Failed to copy link.");
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleCopy}
      className="ml-auto"
    >
      {copied ? (
        <CheckIcon className="mr-2 h-4 w-4" />
      ) : (
        <CopyIcon className="mr-2 h-4 w-4" />
      )}
      {copied ? "Copied!" : "Copy Invite Link"}
    </Button>
  );
}
