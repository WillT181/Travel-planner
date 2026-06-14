import type { Metadata } from "next";
import Navbar from "@/components/nav/Navbar";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: {
    default: "Wanderly — Plan Your Perfect Trip",
    template: "%s | Wanderly",
  },
  description:
    "Wanderly helps you discover destinations, build itineraries, and organise all your travel plans in one place.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-dvh">
        <Navbar />
        <main
          id="main-content"
          className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8"
        >
          {children}
        </main>
      </body>
    </html>
  );
}
