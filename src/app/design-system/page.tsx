import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Design system",
  description:
    "Wanderly's design system — golden-hour planning, boarding-pass tactility. Colour, typography, and component reference.",
  robots: { index: false },
};

// ─── palette data ────────────────────────────────────────────────────────────

const CORE_COLORS = [
  { name: "teal-700", hex: "#145C6B" },
  { name: "teal-600 · primary", hex: "#17727F" },
  { name: "teal-500", hex: "#1E8A97" },
  { name: "teal-100 · tint", hex: "#DFF1F2" },
  { name: "amber-500 · CTA", hex: "#ED9B40" },
  { name: "amber-600 · hover", hex: "#DE8B2F" },
  { name: "amber-100 · tint", hex: "#FBEEDC" },
  { name: "sand · page bg", hex: "#FAF6EF" },
  { name: "paper · surface", hex: "#FDFBF7" },
  { name: "ink · text", hex: "#22303A" },
  { name: "ink-muted", hex: "#5E6E76" },
  { name: "line · borders", hex: "#E7DECB" },
];

const SEMANTIC_COLORS = [
  { name: "success", hex: "#3E8E5A" },
  { name: "warn", hex: "#D98E2B" },
  { name: "danger", hex: "#C6543F" },
];

const TYPE_SCALE = [
  {
    label: "display / 52",
    size: 52,
    weight: 800,
    display: true,
    ls: "-0.02em",
  },
  { label: "h1 / 36", size: 36, weight: 700, display: true, ls: "-0.015em" },
  { label: "h2 / 26", size: 26, weight: 700, display: true, ls: "-0.01em" },
  { label: "h3 / 19", size: 19, weight: 600, display: true, ls: "0" },
  { label: "body / 16", size: 16, weight: 400, display: false, ls: "0" },
];

// ─── small helpers ───────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-display text-[26px] font-bold tracking-[-0.01em]">
      {children}
    </h2>
  );
}

function SpecLabel({ children }: { children: React.ReactNode }) {
  return <span className="font-mono text-xs text-[#5E6E76]">{children}</span>;
}

// ─── page ────────────────────────────────────────────────────────────────────

