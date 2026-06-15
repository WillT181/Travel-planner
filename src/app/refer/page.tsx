import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import type { Referral } from "@/types/account";
import ReferralShare from "@/components/referral/ReferralShare";
import ReferralTable from "@/components/referral/ReferralTable";

export const metadata: Metadata = {
  title: "Refer a friend",
  description:
    "Invite friends to Wanderly and earn a free month of Pro for every friend who joins.",
};

function getOrigin(): string {
  const hdrs = headers();
  const host = hdrs.get("host") ?? "localhost:3000";
  const proto = hdrs.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

export default async function ReferPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?returnTo=/refer");

  const [{ data: profile }, { data: referralRows }] = await Promise.all([
    supabase
      .from("user_profiles")
      .select("referral_code")
      .eq("id", user.id)
      .single(),
    supabase
      .from("referrals")
      .select("id, referred_email, status, reward_granted_at, created_at")
      .eq("referrer_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  const referrals = (referralRows ?? []) as Referral[];
  const code = profile?.referral_code ?? "";
  const link = code
    ? `${getOrigin()}/signup?ref=${code}`
    : `${getOrigin()}/signup`;

  const rewardedCount = referrals.filter((r) => r.status === "rewarded").length;
  const completedCount = referrals.filter(
    (r) => r.status === "completed" || r.status === "rewarded"
  ).length;

  return (
    <div className="mx-auto max-w-2xl py-10">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1 text-sm font-medium text-neutral-500 hover:text-neutral-800"
      >
        ← Back to dashboard
      </Link>

      <h1 className="mt-4 text-3xl font-bold tracking-tight text-neutral-900">
        Give a month, get a month
      </h1>
      <p className="mt-2 text-neutral-600">
        Share your link with friends. When someone signs up and completes
        onboarding, you get{" "}
        <span className="font-semibold">one free month of Wanderly Pro</span> —
        automatically.
      </p>

      {/* Stat strip */}
      <div className="mt-6 grid grid-cols-3 gap-3">
        <div className="rounded-2xl border border-neutral-200 bg-white p-4 text-center">
          <p className="text-2xl font-bold text-neutral-900">
            {referrals.length}
          </p>
          <p className="text-xs text-neutral-500">Friends invited</p>
        </div>
        <div className="rounded-2xl border border-neutral-200 bg-white p-4 text-center">
          <p className="text-2xl font-bold text-neutral-900">
            {completedCount}
          </p>
          <p className="text-xs text-neutral-500">Joined</p>
        </div>
        <div className="rounded-2xl border border-neutral-200 bg-white p-4 text-center">
          <p className="text-2xl font-bold text-primary-700">{rewardedCount}</p>
          <p className="text-xs text-neutral-500">Free months earned</p>
        </div>
      </div>

      {/* Share */}
      <div className="mt-6 rounded-2xl border border-neutral-200 bg-white p-6">
        <h2 className="text-lg font-bold text-neutral-900">
          Your referral link
        </h2>
        <p className="mt-1 text-sm text-neutral-500">
          Your code: <span className="font-mono font-semibold">{code}</span>
        </p>
        <div className="mt-4">
          <ReferralShare link={link} />
        </div>
      </div>

      {/* Table */}
      <div className="mt-8">
        <h2 className="mb-3 text-lg font-bold text-neutral-900">
          People you&apos;ve referred
        </h2>
        <ReferralTable referrals={referrals} />
      </div>
    </div>
  );
}
