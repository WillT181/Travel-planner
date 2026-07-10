import Link from "next/link";

const COPY = {
  trips: {
    heading: "You've filled all 3 free trips",
    body: "Nice going — you're clearly a planner. Upgrade to Pro for unlimited trips, collaboration, and offline access.",
  },
  days: {
    heading: "Planning a longer adventure?",
    body: "Free trips cover 5 days of planning. Go Pro to plan trips of any length, invite travel mates, and more.",
  },
} as const;

export default function UpgradeCard({
  variant,
  className = "",
}: {
  variant: keyof typeof COPY;
  className?: string;
}) {
  const { heading, body } = COPY[variant];
  return (
    <div
      className={`rounded-2xl border border-accent-200 bg-gradient-to-br from-accent-50 to-primary-50 p-5 ${className}`}
    >
      <p className="text-sm font-bold text-neutral-900">{heading}</p>
      <p className="mt-1.5 text-sm leading-relaxed text-neutral-600">{body}</p>
      <Link
        href="/pricing"
        className="mt-3 inline-flex items-center rounded-lg bg-accent-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2"
      >
        See Pro plans →
      </Link>
    </div>
  );
}