export default function DesignSystemPage() {
  return (
    <div className="relative left-1/2 -my-8 w-screen -translate-x-1/2 bg-[#FAF6EF] font-instrument text-[#22303A]">
      <div className="mx-auto flex max-w-[1120px] flex-col gap-16 px-5 py-[clamp(24px,5vw,64px)] pb-24 sm:px-8 lg:px-12">
        {/* ── Header ── */}
        <header className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2.5">
            <div
              className="grid h-[34px] w-[34px] place-items-center rounded-[11px] font-display text-lg font-extrabold text-[#FDFBF7]"
              style={{
                background: "linear-gradient(135deg, #1E8A97, #145C6B)",
              }}
            >
              W
            </div>
            <span className="font-display text-xl font-bold tracking-[-0.01em]">
              Wanderly
            </span>
            <span className="ml-1 rounded-full bg-[#F1E9DA] px-2.5 py-1 text-xs font-semibold text-[#5E6E76]">
              Design system · v1
            </span>
          </div>
          <h1 className="max-w-[640px] font-display text-[clamp(32px,5vw,52px)] font-extrabold leading-[1.05] tracking-[-0.02em]">
            Golden-hour planning, boarding-pass tactility.
          </h1>
          <p className="max-w-[560px] text-[17px] leading-[1.55] text-[#5E6E76] [text-wrap:pretty]">
            Warm, optimistic, trustworthy. Ocean teal for structure and trust;
            sunset amber for moments of action; sand neutrals so every page
            feels like paper, not glass.
          </p>
          <nav className="mt-1 flex flex-wrap gap-3">
            <Link
              href="/"
              className="rounded-full border border-[#E7DECB] bg-[#FDFBF7] px-4 py-2 text-sm font-semibold text-[#17727F] hover:bg-[#DFF1F2]"
            >
              Homepage →
            </Link>
            <Link
              href="/itinerary"
              className="rounded-full border border-[#E7DECB] bg-[#FDFBF7] px-4 py-2 text-sm font-semibold text-[#17727F] hover:bg-[#DFF1F2]"
            >
              Itinerary builder →
            </Link>
          </nav>
        </header>

        {/* ── Color ── */}
        <section className="flex flex-col gap-5">
          <SectionTitle>Color</SectionTitle>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {CORE_COLORS.map((c) => (
              <div
                key={c.name}
                className="overflow-hidden rounded-2xl border border-[#E7DECB] bg-[#FDFBF7]"
              >
                <div className="h-[84px]" style={{ background: c.hex }} />
                <div className="px-3 py-2.5">
                  <div className="text-[13px] font-semibold">{c.name}</div>
                  <div className="font-mono text-xs text-[#5E6E76]">
                    {c.hex}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {SEMANTIC_COLORS.map((c) => (
              <div
                key={c.name}
                className="flex items-center gap-2.5 rounded-2xl border border-[#E7DECB] bg-[#FDFBF7] p-3.5"
              >
                <span
                  className="h-7 w-7 flex-none rounded-[9px]"
                  style={{ background: c.hex }}
                />
                <div>
                  <div className="text-[13px] font-semibold">{c.name}</div>
                  <div className="font-mono text-xs text-[#5E6E76]">
                    {c.hex}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Dark variant */}
          <div className="flex flex-col gap-4 rounded-[20px] bg-[#0F1C21] p-6">
            <div className="flex flex-wrap items-baseline gap-2.5">
              <h3 className="font-display text-lg font-bold text-[#F0EAE0]">
                Dark variant
              </h3>
              <span className="text-[13px] text-[#8FA3AB]">
                Warm dark — never pure black; amber gains luminosity for CTAs.
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
              <div className="rounded-xl border border-[#24363D] bg-[#0F1C21] p-3">
                <div className="text-[13px] font-semibold text-[#F0EAE0]">
                  bg
                </div>
                <div className="font-mono text-xs text-[#8FA3AB]">#0F1C21</div>
              </div>
              <div className="rounded-xl border border-[#24363D] bg-[#16262C] p-3">
                <div className="text-[13px] font-semibold text-[#F0EAE0]">
                  surface
                </div>
                <div className="font-mono text-xs text-[#8FA3AB]">#16262C</div>
              </div>
              <div className="rounded-xl bg-[#4FB3BF] p-3">
                <div className="text-[13px] font-semibold text-[#0F1C21]">
                  teal (primary)
                </div>
                <div className="font-mono text-xs text-[#12333A]">#4FB3BF</div>
              </div>
              <div className="rounded-xl bg-[#F2A950] p-3">
                <div className="text-[13px] font-semibold text-[#3A2A10]">
                  amber (CTA)
                </div>
                <div className="font-mono text-xs text-[#6B4E1F]">#F2A950</div>
              </div>
              <div className="rounded-xl border border-[#24363D] bg-[#16262C] p-3">
                <div className="text-[13px] font-semibold text-[#F0EAE0]">
                  ink → #F0EAE0
                </div>
                <div className="font-mono text-xs text-[#8FA3AB]">
                  muted #8FA3AB
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Typography ── */}
        <section className="flex flex-col gap-5">
          <SectionTitle>Typography</SectionTitle>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-[#E7DECB] bg-[#FDFBF7] p-5">
              <div className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-[#5E6E76]">
                Display · Bricolage Grotesque
              </div>
              <div className="font-display text-[34px] font-extrabold leading-[1.1] tracking-[-0.02em]">
                Pack light, plan bright
              </div>
            </div>
            <div className="rounded-2xl border border-[#E7DECB] bg-[#FDFBF7] p-5">
              <div className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-[#5E6E76]">
                Body · Instrument Sans
              </div>
              <div className="text-base leading-[1.55]">
                Three days in Lisbon, pastel trams and custard tarts. Readable
                at every size, friendly at every weight.
              </div>
            </div>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-[#E7DECB] bg-[#FDFBF7] px-5 py-2">
            {TYPE_SCALE.map((t, i) => (
              <div
                key={t.label}
                className={`flex items-baseline gap-4 py-3 ${
                  i < TYPE_SCALE.length ? "border-b border-[#F1E9DA]" : ""
                }`}
              >
                <span className="w-[120px] flex-none font-mono text-xs text-[#5E6E76]">
                  {t.label}
                </span>
                <span
                  className={t.display ? "font-display" : ""}
                  style={{
                    fontSize: t.size,
                    fontWeight: t.weight,
                    letterSpacing: t.ls,
                    lineHeight: 1.1,
                  }}
                >
                  Where next?
                </span>
              </div>
            ))}
            <div className="flex items-baseline gap-4 py-3">
              <span className="w-[120px] flex-none font-mono text-xs text-[#5E6E76]">
                caption / 13
              </span>
              <span className="text-[13px] text-[#5E6E76]">
                Best in spring · £60/day · 3h from London
              </span>
            </div>
          </div>
        </section>

        {/* ── Buttons ── */}
        <section className="flex flex-col gap-5">
          <SectionTitle>Buttons</SectionTitle>
          <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-[#E7DECB] bg-[#FDFBF7] p-6">
            <button className="min-h-[48px] rounded-full bg-[#ED9B40] px-7 py-3.5 text-base font-semibold text-[#3A2408] shadow-[0_2px_8px_rgba(237,155,64,0.35)] transition-all hover:-translate-y-px hover:bg-[#DE8B2F] hover:shadow-[0_4px_14px_rgba(237,155,64,0.4)]">
              Start planning — free
            </button>
            <button className="min-h-[48px] rounded-full bg-[#17727F] px-7 py-3.5 text-base font-semibold text-[#FDFBF7] transition-colors hover:bg-[#145C6B]">
              Primary teal
            </button>
            <button className="min-h-[48px] rounded-full border-[1.5px] border-[#B8CDD1] bg-transparent px-[26px] py-[13px] text-base font-semibold text-[#17727F] transition-colors hover:border-[#17727F] hover:bg-[#DFF1F2]">
              Secondary
            </button>
            <button className="min-h-[48px] rounded-full px-5 py-3.5 text-base font-semibold text-[#17727F] transition-colors hover:bg-[#DFF1F2]">
              Ghost →
            </button>
          </div>
        </section>

        {/* ── Components ── */}
        <section className="flex flex-col gap-5">
          <SectionTitle>Components</SectionTitle>
          <div className="grid grid-cols-1 items-start gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {/* Destination card */}
            <div className="flex flex-col gap-2">
              <SpecLabel>destination card</SpecLabel>
              <div className="cursor-pointer overflow-hidden rounded-[20px] border border-[#E7DECB] bg-[#FDFBF7] shadow-[0_1px_3px_rgba(34,48,58,0.06)] transition-all hover:-translate-y-[3px] hover:shadow-[0_10px_28px_rgba(34,48,58,0.12)]">
                <div
                  className="relative h-40"
                  style={{
                    background:
                      "linear-gradient(160deg, #F6C177 0%, #ED9B40 42%, #1E8A97 100%)",
                  }}
                >
                  <span className="absolute bottom-3 left-3.5 rounded-full bg-[#145C6B]/70 px-[11px] py-[5px] text-xs font-semibold text-[#FDFBF7] backdrop-blur-sm">
                    ☀ Best in spring
                  </span>
                </div>
                <div className="flex flex-col gap-1.5 px-[18px] pb-[18px] pt-4">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-display text-xl font-bold">
                      Lisbon
                    </span>
                    <span className="text-[13px] font-semibold text-[#17727F]">
                      £60/day
                    </span>
                  </div>
                  <span className="text-sm leading-[1.45] text-[#5E6E76]">
                    Pastel hills, custard tarts, golden light until 9pm.
                  </span>
                </div>
              </div>
            </div>

            {/* Day tabs + tickets */}
            <div className="flex flex-col gap-2">
              <SpecLabel>day tabs + activity card (ticket)</SpecLabel>
              <div className="flex gap-2">
                <span className="inline-flex items-center rounded-full bg-[#17727F] px-[18px] py-2.5 text-sm font-semibold text-[#FDFBF7]">
                  Day 1
                </span>
                <span className="inline-flex items-center rounded-full border border-[#E7DECB] bg-[#FDFBF7] px-[18px] py-2.5 text-sm font-semibold text-[#17727F]">
                  Day 2
                </span>
                <span className="inline-flex items-center rounded-full border border-[#E7DECB] bg-[#FDFBF7] px-[18px] py-2.5 text-sm font-semibold text-[#17727F]">
                  Day 3
                </span>
              </div>
              <div
                className="flex items-center gap-3 rounded-2xl border border-[#E7DECB] bg-[#FDFBF7] px-4 py-3.5 shadow-[0_1px_3px_rgba(34,48,58,0.06)]"
                style={{ borderLeft: "4px solid #1E8A97" }}
              >
                <span className="flex-none cursor-grab tracking-[2px] text-[#B8CDD1]">
                  ⋮⋮
                </span>
                <div className="flex flex-1 flex-col gap-0.5">
                  <span className="text-[15px] font-semibold">
                    Tram 28 to Alfama
                  </span>
                  <span className="text-[13px] text-[#5E6E76]">
                    Morning · 1.5h · €3.30
                  </span>
                </div>
                <span className="grid h-[26px] w-[26px] flex-none cursor-pointer place-items-center rounded-full border-[1.5px] border-[#B8CDD1]" />
              </div>
              <div
                className="flex items-center gap-3 rounded-2xl border border-[#E7DECB] bg-[#FDFBF7] px-4 py-3.5 opacity-75"
                style={{ borderLeft: "4px solid #3E8E5A" }}
              >
                <span className="flex-none tracking-[2px] text-[#B8CDD1]">
                  ⋮⋮
                </span>
                <div className="flex flex-1 flex-col gap-0.5">
                  <span className="text-[15px] font-semibold line-through decoration-[#3E8E5A]">
                    Pastéis de Belém
                  </span>
                  <span className="text-[13px] text-[#5E6E76]">
                    Done · €2.50
                  </span>
                </div>
                <span className="grid h-[26px] w-[26px] flex-none place-items-center rounded-full bg-[#3E8E5A] text-[13px] text-[#FDFBF7]">
                  ✓
                </span>
              </div>
            </div>

            {/* Quick facts */}
            <div className="flex flex-col gap-2">
              <SpecLabel>quick-facts box</SpecLabel>
              <div className="grid grid-cols-2 gap-3.5 rounded-2xl bg-[#DFF1F2] px-5 py-[18px]">
                {[
                  ["Currency", "Euro €"],
                  ["Daily budget", "£60"],
                  ["Best months", "Apr – Jun"],
                  ["Flight time", "2h 50m"],
                ].map(([label, value]) => (
                  <div key={label}>
                    <div className="text-xs font-semibold uppercase tracking-[0.06em] text-[#145C6B]">
                      {label}
                    </div>
                    <div className="text-[15px] font-semibold">{value}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Upgrade prompt */}
            <div className="flex flex-col gap-2">
              <SpecLabel>upgrade prompt (invitation, never a wall)</SpecLabel>
              <div
                className="flex flex-col gap-2.5 rounded-[20px] border border-[#F0D9B5] p-[22px]"
                style={{
                  background: "linear-gradient(150deg, #FBEEDC, #FDFBF7 70%)",
                }}
              >
                <span className="text-xs font-bold uppercase tracking-[0.08em] text-[#B06D14]">
                  ✦ Wanderly Pro
                </span>
                <span className="font-display text-xl font-bold leading-tight">
                  Unlock unlimited trips
                </span>
                <span className="text-sm leading-normal text-[#5E6E76]">
                  Keep every idea. Unlimited days, offline access, and shared
                  editing with your travel crew.
                </span>
                <div className="mt-1 flex gap-2.5">
                  <button className="min-h-[44px] rounded-full bg-[#ED9B40] px-5 py-2.5 text-sm font-semibold text-[#3A2408] hover:bg-[#DE8B2F]">
                    See Pro
                  </button>
                  <button className="min-h-[44px] rounded-full px-3 py-2.5 text-sm font-semibold text-[#17727F]">
                    Maybe later
                  </button>
                </div>
              </div>
            </div>

            {/* Search combobox */}
            <div className="flex flex-col gap-2">
              <SpecLabel>search combobox</SpecLabel>
              <div className="flex items-center gap-3 rounded-full border-[1.5px] border-[#E7DECB] bg-[#FDFBF7] py-1.5 pl-[22px] pr-1.5 shadow-[0_2px_12px_rgba(34,48,58,0.07)]">
                <span className="flex-none text-lg text-[#17727F]">◎</span>
                <span className="flex-1 text-base text-[#97A4AA]">
                  Where do you want to go?
                </span>
                <button className="min-h-[46px] flex-none rounded-full bg-[#ED9B40] px-[22px] py-3 text-[15px] font-semibold text-[#3A2408] hover:bg-[#DE8B2F]">
                  Search
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {["Lisbon", "Kyoto", "Mexico City"].map((c) => (
                  <span
                    key={c}
                    className="cursor-pointer rounded-full bg-[#DFF1F2] px-3.5 py-2 text-[13px] font-semibold text-[#17727F] hover:bg-[#C9E7E9]"
                  >
                    {c}
                  </span>
                ))}
              </div>
            </div>

            {/* Empty state + toast */}
            <div className="flex flex-col gap-2">
              <SpecLabel>empty state + toast</SpecLabel>
              <div className="flex flex-col items-center gap-1.5 rounded-[20px] border-2 border-dashed border-[#D9CDB4] bg-[#FDFBF7]/60 px-[22px] py-7 text-center">
                <span className="text-[28px]">🧭</span>
                <span className="font-display text-[17px] font-bold">
                  Nothing planned yet
                </span>
                <span className="text-sm text-[#5E6E76]">
                  Add your first activity — mornings are a good place to start.
                </span>
              </div>
              <div className="flex w-fit items-center gap-2.5 rounded-[14px] bg-[#22303A] px-[18px] py-[13px] text-[#FDFBF7] shadow-[0_8px_24px_rgba(34,48,58,0.25)]">
                <span className="text-[#7FD8A4]">✓</span>
                <span className="text-sm font-medium">
                  Added to Day 2 — trip total £142
                </span>
              </div>
            </div>

            {/* Testimonial */}
            <div className="flex flex-col gap-2">
              <SpecLabel>testimonial card</SpecLabel>
              <div className="flex flex-col gap-3 rounded-[20px] border border-[#E7DECB] bg-[#FDFBF7] p-[22px]">
                <span className="text-[15px] tracking-[3px] text-[#ED9B40]">
                  ★★★★★
                </span>
                <span className="text-[15px] italic leading-[1.55]">
                  &ldquo;Planned our whole honeymoon in one evening. It felt
                  like the fun part of the trip started early.&rdquo;
                </span>
                <div className="flex items-center gap-2.5">
                  <span
                    className="h-[34px] w-[34px] flex-none rounded-full"
                    style={{
                      background: "linear-gradient(135deg, #1E8A97, #ED9B40)",
                    }}
                  />
                  <div>
                    <div className="text-sm font-semibold">Maya &amp; Tom</div>
                    <div className="text-[13px] text-[#5E6E76]">
                      Lisbon, 5 days
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Pricing column */}
            <div className="flex flex-col gap-2">
              <SpecLabel>pricing column (Pro, elevated)</SpecLabel>
              <div className="relative flex flex-col gap-3 rounded-[20px] border-2 border-[#ED9B40] bg-[#FDFBF7] p-6 shadow-[0_8px_28px_rgba(237,155,64,0.18)]">
                <span className="absolute -top-3 left-[22px] rounded-full bg-[#ED9B40] px-3 py-1 text-xs font-bold text-[#3A2408]">
                  Most popular
                </span>
                <span className="font-display text-xl font-bold">Pro</span>
                <div className="flex items-baseline gap-1">
                  <span className="font-display text-[38px] font-extrabold">
                    £4
                  </span>
                  <span className="text-sm text-[#5E6E76]">/month</span>
                </div>
                <div className="flex flex-col gap-2 text-sm">
                  {[
                    "Unlimited trips & days",
                    "Offline itineraries",
                    "Shared editing",
                  ].map((f) => (
                    <span key={f} className="flex gap-2">
                      <span className="text-[#3E8E5A]">✓</span>
                      {f}
                    </span>
                  ))}
                </div>
                <button className="min-h-[48px] rounded-full bg-[#ED9B40] px-6 py-[13px] text-[15px] font-semibold text-[#3A2408] hover:bg-[#DE8B2F]">
                  Go Pro
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* ── Shape & motion ── */}
        <section className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div className="flex flex-col gap-2 rounded-[20px] border border-[#E7DECB] bg-[#FDFBF7] p-6">
            <h3 className="font-display text-[19px] font-bold">Shape</h3>
            <p className="text-sm leading-[1.55] text-[#5E6E76]">
              Radii: 999px pills for actions and chips, 20px cards, 16px inner
              elements. Shadows are soft and warm-tinted (rgba of ink, never
              pure black). Ticket cards get a 4px left accent edge.
            </p>
          </div>
          <div className="flex flex-col gap-2 rounded-[20px] border border-[#E7DECB] bg-[#FDFBF7] p-6">
            <h3 className="font-display text-[19px] font-bold">Motion</h3>
            <p className="text-sm leading-[1.55] text-[#5E6E76]">
              150–250ms ease. Cards lift −3px on hover, items fade+slide 8px on
              entry, buttons lift −1px. Everything gated behind
              prefers-reduced-motion on the built pages.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
