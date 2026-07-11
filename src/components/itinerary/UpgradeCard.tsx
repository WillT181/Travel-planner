import Link from "next/link";

const COPY = {
  trips: {
    heading: "You've filled all 3 free trips",
    body: "Nice going — you're clearly a planner. Pro removes every limit, works offline, and lets your whole crew edit together.",
  },
  days: {
    heading: "This trip is getting good — unlock more days",
    body: "Free trips cover 5 days of planning. Pro removes every limit, works offline, and lets your whole crew edit together.",
  },
} as const;

/**
 * Upgrade prompt — an invitation, never a wall (Wanderly design system).
 */
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
      className={`flex flex-col gap-2.5 rounded-[20px] border border-[#F0D9B5] p-[22px] ${className}`}
      style={{ background: "linear-gradient(150deg, #FBEEDC, #FDFBF7 70%)" }}
    >
      <span className="text-xs font-bold uppercase tracking-[0.08em] text-[#B06D14]">
        ✦ Wanderly Pro
      </span>
      <span className="font-display text-xl font-bold leading-tight text-[#22303A]">
        {heading}
      </span>
      <span className="text-sm leading-normal text-[#5E6E76]">{body}</span>
      <div className="mt-1 flex flex-wrap gap-2.5">
        <Link
          href="/pricing"
          className="inline-flex min-h-[44px] items-center rounded-full bg-[#ED9B40] px-5 py-2.5 text-sm font-semibold text-[#3A2408] transition-colors hover:bg-[#DE8B2F] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1E8A97] focus-visible:ring-offset-2"
        >
          See Pro
        </Link>
      </div>
    </div>
  );
}
