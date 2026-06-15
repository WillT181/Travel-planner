import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SignOutButton from "@/components/auth/SignOutButton";

export const metadata: Metadata = {
  title: "Dashboard",
};

interface PageProps {
  searchParams: { upgraded?: string };
}

export default async function DashboardPage({ searchParams }: PageProps) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Defence-in-depth: middleware already gates this route.
  if (!user) {
    redirect("/login?returnTo=/dashboard");
  }

  const justUpgraded = searchParams.upgraded === "true";

  return (
    <div className="py-8">
      {justUpgraded && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-primary-200 bg-primary-50 p-5">
          <span className="text-2xl" aria-hidden="true">
            🎉
          </span>
          <div>
            <p className="font-bold text-primary-800">
              Welcome to Wanderly Pro!
            </p>
            <p className="mt-0.5 text-sm text-primary-700">
              Your upgrade is complete. Unlimited trips, budget tracking, and
              collaboration are now unlocked. Manage your plan any time from{" "}
              <Link
                href="/account/billing"
                className="font-semibold underline underline-offset-2"
              >
                billing
              </Link>
              .
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-neutral-900">
            Your dashboard
          </h1>
          <p className="mt-1 text-neutral-600">
            Signed in as{" "}
            <span className="font-medium text-neutral-900">{user.email}</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/account/billing"
            className="text-sm font-semibold text-neutral-600 hover:text-neutral-900"
          >
            Billing
          </Link>
          <SignOutButton />
        </div>
      </div>

      <div className="mt-8 rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-10 text-center">
        <p className="text-neutral-600">
          Your trips will appear here. Head to{" "}
          <a
            href="/search"
            className="font-semibold text-primary-700 hover:text-primary-800"
          >
            destination search
          </a>{" "}
          to start planning.
        </p>
      </div>
    </div>
  );
}
