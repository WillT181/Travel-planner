import Link from "next/link";
import PillSearch from "@/components/home/PillSearch";

const QUICK_PICKS = [
  { label: "Lisbon", href: "/explore/lisbon" },
  { label: "Kyoto", href: "/explore/kyoto" },
  { label: "Mexico City", href: "/explore/mexico/mexico-city" },
  { label: "Crete", href: "/explore/greece" },
  { label: "Marrakech", href: "/explore/marrakech" },
] as const;

export default function Hero() {
  return (
    <section
      className="flex flex-col items-center gap-[22px] px-[clamp(20px,5vw,56px)] pb-[clamp(48px,7vw,88px)] pt-[clamp(44px,8vw,96px)] text-center"
      style={{
        background:
          "radial-gradient(120% 90% at 50% 0%, #FBEEDC 0%, #FAF6EF 55%)",
      }}
    >
      <span className="rounded-full border border-[#F0D9B5] bg-[#FBEEDC] px-[15px] py-[7px] text-[13px] font-bold tracking-[0.04em] text-[#B06D14]">
        FREE TO START · NO CARD NEEDED
      </span>

      <h1 className="max-w-[760px] font-display text-[clamp(38px,7vw,68px)] font-extrabold leading-[1.04] tracking-[-0.025em] text-[#22303A] [text-wrap:pretty]">
        The fun part of the trip starts{" "}
        <em className="not-italic text-[#17727F]">before</em> you go
      </h1>

      <p className="max-w-[540px] text-[clamp(16px,2vw,19px)] leading-[1.55] text-[#5E6E76] [text-wrap:pretty]">
        Turn &ldquo;we should go somewhere&rdquo; into a day-by-day plan
        you&apos;ll actually follow — together, in minutes.
      </p>

      {/* Search + quick picks */}
      <div className="mt-2 flex w-full max-w-[640px] flex-col gap-3.5">
        <PillSearch />
        <div className="flex flex-wrap justify-center gap-2">
          {QUICK_PICKS.map(({ label, href }) => (
            <Link
              key={label}
              href={href}
              className="inline-flex min-h-[40px] items-center rounded-full bg-[#DFF1F2] px-4 py-2.5 text-[13.5px] font-semibold text-[#17727F] transition-colors hover:bg-[#C9E7E9] hover:text-[#145C6B] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1E8A97] focus-visible:ring-offset-2"
            >
              {label}
            </Link>
          ))}
        </div>
      </div>

      <span className="text-[13.5px] text-[#5E6E76]">
        Trusted by <strong className="text-[#22303A]">120k</strong> holiday
        planners · ★ 4.8 average
      </span>
    </section>
  );
}
