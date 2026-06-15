import type { Metadata } from "next";
import AuthForm from "@/components/auth/AuthForm";

export const metadata: Metadata = {
  title: "Log in",
  description: "Log in to your Wanderly account.",
};

export default function LoginPage({
  searchParams,
}: {
  searchParams: { returnTo?: string; error?: string };
}) {
  // Only honour same-site relative return paths.
  const returnTo =
    searchParams.returnTo &&
    searchParams.returnTo.startsWith("/") &&
    !searchParams.returnTo.startsWith("//")
      ? searchParams.returnTo
      : undefined;

  return (
    <div className="mx-auto flex w-full max-w-md flex-col py-8 sm:py-12">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-neutral-900">
          Welcome back
        </h1>
        <p className="mt-2 text-neutral-600">
          Log in to pick up where you left off.
        </p>
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
        <AuthForm
          mode="login"
          returnTo={returnTo}
          initialError={searchParams.error}
        />
      </div>
    </div>
  );
}
