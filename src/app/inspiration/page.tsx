import type { Metadata } from "next";
import { getAllPosts } from "@/lib/blog/posts";
import InspirationBrowser from "@/components/inspiration/InspirationBrowser";
import NewsletterForm from "@/components/inspiration/NewsletterForm";

export const metadata: Metadata = {
  title: "Travel Inspiration",
  description:
    "Destination guides, budget breakdowns, packing lists, and hidden gems to inspire your next trip.",
};

const QUICK_GUIDES = [
  {
    icon: "🎒",
    title: "What to pack for a beach holiday",
    excerpt:
      "The 37-item list that packs into a 25L daypack — no checked baggage fee ever again.",
    href: "#",
    category: "Packing lists",
  },
  {
    icon: "💳",
    title: "The best travel money cards in 2025",
    excerpt:
      "Chase, Monzo, and Wise compared — real exchange rates, which one charges abroad, and which to use at ATMs.",
    href: "#",
    category: "Budget tips",
  },
  {
    icon: "🗺️",
    title: "Hidden gems in southern Europe",
    excerpt:
      "Skip the crowds: Kotor, Plovdiv, Valletta, and Chefchaouen are all within budget and under the radar.",
    href: "#",
    category: "Hidden gems",
  },
  {
    icon: "🌏",
    title: "Your first solo trip: a no-panic guide",
    excerpt:
      "Everything you'll worry about before going — and why almost none of it is actually a problem.",
    href: "#",
    category: "Guides",
  },
  {
    icon: "🏨",
    title: "Hostels in 2025 aren't what you think",
    excerpt:
      "Modern hostels have ensuite pods, work spaces, and rooftop bars. Here's how to find the good ones.",
    href: "#",
    category: "Budget tips",
  },
  {
    icon: "🍜",
    title: "How to eat well on a tight budget",
    excerpt:
      "Market days, lunch specials, set menus, and the one rule that always saves money: eat where the taxis park.",
    href: "#",
    category: "Budget tips",
  },
];

export default function InspirationPage() {
  const posts = getAllPosts();

  return (
    <div className="py-10">
      {/* Hero */}
      <div className="mx-auto max-w-3xl text-center">
        <h1 className="text-4xl font-bold tracking-tight text-neutral-900 sm:text-5xl">
          Travel inspiration
        </h1>
        <p className="mt-4 text-lg text-neutral-600">
          Guides, budget breakdowns, packing lists, and hidden gems — curated to
          help you plan trips worth taking.
        </p>
      </div>

      {/* Featured posts grid with client-side filter */}
      <div className="mx-auto mt-12 max-w-6xl">
        <InspirationBrowser posts={posts} />
      </div>

      {/* Quick guides grid */}
      <section
        className="mx-auto mt-20 max-w-6xl"
        aria-labelledby="tips-heading"
      >
        <h2
          id="tips-heading"
          className="text-2xl font-bold tracking-tight text-neutral-900"
        >
          Quick reads
        </h2>
        <p className="mt-2 text-neutral-600">
          Short, practical articles you can read in 5 minutes or less.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {QUICK_GUIDES.map((guide) => (
            <a
              key={guide.title}
              href={guide.href}
              className="group flex gap-4 rounded-2xl border border-neutral-200 bg-white p-5 transition hover:border-primary-300 hover:shadow-sm"
            >
              <span className="mt-0.5 text-2xl">{guide.icon}</span>
              <div>
                <span className="text-xs font-medium text-primary-700">
                  {guide.category}
                </span>
                <h3 className="mt-0.5 font-semibold text-neutral-900 group-hover:text-primary-700">
                  {guide.title}
                </h3>
                <p className="mt-1 text-sm text-neutral-600 line-clamp-2">
                  {guide.excerpt}
                </p>
              </div>
            </a>
          ))}
        </div>
      </section>

      {/* Newsletter CTA */}
      <section className="mx-auto mt-20 max-w-3xl rounded-3xl bg-primary-600 px-8 py-12 text-center">
        <h2 className="text-2xl font-bold text-white">New guides every week</h2>
        <p className="mt-3 text-primary-100">
          Destination deep-dives, budget breakdowns, and trip reports — straight
          to your inbox. No spam, unsubscribe any time.
        </p>
        <NewsletterForm />
      </section>
    </div>
  );
}
