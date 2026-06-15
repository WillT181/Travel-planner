import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Navbar from "@/components/nav/Navbar";
import Footer from "@/components/layout/Footer";
import "@/styles/globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Wanderly — Plan Your Perfect Trip",
    template: "%s | Wanderly",
  },
  description:
    "Discover destinations, build day-by-day itineraries, and keep every travel plan beautifully organised — all in one place.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="flex min-h-dvh flex-col">
        <Navbar />
        <main
          id="main-content"
          className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8"
        >
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
