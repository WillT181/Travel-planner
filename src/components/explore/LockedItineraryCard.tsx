"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Button, { buttonVariants } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";

interface LockedItineraryCardProps {
  destinationSlug: string;
  destinationName: string;
}

function LockIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="locked-modal-title"
    >
      <div
        className="absolute inset-0 bg-neutral-900/50"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative w-full max-w-md animate-[fadeIn_0.2s_ease-out] rounded-2xl bg-white p-6 shadow-xl sm:p-8">
        <h2
          id="locked-modal-title"
          className="text-xl font-bold tracking-tight text-neutral-900"
        >
          {title}
        </h2>
        <div className="mt-3 text-neutral-600">{children}</div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close dialog"
          className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-lg text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export default function LockedItineraryCard({
  destinationSlug,
  destinationName,
}: LockedItineraryCardProps) {
  const [open, setOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Read the current session in the browser so the page itself stays static.
  useEffect(() => {
    const supabase = createClient();
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active) setIsLoggedIn(Boolean(data.session));
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="group relative w-full overflow-hidden rounded-2xl border border-neutral-200 bg-gradient-to-br from-primary-50 to-white p-6 text-left shadow-sm transition-shadow hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-100 px-3 py-1 text-xs font-semibold text-accent-700">
              <LockIcon />
              Pro
            </span>
            <h3 className="mt-3 text-xl font-bold tracking-tight text-neutral-900">
              See the full 7-day itinerary
            </h3>
            <p className="mt-1 text-neutral-600">
              Unlock every day, hand-picked restaurants, hidden gems, and a
              packing checklist for {destinationName}.
            </p>
          </div>
          <span className="hidden shrink-0 text-primary-600 sm:block">
            <LockIcon />
          </span>
        </div>

        {/* Blurred teaser rows */}
        <div className="mt-5 space-y-2" aria-hidden="true">
          {[
            "Day 4 · Coastal villages & a long lunch",
            "Day 5 · Hidden viewpoints",
            "Day 6 · Local market & cooking class",
            "Day 7 · Farewell sunset",
          ].map((line) => (
            <div
              key={line}
              className="select-none rounded-lg bg-white/70 px-3 py-2 text-sm text-neutral-400 blur-[2px]"
            >
              {line}
            </div>
          ))}
        </div>

        <span className="mt-5 inline-block font-semibold text-primary-700 group-hover:text-primary-800">
          Unlock full itinerary →
        </span>
      </button>

      {open ? (
        isLoggedIn ? (
          <Modal title="Upgrade to Pro" onClose={() => setOpen(false)}>
            <p>
              Full multi-day itineraries are a Pro feature. Upgrade to unlock
              the complete 7-day plan for {destinationName} — plus unlimited
              trips, offline maps, and collaborative planning.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/pricing"
                className={buttonVariants({
                  variant: "primary",
                  size: "lg",
                  className: "w-full sm:w-auto",
                })}
              >
                Upgrade to Pro
              </Link>
              <Button
                variant="ghost"
                size="lg"
                onClick={() => setOpen(false)}
                className="w-full sm:w-auto"
              >
                Maybe later
              </Button>
            </div>
          </Modal>
        ) : (
          <Modal
            title="Create a free account to continue"
            onClose={() => setOpen(false)}
          >
            <p>
              Sign up free to save trips and preview more of the{" "}
              {destinationName} itinerary. Upgrade any time for the full 7-day
              plan.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link
                href={`/signup?returnTo=/explore/${destinationSlug}`}
                className={buttonVariants({
                  variant: "primary",
                  size: "lg",
                  className: "w-full sm:w-auto",
                })}
              >
                Sign up free
              </Link>
              <Link
                href={`/login?returnTo=/explore/${destinationSlug}`}
                className={buttonVariants({
                  variant: "ghost",
                  size: "lg",
                  className: "w-full sm:w-auto",
                })}
              >
                I already have an account
              </Link>
            </div>
          </Modal>
        )
      ) : null}
    </>
  );
}
