const STEPS = [
  {
    n: "1",
    title: "Pick a place",
    body: "Search anywhere, or browse trips by mood — beach lazy, city buzz, big nature.",
  },
  {
    n: "2",
    title: "Stack your days",
    body: "Drag activities into mornings, afternoons and evenings. Watch the trip cost add itself up.",
  },
  {
    n: "3",
    title: "Go, together",
    body: "Share one link with your crew. Everyone sees the plan; nobody asks “what’s tomorrow?”",
  },
] as const;

export default function HowItWorks() {
  return (
    <section
      id="how"
      aria-labelledby="how-heading"
      className="flex flex-col items-center gap-8 px-[clamp(20px,5vw,56px)] py-[clamp(40px,6vw,80px)]"
    >
      <h2
        id="how-heading"
        className="text-center font-display text-[clamp(26px,4vw,38px)] font-bold tracking-[-0.015em] text-[#22303A]"
      >
        Three steps to &ldquo;can&apos;t wait&rdquo;
      </h2>
      <div className="grid w-full max-w-[1020px] grid-cols-1 gap-[18px] sm:grid-cols-3">
        {STEPS.map(({ n, title, body }) => (
          <div
            key={n}
            className="flex flex-col gap-2.5 rounded-[20px] border border-[#E7DECB] bg-[#FDFBF7] px-6 py-[26px]"
          >
            <span className="grid h-10 w-10 place-items-center rounded-full bg-[#DFF1F2] font-display text-lg font-extrabold text-[#145C6B]">
              {n}
            </span>
            <span className="font-display text-[19px] font-bold text-[#22303A]">
              {title}
            </span>
            <span className="text-[14.5px] leading-[1.55] text-[#5E6E76]">
              {body}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
