"use client";

/* eslint-disable @next/next/no-img-element */

import { useMemo, useState } from "react";
import type { ImageEntry } from "@/lib/images";

const HERO_MIN_WIDTH = 2000;

type Filter = "all" | "unreviewed" | "selected";

export default function ReviewClient({
  initialData,
}: {
  initialData: Record<string, ImageEntry>;
}) {
  const [data, setData] = useState(initialData);
  const [filter, setFilter] = useState<Filter>("unreviewed");
  const [saving, setSaving] = useState<string | null>(null);

  const keys = useMemo(() => {
    const all = Object.keys(data).filter((k) => data[k].candidates?.length);
    if (filter === "unreviewed")
      return all.filter((k) => data[k].selected == null);
    if (filter === "selected")
      return all.filter((k) => data[k].selected != null);
    return all;
  }, [data, filter]);

  const total = Object.keys(data).filter(
    (k) => data[k].candidates?.length
  ).length;
  const done = Object.keys(data).filter((k) => data[k].selected != null).length;

  async function select(key: string, index: number | null) {
    setSaving(key);
    try {
      const res = await fetch("/dev/image-review/api", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, selected: index }),
      });
      if (res.ok) {
        setData((prev) => ({
          ...prev,
          [key]: { ...prev[key], selected: index },
        }));
      }
    } finally {
      setSaving(null);
    }
  }

  if (total === 0) {
    return (
      <div className="mx-auto max-w-xl py-20 text-center">
        <h1 className="text-2xl font-bold">No candidates yet</h1>
        <p className="mt-3 text-neutral-600">
          Run{" "}
          <code className="rounded bg-neutral-100 px-2 py-0.5">
            npm run images:fetch
          </code>{" "}
          first (needs <code>UNSPLASH_ACCESS_KEY</code> in .env.local), then
          reload this page to curate.
        </p>
      </div>
    );
  }

  return (
    <div className="pb-24">
      {/* Sticky header */}
      <div className="sticky top-16 z-20 -mx-4 mb-8 border-b border-neutral-200 bg-white/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold">Destination image review</h1>
            <p className="text-sm text-neutral-500">
              {done}/{total} curated — click the photo that best sells each
              place. Wrong-destination photos destroy trust: when in doubt,
              leave unselected and the site shows a branded gradient.
            </p>
          </div>
          <div className="flex gap-1.5">
            {(["unreviewed", "selected", "all"] as Filter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-full px-3.5 py-1.5 text-sm font-medium capitalize ${
                  filter === f
                    ? "bg-neutral-900 text-white"
                    : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      </div>

      {keys.length === 0 && (
        <p className="py-16 text-center text-neutral-500">
          Nothing in this filter —{" "}
          {done === total ? "all curated 🎉" : "switch filters."}
        </p>
      )}

      <div className="space-y-14">
        {keys.map((key) => {
          const entry = data[key];
          return (
            <section key={key} className="scroll-mt-32" id={key}>
              <div className="mb-3 flex flex-wrap items-baseline gap-3">
                <h2 className="text-xl font-bold">{key}</h2>
                <span className="text-sm text-neutral-500">
                  query: “{entry.query}”
                </span>
                {entry.selected != null ? (
                  <button
                    onClick={() => select(key, null)}
                    className="text-sm font-medium text-red-600 underline-offset-2 hover:underline"
                  >
                    Clear selection
                  </button>
                ) : (
                  <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                    unreviewed
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-3">
                {entry.candidates.map((c, i) => {
                  const isSelected = entry.selected === i;
                  const heroReady = c.width >= HERO_MIN_WIDTH;
                  return (
                    <button
                      key={c.id}
                      onClick={() => select(key, i)}
                      disabled={saving === key}
                      className={`group rounded-2xl border-2 p-3 text-left transition-colors ${
                        isSelected
                          ? "border-emerald-500 bg-emerald-50"
                          : "border-neutral-200 bg-white hover:border-neutral-400"
                      }`}
                    >
                      {/* Hero crop preview (21:9) */}
                      <div className="relative aspect-[21/9] w-full overflow-hidden rounded-lg bg-neutral-100">
                        <img
                          src={c.regularUrl}
                          alt={c.alt ?? key}
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                        {isSelected && (
                          <span className="absolute right-2 top-2 rounded-full bg-emerald-500 px-2.5 py-1 text-xs font-bold text-white">
                            ✓ Selected
                          </span>
                        )}
                      </div>

                      {/* Card + square crop previews */}
                      <div className="mt-2 flex gap-2">
                        <div className="relative aspect-[4/3] w-1/2 overflow-hidden rounded-md bg-neutral-100">
                          <img
                            src={c.regularUrl}
                            alt=""
                            loading="lazy"
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <div className="relative aspect-square w-1/3 overflow-hidden rounded-md bg-neutral-100">
                          <img
                            src={c.regularUrl}
                            alt=""
                            loading="lazy"
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <div
                          className="w-1/6 rounded-md"
                          style={{ background: c.color }}
                          title={`dominant ${c.color}`}
                        />
                      </div>

                      <div className="mt-2 flex items-center justify-between gap-2 text-xs text-neutral-500">
                        <span className="truncate">
                          #{i + 1} · {c.photographer} · {c.width}×{c.height}
                        </span>
                        {heroReady ? (
                          <span className="shrink-0 font-semibold text-emerald-600">
                            hero-ready
                          </span>
                        ) : (
                          <span className="shrink-0 font-semibold text-amber-600">
                            cards only (&lt;2000px)
                          </span>
                        )}
                      </div>
                      {c.alt && (
                        <p className="mt-1 line-clamp-2 text-xs text-neutral-400">
                          {c.alt}
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
