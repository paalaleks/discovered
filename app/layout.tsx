import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import Script from "next/script";
import { Suspense } from "react";
// import { PlayerContextProvider } from "@/lib/contexts/player-context";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Playlist Rooms",
  description: "Real-time chat rooms for Spotify playlists",
};

const cabinetGrotesk = localFont({
  src: "../public/fonts/CabinetGrotesk-Variable.ttf",
  variable: "--font-cabinet-grotesk",
  display: "swap",
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${cabinetGrotesk.variable} antialiased flex flex-col min-h-screen bg-sidepanels`}
      >
        <main className="flex-grow max-w-screen-xl mx-auto w-full bg-background">
          <Suspense fallback={<div>Loading...</div>}>{children}</Suspense>
        </main>
        <Toaster />
        <Script
          src="https://sdk.scdn.co/spotify-player.js"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
