import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getUserPlan } from "@/lib/auth/plan";
import PricingPlans from "@/components/pricing/PricingPlans";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Plan trips for free, or go Pro for unlimited trips, budgets, and collaboration.",
};

const FAQ = [
  {
    q: "Can I cancel anytime?",
    a: "Yes. Cancel from the billing portal in two clicks — there are no lock-in contracts. Your Pro features stay active until the end of the period you've already paid for, then your account reverts to Free. Your trips are never deleted.",
  },
  {
    q: "Do you offer team or group plans?",
    a: "Pro already includes collaboration: invite as many editors and viewers to a trip as you like at no extra cost. For larger organisations that need centralised billing across many accounts, get in touch and we'll sort out a team plan.",
  },
  {
    q: "Is there a free trial?",
    a: "The Free plan is free forever and needs no credit card, so you can try the core planner before deciding. When you're ready, upgrade to Pro — and if you have a promo code, you can apply it at checkout.",
  },
  {
    q: "Can I export my data?",
    a: "Absolutely. Budget summaries export to a clean PDF from the Budget tab, and you can review and copy all of your trip and itinerary data from your account at any time. Your data is yours.",
  },
  {
    q: "Do you offer refunds?",
    a: "If something isn't right, email us within 14 days of an annual payment for a full refund. Monthly plans can be cancelled any time to stop future charges, and you keep Pro until the period ends.",
  },
];

export default async function PricingPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const plan = user ? await getUserPlan(supabase) : "free";

  return (
    <div className="py-12">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-4xl font-bold tracking-tight text-neutral-900 sm:text-5xl">
          Simple, honest pricing
        </h1>
        <p className="mt-4 text-lg text-neutral-600">
          Start free and upgrade when your trips get ambitious. No hidden fees,
          cancel whenever you like.
        </p>
      </div>

      <div className="mx-auto mt-12 max-w-4xl">
        <PricingPlans isLoggedIn={Boolean(user)} isPro={plan === "pro"} />
      </div>

      {/* FAQ */}
      <section
        className="mx-auto mt-20 max-w-3xl"
        aria-labelledby="faq-heading"
      >
        <h2
          id="faq-heading"
          className="text-center text-2xl font-bold tracking-tight text-neutral-900"
        >
          Frequently asked questions
        </h2>
        <dl className="mt-8 divide-y divide-neutral-200">
          {FAQ.map((item) => (
            <div key={item.q} className="py-6">
              <dt className="text-lg font-semibold text-neutral-900">
                {item.q}
              </dt>
              <dd className="mt-2 text-neutral-600">{item.a}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
