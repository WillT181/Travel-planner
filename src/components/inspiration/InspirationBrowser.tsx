"use client";

import { useState } from "react";
import Link from "next/link";
import type { PostMeta } from "@/lib/blog/posts";

const CATEGORIES = [
  "All",
  "Guides",
  "Budget tips",
  "Packing lists",
  "Hidden gems",
] as const;
type Category = (typeof CATEGORIES)[number];

function coverUrl(seed: string) {
  return `https://picsum.photos/seed/${seed}/800/450`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function PostCard({ post }: { post: PostMeta }) {
  return (
    <Link
      href={`/blog/${post.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white transition hover:shadow-md"
    >
      <div className="aspect-[16/9] overflow-hidden bg-neutral-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={coverUrl(post.coverImage)}
          alt={post.title}
          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
        />
      </div>
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-primary-50 px-2.5 py-0.5 text-xs font-semibold text-primary-700">
            {post.category}
          </span>
          <span className="text-xs text-neutral-400">
            {post.readingTime} min read
          </span>
        </div>
        <h2 className="mt-3 text-lg font-bold leading-snug text-neutral-900 group-hover:text-primary-700">
          {post.title}
        </h2>
        <p className="mt-2 flex-1 text-sm leading-relaxed text-neutral-600 line-clamp-3">
          {post.description}
        </p>
        <p className="mt-4 text-xs text-neutral-400">{formatDate(post.date)}</p>
      </div>
    </Link>
  );
}

export default function InspirationBrowser({ posts }: { posts: PostMeta[] }) {
  const [activeCategory, setActiveCategory] = useState<Category>("All");

  const filtered =
    activeCategory === "All"
      ? posts
      : posts.filter((p) => p.category === activeCategory);

  return (
    <div>
      {/* Category filter pills */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setActiveCategory(cat)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
              activeCategory === cat
                ? "bg-primary-600 text-white"
                : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Posts grid */}
      {filtered.length > 0 ? (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((post) => (
            <PostCard key={post.slug} post={post} />
          ))}
        </div>
      ) : (
        <div className="mt-12 text-center text-neutral-500">
          <p className="text-lg">No posts in this category yet.</p>
          <p className="mt-1 text-sm">
            Check back soon — we publish new guides every week.
          </p>
        </div>
      )}
    </div>
  );
}
