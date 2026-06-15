interface Testimonial {
  quote: string;
  author: string;
  detail: string;
}

const TESTIMONIALS: Testimonial[] = [
  {
    quote:
      "Planned a two-week Japan trip in an afternoon. The day-by-day view kept us sane.",
    author: "Maya R.",
    detail: "Tokyo & Kyoto",
  },
  {
    quote:
      "Finally ditched my messy spreadsheet. Everything lives in one place now.",
    author: "Daniel K.",
    detail: "Road trip, Iceland",
  },
  {
    quote:
      "Sharing the itinerary with my whole group meant zero “where are we meeting?” texts.",
    author: "Priya S.",
    detail: "Bali, group of 6",
  },
  {
    quote:
      "The destination search surfaced spots I'd never have found on my own.",
    author: "Tom A.",
    detail: "Lisbon weekender",
  },
  {
    quote:
      "Offline access saved us when we lost signal halfway up the Amalfi Coast.",
    author: "Elena M.",
    detail: "Amalfi Coast",
  },
  {
    quote: "Booked, organised, and stress-free before we even left home.",
    author: "Chris W.",
    detail: "New York City",
  },
];

function QuoteCard({ testimonial }: { testimonial: Testimonial }) {
  return (
    <figure className="flex w-80 shrink-0 flex-col justify-between rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
      <blockquote className="text-neutral-700">
        “{testimonial.quote}”
      </blockquote>
      <figcaption className="mt-4 text-sm">
        <span className="font-semibold text-neutral-900">
          {testimonial.author}
        </span>
        <span className="text-neutral-500"> · {testimonial.detail}</span>
      </figcaption>
    </figure>
  );
}

export default function SocialProof() {
  // Duplicate the list so the marquee can loop seamlessly at -50% translate.
  const track = [...TESTIMONIALS, ...TESTIMONIALS];

  return (
    <section className="py-16 sm:py-20" aria-labelledby="social-proof-heading">
      <div className="mx-auto max-w-2xl text-center">
        <h2
          id="social-proof-heading"
          className="text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl"
        >
          Loved by 100,000+ travellers
        </h2>
        <p className="mt-4 text-lg text-neutral-600">
          Real trips, planned and travelled with us.
        </p>
      </div>

      {/* Edge fade + horizontal marquee */}
      <div className="group relative mt-12 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]">
        <ul
          className="flex w-max gap-6 animate-marquee"
          aria-label="Traveller testimonials"
        >
          {track.map((t, i) => (
            <li key={`${t.author}-${i}`} aria-hidden={i >= TESTIMONIALS.length}>
              <QuoteCard testimonial={t} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
