import type { Metadata } from "next";
import { notFound } from "next/navigation";
import fs from "fs";
import path from "path";
import ReviewClient from "./ReviewClient";
import type { ImageEntry } from "@/lib/images";

export const metadata: Metadata = {
  title: "Image review",
  robots: { index: false },
};

// Always re-read images.json — the whole point is editing it live.
export const dynamic = "force-dynamic";

export default function ImageReviewPage() {
  // Dev-only tool: the curation data ships at build time, so this page has
  // no business existing in production.
  if (process.env.NODE_ENV === "production") notFound();

  const file = path.join(process.cwd(), "src/data/destinations/images.json");
  const data = (
    fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : {}
  ) as Record<string, ImageEntry>;

  return <ReviewClient initialData={data} />;
}
