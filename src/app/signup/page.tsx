import type { Metadata } from "next";
import AuthForm from "@/components/auth/AuthForm";

export const metadata: Metadata = {
  title: "Sign up",
  description: "Create your free Wanderly account and start planning trips.",
};

export default function SignupPage({
  searchParams,
}: {
  searchParams: { error?: string; ref?: string };
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

      {searchParams.ref ? (
        <p className="mb-5 rounded-xl border border-primary-200 bg-primary-50 px-4 py-3 text-center text-sm text-primary-800">
          🎁 You were invited by a friend — sign up and you&apos;re both set up
          for rewards.
        </p>
      ) : null}

      <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
        <AuthForm
          mode="signup"
          initialError={searchParams.error}
          refCode={searchParams.ref}
        />
      </div>
    </div>
  );
}
