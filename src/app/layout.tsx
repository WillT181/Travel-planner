import type { Metadata } from "next";
import { Inter, Bricolage_Grotesque, Instrument_Sans } from "next/font/google";
import Navbar from "@/components/nav/Navbar";
import Footer from "@/components/layout/Footer";
import CookieConsent from "@/components/consent/CookieConsent";
import Analytics from "@/components/consent/Analytics";
import "@/styles/globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

// Homepage redesign (claude.ai/design "Wanderly Home") display + body faces.
const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
  display: "swap",
});

const instrument = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-instrument",
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
    <html
      lang="en"
      className={`${inter.variable} ${bricolage.variable} ${instrument.variable}`}
    >
      <body className="flex min-h-dvh flex-col">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-primary-600 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
        >
          Skip to content
        </a>
        <Navbar />
        <main
          id="main-content"
          className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8"
        >
          {children}
        </main>
        <Footer />
        <CookieConsent />
        <Analytics />
      </body>
    </html>
  );
}
