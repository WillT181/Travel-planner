import Link from "next/link";

export default function UpgradeCta() {
  return (
    <section
      id="pricing"
      aria-labelledby="cta-heading"
      className="px-[clamp(20px,5vw,56px)] py-[clamp(48px,7vw,96px)]"
    >
      <div
        className="relative mx-auto flex max-w-[880px] flex-col items-center gap-[18px] overflow-hidden rounded-[28px] px-[clamp(24px,5vw,56px)] py-[clamp(36px,6vw,64px)] text-center"
        style={{ background: "linear-gradient(150deg, #145C6B, #1E8A97)" }}
      >
        {/* Amber glow accent */}
        <div
          aria-hidden="true"
          className="absolute -right-[60px] -top-[60px] h-[220px] w-[220px] rounded-full bg-[#ED9B40]/25 blur-[2px]"
        />

        <h2
          id="cta-heading"
          className="relative max-w-[560px] font-display text-[clamp(28px,5vw,44px)] font-extrabold tracking-[-0.02em] text-[#FDFBF7] [text-wrap:pretty]"
        >
          Somewhere is waiting. Start the plan.
        </h2>
        <p className="relative max-w-[440px] text-base text-[#C9E7E9]">
          Free forever for your first trip. No card, no countdown.
        </p>
        <Link
          href="/itinerary"
          className="relative inline-flex min-h-[56px] items-center rounded-full bg-[#ED9B40] px-[34px] py-4 text-[17px] font-semibold text-[#3A2408] transition-all hover:-translate-y-px hover:bg-[#DE8B2F] focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#145C6B]"
        >
          Start planning — free
        </Link>
      </div>
    </section>
  );
}
