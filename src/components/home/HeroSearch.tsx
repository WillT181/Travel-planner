"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import DestinationSearch from "@/components/DestinationSearch";

const QUICK_PICKS = [
  { label: "Lisbon", href: "/explore/lisbon" },
  { label: "Tokyo", href: "/explore/japan/tokyo" },
  { label: "Bali", href: "/explore/bali" },
  { label: "Iceland", href: "/explore/iceland" },
] as const;

export default function HeroSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");

  /** Free text (button click, or Enter with nothing highlighted). */
  function submitFreeText(text: string) {
    const q = text.trim();
    router.push(q ? `/explore?q=${encodeURIComponent(q)}` : "/explore");
  }

  return (
    <div className="w-full max-w-xl">
      {/* Input + attached button (stacked on mobile) */}
      <div className="flex flex-col gap-3 sm:flex-row sm:gap-0">
        <DestinationSearch
          className="sm:min-w-0 sm:flex-1"
          placeholder="Where do you want to go?"
          inputClassName="sm:rounded-r-none sm:border-r-0 sm:focus:ring-offset-0"
          onQueryChange={setQuery}
          onSubmitText={submitFreeText}
          onSelect={(entry) => router.push(`/explore/${entry.slug}`)}
        />
        <button
          type="button"
          onClick={() => submitFreeText(query)}
          className="h-14 shrink-0 rounded-xl bg-primary-600 px-6 text-base font-semibold text-white shadow-sm transition-colors hover:bg-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-2 sm:rounded-l-none"
        >
          Start planning
        </button>
      </div>

      {/* Quick-pick chips */}
      <ul
        className="mt-4 flex flex-wrap items-center justify-center gap-2"
        aria-label="Popular destinations"
      >
        <li className="text-sm text-neutral-500">Popular:</li>
        {QUICK_PICKS.map(({ label, href }) => (
          <li key={label}>
            <Link
              href={href}
              className="inline-flex rounded-full border border-neutral-200 bg-white/80 px-3.5 py-1.5 text-sm font-medium text-neutral-700 transition-colors hover:border-primary-300 hover:bg-primary-50 hover:text-primary-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
            >
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
