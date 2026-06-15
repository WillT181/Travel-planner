"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function TripTabs({
  tripId,
  isPro,
}: {
  tripId: string;
  isPro: boolean;
}) {
  const pathname = usePathname();
  const base = `/trip/${tripId}`;
  const tabs = [
    { href: base, label: "Itinerary" },
    { href: `${base}/budget`, label: "Budget", pro: true },
  ];

  return (
    <nav
      className="mt-4 flex gap-1 border-b border-neutral-200"
      aria-label="Trip sections"
    >
      {tabs.map((tab) => {
        const active =
          tab.href === base ? pathname === base : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`-mb-px flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              active
                ? "border-primary-600 text-primary-700"
                : "border-transparent text-neutral-500 hover:border-neutral-300 hover:text-neutral-800"
            }`}
          >
            {tab.label}
            {tab.pro && !isPro && (
              <span className="rounded-full bg-accent-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent-700">
                Pro
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
