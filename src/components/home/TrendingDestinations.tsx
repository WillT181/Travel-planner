import Link from "next/link";

interface TrendingDest {
  name: string;
  /** Canonical /explore/{slug} path segment. */
  slug: string;
  budget: string;
  badge: string;
  blurb: string;
  /** picsum seed → stable placeholder image. */
  seed: string;
  /** Design-spec gradient — shows while the photo loads or if it fails. */
  gradient: string;
}

const DESTINATIONS: TrendingDest[] = [
  {
    name: "Lisbon",
    slug: "lisbon",
    budget: "£60/day",
    badge: "☀ Best in spring",
    blurb: "Pastel hills, custard tarts, golden light until 9pm.",
    seed: "lisbon",
    gradient: "linear-gradient(160deg, #F6C177 0%, #ED9B40 45%, #1E8A97 100%)",
  },
  {
    name: "Kyoto",
    slug: "kyoto",
    budget: "£85/day",
    badge: "🍁 Peak in November",
    blurb: "Temples at dawn, ramen at midnight, maple fire in between.",
    seed: "kyoto",
    gradient: "linear-gradient(160deg, #C6543F 0%, #8A3B4A 55%, #22303A 100%)",
  },
  {
    name: "Mexico City",
    slug: "mexico/mexico-city",
    budget: "£45/day",
    badge: "🌮 Great year-round",
    blurb: "Murals, mercados, and the best £2 tacos of your life.",
    seed: "mexico-city",
    gradient: "linear-gradient(160deg, #ED9B40 0%, #C6543F 50%, #145C6B 100%)",
  },
  {
    name: "Crete",
    slug: "greece",
    budget: "£55/day",
    badge: "🏖 Warm into October",
    blurb: "Two-beach days, taverna nights, family-proof distances.",
    seed: "crete",
    gradient: "linear-gradient(160deg, #7FD8E0 0%, #1E8A97 55%, #145C6B 100%)",
  },
  {
    name: "Marrakech",
    slug: "marrakech",
    budget: "£40/day",
    badge: "✦ Best value",
    blurb: "Souk mazes and riad courtyards, 3 hours from London.",
    seed: "morocco",
    gradient: "linear-gradient(160deg, #F2A950 0%, #C6543F 60%, #6B2F3A 100%)",
  },
  {
    name: "Ljubljana",
    slug: "slovenia/ljubljana",
    budget: "£50/day",
    badge: "🚲 Underrated gem",
    blurb: "A fairytale old town nobody you know has been to. Yet.",
    seed: "ljubljana",
    gradient: "linear-gradient(160deg, #A9D6B8 0%, #3E8E5A 55%, #145C6B 100%)",
  },
];

export default function TrendingDestinations() {
  return (
    <section
      id="explore"
      aria-labelledby="trending-heading"
      className="flex flex-col items-center gap-7 border-y border-[#F1E9DA] bg-[#FDFBF7] px-[clamp(20px,5vw,56px)] py-[clamp(40px,6vw,80px)]"
    >
      <div className="flex flex-col items-center gap-2 text-center">
        <h2
          id="trending-heading"
          className="font-display text-[clamp(26px,4vw,38px)] font-bold tracking-[-0.015em] text-[#22303A]"
        >
          Trending this season
        </h2>
        <p className="text-base text-[#5E6E76]">
          Real budgets, real timing — not brochure numbers.
        </p>
      </div>

      <ul className="grid w-full max-w-[1120px] grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {DESTINATIONS.map((dest) => (
          <li key={dest.slug}>
            <Link
              href={`/explore/${dest.slug}`}
              className="flex flex-col overflow-hidden rounded-[20px] border border-[#E7DECB] bg-[#FAF6EF] text-[#22303A] shadow-[0_1px_3px_rgba(34,48,58,0.06)] transition-all duration-200 hover:-translate-y-[3px] hover:shadow-[0_12px_30px_rgba(34,48,58,0.13)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1E8A97] focus-visible:ring-offset-2"
            >
              {/* Photo layered over the design-spec gradient: if the image
                  fails to load the gradient shows — no broken-image glyph. */}
              <div
                className="relative h-[170px]"
                style={{
                  background: `url(https://picsum.photos/seed/${dest.seed}/560/340) center / cover no-repeat, ${dest.gradient}`,
                }}
              >
                <span className="absolute bottom-3 left-3.5 rounded-full bg-[#145C6B]/70 px-[11px] py-[5px] text-xs font-semibold text-[#FDFBF7] backdrop-blur-sm">
                  {dest.badge}
                </span>
              </div>
              <div className="flex flex-col gap-[5px] px-[18px] pb-[18px] pt-4">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-display text-xl font-bold">
                    {dest.name}
                  </span>
                  <span className="flex-none text-[13px] font-semibold text-[#17727F]">
                    {dest.budget}
                  </span>
                </div>
                <span className="text-sm leading-[1.45] text-[#5E6E76]">
                  {dest.blurb}
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>

      <Link
        href="/explore"
        className="rounded-full px-5 py-2.5 text-[15px] font-semibold text-[#17727F] transition-colors hover:bg-[#DFF1F2] hover:text-[#145C6B] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1E8A97]"
      >
        Browse all destinations →
      </Link>
    </section>
  );
}
