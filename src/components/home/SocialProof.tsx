interface Testimonial {
  quote: string;
  author: string;
  detail: string;
  /** Avatar gradient (design uses colour blends instead of photos). */
  gradient: string;
}

const TESTIMONIALS: Testimonial[] = [
  {
    quote:
      "Planned our whole honeymoon in one evening. The fun part of the trip started early.",
    author: "Maya & Tom",
    detail: "Lisbon, 5 days",
    gradient: "linear-gradient(135deg, #1E8A97, #ED9B40)",
  },
  {
    quote:
      "Four adults, two kids, zero arguments. Everyone just checked the link.",
    author: "The Okafors",
    detail: "Crete, 10 days",
    gradient: "linear-gradient(135deg, #ED9B40, #C6543F)",
  },
  {
    quote:
      "The running cost total kept us honest. We came home under budget for once.",
    author: "Priya",
    detail: "Kyoto, 7 days",
    gradient: "linear-gradient(135deg, #3E8E5A, #1E8A97)",
  },
];

export default function SocialProof() {
  return (
    <section
      aria-labelledby="testimonials-heading"
      className="flex flex-col items-center gap-7 border-t border-[#F1E9DA] bg-[#FDFBF7] px-[clamp(20px,5vw,56px)] py-[clamp(40px,6vw,80px)]"
    >
      <h2
        id="testimonials-heading"
        className="text-center font-display text-[clamp(26px,4vw,38px)] font-bold tracking-[-0.015em] text-[#22303A]"
      >
        Planners who went
      </h2>
      <ul className="grid w-full max-w-[1020px] grid-cols-1 gap-[18px] sm:grid-cols-3">
        {TESTIMONIALS.map((t) => (
          <li
            key={t.author}
            className="flex flex-col gap-3 rounded-[20px] border border-[#E7DECB] bg-[#FAF6EF] p-6"
          >
            <span
              aria-label="5 out of 5 stars"
              className="text-sm tracking-[3px] text-[#ED9B40]"
            >
              ★★★★★
            </span>
            <blockquote className="text-[15px] italic leading-[1.55] text-[#22303A] [text-wrap:pretty]">
              &ldquo;{t.quote}&rdquo;
            </blockquote>
            <div className="mt-auto flex items-center gap-2.5">
              <span
                aria-hidden="true"
                className="h-[34px] w-[34px] flex-none rounded-full"
                style={{ background: t.gradient }}
              />
              <div>
                <div className="text-sm font-semibold text-[#22303A]">
                  {t.author}
                </div>
                <div className="text-[13px] text-[#5E6E76]">{t.detail}</div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
