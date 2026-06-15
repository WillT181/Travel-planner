import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How Wanderly collects, uses, and protects your personal data, including cookies and analytics.",
};

const SECTIONS = [
  {
    heading: "What we collect",
    body: "We store the account details you give us (email and, optionally, your name), the trips and itineraries you create, and your preferences such as default currency. If you upgrade to Pro, our payment processor (Stripe) handles your card details — we never see or store them.",
  },
  {
    heading: "Cookies & analytics",
    body: "Essential cookies keep you signed in and are always on. Analytics cookies are optional: we only set them after you click “Accept” on the cookie banner, and you can decline without losing any functionality. Declining means we don't record usage analytics for your session.",
  },
  {
    heading: "How we use your data",
    body: "We use your data to provide the planning features, sync trips across your devices, process referrals and billing, and send transactional emails (such as invites and payment notifications). We do not sell your personal data.",
  },
  {
    heading: "Your rights",
    body: "You can update your name, email, and password at any time from your account settings, and you can permanently delete your account — and all associated data — from the same page. For any other data request, contact us and we'll respond promptly.",
  },
  {
    heading: "Data retention",
    body: "We keep your data for as long as your account is active. When you delete your account, your profile, trips, itineraries, budgets, and referral records are removed.",
  },
];

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl py-12">
      <h1 className="text-4xl font-bold tracking-tight text-neutral-900">
        Privacy Policy
      </h1>
      <p className="mt-3 text-neutral-600">
        We keep this short and readable. Your privacy matters, and we only
        collect what we need to help you plan great trips.
      </p>

      <div className="mt-10 space-y-8">
        {SECTIONS.map((section) => (
          <section key={section.heading}>
            <h2 className="text-xl font-bold tracking-tight text-neutral-900">
              {section.heading}
            </h2>
            <p className="mt-2 leading-relaxed text-neutral-700">
              {section.body}
            </p>
          </section>
        ))}
      </div>
    </div>
  );
}
