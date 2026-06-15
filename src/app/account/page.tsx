import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AccountSettings from "@/components/account/AccountSettings";

export const metadata: Metadata = { title: "Account settings" };

export default async function AccountPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?returnTo=/account");

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("display_name, currency, plan")
    .eq("id", user.id)
    .single();

  return (
    <div className="mx-auto max-w-2xl py-10">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1 text-sm font-medium text-neutral-500 hover:text-neutral-800"
      >
        ← Back to dashboard
      </Link>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold tracking-tight text-neutral-900">
          Account settings
        </h1>
        <Link
          href="/account/billing"
          className="text-sm font-semibold text-primary-700 hover:text-primary-800"
        >
          Billing & plan →
        </Link>
      </div>

      <div className="mt-8">
        <AccountSettings
          initialName={profile?.display_name ?? ""}
          email={user.email ?? ""}
          initialCurrency={profile?.currency ?? "GBP"}
        />
      </div>
    </div>
  );
}
