import Link from "next/link";

const TICKETS = [
  {
    accent: "#1E8A97",
    title: "Tram 28 to Alfama",
    meta: "Morning · 1.5h · €3.30",
    done: false,
  },
  {
    accent: "#ED9B40",
    title: "Lunch at Time Out Market",
    meta: "Afternoon · 2h · €18",
    done: false,
  },
  {
    accent: "#3E8E5A",
    title: "Sunset at Miradouro",
    meta: "Evening · free",
    done: true,
  },
] as const;

export default function ProductShowcase() {
  return (
    <section
      aria-labelledby="showcase-heading"
      className="flex flex-col items-center gap-9 px-[clamp(20px,5vw,56px)] py-[clamp(48px,7vw,96px)]"
    >
      <div className="flex max-w-[620px] flex-col items-center gap-2.5 text-center">
        <span className="text-[13px] font-bold uppercase tracking-[0.08em] text-[#145C6B]">
          The builder
        </span>
        <h2
          id="showcase-heading"
          className="font-display text-[clamp(26px,4vw,38px)] font-bold tracking-[-0.015em] text-[#22303A] [text-wrap:pretty]"
        >
          Your days, laid out like boarding passes
        </h2>
        <p className="text-base leading-[1.55] text-[#5E6E76]">
          Every activity is a little ticket. Drag it, tick it off, watch the
          budget breathe.
        </p>
      </div>

      {/* Inline product mock */}
      <div
        className="w-full max-w-[880px] rounded-[28px] p-[clamp(16px,4vw,40px)] shadow-[0_24px_60px_rgba(20,92,107,0.25)]"
        style={{ background: "linear-gradient(150deg, #145C6B, #1E8A97)" }}
      >
        <div className="overflow-hidden rounded-[18px] bg-[#FAF6EF] shadow-[0_8px_30px_rgba(15,28,33,0.3)]">
          {/* Browser chrome */}
          <div className="flex items-center gap-2 border-b border-[#E7DECB] bg-[#FDFBF7] px-[18px] py-3">
            <span className="h-2.5 w-2.5 rounded-full bg-[#E7DECB]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#E7DECB]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#E7DECB]" />
            <span className="ml-2 text-[12.5px] text-[#5E6E76]">
              wanderly.app / trips / lisbon-may
            </span>
          </div>

          <div className="flex flex-col gap-4 p-[clamp(16px,3vw,28px)]">
            {/* Day pills + total */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-[#17727F] px-4 py-[9px] text-[13.5px] font-semibold text-[#FDFBF7]">
                  Day 1
                </span>
                <span className="rounded-full border border-[#E7DECB] bg-[#FDFBF7] px-4 py-[9px] text-[13.5px] font-semibold text-[#17727F]">
                  Day 2
                </span>
                <span className="rounded-full border border-[#E7DECB] bg-[#FDFBF7] px-4 py-[9px] text-[13.5px] font-semibold text-[#17727F]">
                  Day 3
                </span>
              </div>
              <span className="rounded-full bg-[#DFF1F2] px-4 py-[9px] text-[13.5px] font-bold text-[#145C6B]">
                Trip total · £186
              </span>
            </div>

            {/* Ticket cards */}
            <div className="flex flex-col gap-2.5">
              {TICKETS.map((t) => (
                <div
                  key={t.title}
                  className={`flex items-center gap-3 rounded-[14px] border border-[#E7DECB] bg-[#FDFBF7] px-4 py-3 ${
                    t.done ? "opacity-80" : ""
                  }`}
                  style={{ borderLeft: `4px solid ${t.accent}` }}
                >
                  <span
                    aria-hidden="true"
                    className="flex-none tracking-[2px] text-[#B8CDD1]"
                  >
                    ⋮⋮
                  </span>
                  <div className="flex-1">
                    <div
                      className={`text-[14.5px] font-semibold text-[#22303A] ${
                        t.done ? "line-through decoration-[#3E8E5A]" : ""
                      }`}
                    >
                      {t.title}
                    </div>
                    <div className="text-[12.5px] text-[#5E6E76]">{t.meta}</div>
                  </div>
                  {t.done ? (
                    <span className="grid h-6 w-6 flex-none place-items-center rounded-full bg-[#3E8E5A] text-xs text-[#FDFBF7]">
                      ✓
                    </span>
                  ) : (
                    <span className="h-6 w-6 flex-none rounded-full border-[1.5px] border-[#B8CDD1]" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <Link
        href="/itinerary"
        className="rounded-full px-5 py-3 text-[15.5px] font-semibold text-[#17727F] transition-colors hover:bg-[#DFF1F2] hover:text-[#145C6B] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1E8A97]"
      >
        Try the builder →
      </Link>
    </section>
  );
}
