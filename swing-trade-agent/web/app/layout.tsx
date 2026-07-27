import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Swing Trade Signal Agent",
  description: "Decision-support chat agent — screening only, not financial advice.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
