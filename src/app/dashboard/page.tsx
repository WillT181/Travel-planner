import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SignOutButton from "@/components/auth/SignOutButton";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default async function DashboardPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Defence-in-depth: middleware already gates this route.
  if (!user) {
    redirect("/login?returnTo=/dashboard");
  }

  return (
    <div className="py-8">
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
        <SignOutButton />
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
