import type { Metadata } from "next";
import AuthForm from "@/components/auth/AuthForm";

export const metadata: Metadata = {
  title: "Sign up",
  description: "Create your free Wanderly account and start planning trips.",
};

export default function SignupPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col py-8 sm:py-12">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-neutral-900">
          Create your account
        </h1>
        <p className="mt-2 text-neutral-600">
          Start planning your next adventure — it&apos;s free.
        </p>
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
        <AuthForm mode="signup" initialError={searchParams.error} />
      </div>
    </div>
  );
}
