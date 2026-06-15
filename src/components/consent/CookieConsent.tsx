"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getConsent, setConsent } from "@/lib/analytics";

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  // Only decide visibility on the client to avoid a hydration mismatch.
  useEffect(() => {
    setVisible(getConsent() === null);
  }, []);

  if (!visible) return null;

  function choose(value: "accepted" | "declined") {
    setConsent(value);
    setVisible(false);
  }

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Cookie consent"
      className="fixed inset-x-0 bottom-0 z-50 px-4 pb-4"
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-4 rounded-2xl border border-neutral-200 bg-white p-5 shadow-lg sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-neutral-700">
          We use essential cookies to keep you signed in. With your consent
          we&apos;ll also use analytics cookies to improve Wanderly. See our{" "}
          <Link
            href="/privacy"
            className="font-semibold text-primary-700 underline underline-offset-2 hover:text-primary-800"
          >
            privacy policy
          </Link>
          .
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => choose("declined")}
            className="rounded-lg px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400"
          >
            Decline
          </button>
          <button
            type="button"
            onClick={() => choose("accepted")}
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-2"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
