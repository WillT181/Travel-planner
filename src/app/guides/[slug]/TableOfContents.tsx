"use client";

import { useEffect, useState } from "react";

export interface TocHeading {
  id: string;
  text: string;
}

export default function TableOfContents({
  headings,
}: {
  headings: TocHeading[];
}) {
  const [activeId, setActiveId] = useState<string>("");

  useEffect(() => {
    if (headings.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Pick the topmost entry that is intersecting
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) {
          setActiveId(visible[0].target.id);
        }
      },
      // Top margin accounts for sticky nav (~64px); bottom margin pushes
      // intersection threshold so the active section tracks near the top
      // of the viewport rather than the middle.
      { rootMargin: "-72px 0% -55% 0%", threshold: 0 }
    );

    headings.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [headings]);

  if (headings.length === 0) return null;

  return (
    <nav aria-label="Table of contents">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
        On this page
      </p>
      <ol className="space-y-1.5 border-l border-neutral-200 pl-4">
        {headings.map(({ id, text }) => (
          <li key={id}>
            <a
              href={`#${id}`}
              className={[
                "block py-0.5 text-sm leading-snug transition-colors",
                activeId === id
                  ? "font-semibold text-primary-700"
                  : "text-neutral-500 hover:text-neutral-800",
              ].join(" ")}
            >
              {text}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
