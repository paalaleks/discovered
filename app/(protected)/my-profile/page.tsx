import { MyProfile } from "@/components/my-profile";
import { NavProtected } from "@/components/nav-protected";
import { Suspense } from "react";

export default function MyProfilePage() {
  return (
    <>
      <NavProtected />
      <Suspense fallback={<div>Loading...</div>}>
        <MyProfile />
      </Suspense>
    </>
  );
}
