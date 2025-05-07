import React, { Suspense } from "react";
import { Button } from "./ui/button";
import Link from "next/link";
import { LogoutButton } from "./logout-button";

export default function NavLinks() {
  return (
    <div className="flex flex-col gap-2">
      <Button variant="ghost" asChild>
        <Link href="/my-profile">My profile</Link>
      </Button>
      <Button variant="ghost" asChild>
        <Link href="/rooms">Music Rooms</Link>
      </Button>

      <Suspense fallback={null}>
        <LogoutButton />
      </Suspense>
    </div>
  );
}
