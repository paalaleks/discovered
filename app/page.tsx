import { Nav } from "@/components/nav";
import Link from "next/link";

export default async function Home() {
  return (
    <>
      <Nav />
      <div className="container mx-auto p-4">
        <main className="flex flex-col items-center gap-8 pt-10">
          <h1 className="text-3xl font-bold">Welcome to Playlist Chat Rooms</h1>
          <p>Create or join rooms to chat about Spotify playlists.</p>
          <Link href="/rooms">
            <button className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
              Go to Rooms / Create Room
            </button>
          </Link>
        </main>
      </div>
    </>
  );
}
