import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import OnboardingWizard from "@/components/auth/OnboardingWizard";

export const metadata: Metadata = {
  title: "Get started",
  description: "Tell us about your travel style to personalise Wanderly.",
};

export default async function OnboardingPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Onboarding only makes sense for a signed-in user.
  if (!user) {
    redirect("/login?returnTo=/onboarding");
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col py-8 sm:py-12">
      <div className="mb-6 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-neutral-900">
          Welcome aboard{user.email ? `, ${user.email.split("@")[0]}` : ""}
        </h1>
        <p className="mt-2 text-neutral-600">
          A few quick questions to personalise your planning.
        </p>
      </div>

      <OnboardingWizard />
    </div>
  );
}
