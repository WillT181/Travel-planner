"use client";

import { useFormState } from "react-dom";
import Link from "next/link";
import {
  signInWithEmail,
  signUpWithEmail,
  type AuthFormState,
} from "@/lib/auth/actions";
import SubmitButton from "@/components/auth/SubmitButton";
import GoogleButton from "@/components/auth/GoogleButton";

interface AuthFormProps {
  mode: "login" | "signup";
  /** Where to send the user after a successful login (login mode only). */
  returnTo?: string;
  /** Surfaced from the ?error= query param after an OAuth failure. */
  initialError?: string;
  /** Referral code from ?ref= — attributed on sign-up (signup mode only). */
  refCode?: string;
}

const initialState: AuthFormState = {};

export default function AuthForm({
  mode,
  returnTo,
  initialError,
  refCode,
}: AuthFormProps) {
  const isSignup = mode === "signup";
  const action = isSignup ? signUpWithEmail : signInWithEmail;
  const [state, formAction] = useFormState(action, initialState);

  // OAuth lands new users on /onboarding, returning users on their target.
  const oauthNext = isSignup ? "/onboarding" : returnTo ?? "/dashboard";
  const error = state.error ?? initialError;

  return (
    <div className="space-y-5">
      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </p>
      ) : null}

      {state.message ? (
        <p
          role="status"
          className="rounded-lg border border-primary-200 bg-primary-50 px-4 py-3 text-sm text-primary-800"
        >
          {state.message}
        </p>
      ) : null}

      <form action={formAction} className="space-y-4">
        {!isSignup && returnTo ? (
          <input type="hidden" name="returnTo" value={returnTo} />
        ) : null}

        {isSignup && refCode ? (
          <input type="hidden" name="ref" value={refCode} />
        ) : null}

        <div>
          <label
            htmlFor="email"
            className="mb-1.5 block text-sm font-medium text-neutral-700"
          >
            Email address
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            className="h-11 w-full rounded-lg border border-neutral-300 bg-white px-3.5 text-base text-neutral-900 placeholder:text-neutral-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="mb-1.5 block text-sm font-medium text-neutral-700"
          >
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={isSignup ? 8 : undefined}
            autoComplete={isSignup ? "new-password" : "current-password"}
            placeholder={isSignup ? "At least 8 characters" : "••••••••"}
            className="h-11 w-full rounded-lg border border-neutral-300 bg-white px-3.5 text-base text-neutral-900 placeholder:text-neutral-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        <SubmitButton
          size="lg"
          className="w-full"
          pendingLabel={isSignup ? "Creating account…" : "Signing in…"}
        >
          {isSignup ? "Create account" : "Sign in"}
        </SubmitButton>
      </form>

      <div className="flex items-center gap-3" aria-hidden="true">
        <span className="h-px flex-1 bg-neutral-200" />
        <span className="text-xs font-medium uppercase tracking-wide text-neutral-400">
          or
        </span>
        <span className="h-px flex-1 bg-neutral-200" />
      </div>

      <GoogleButton next={oauthNext} />

      <p className="text-center text-sm text-neutral-600">
        {isSignup ? (
          <>
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-semibold text-primary-700 hover:text-primary-800"
            >
              Sign in
            </Link>
          </>
        ) : (
          <>
            New here?{" "}
            <Link
              href="/signup"
              className="font-semibold text-primary-700 hover:text-primary-800"
            >
              Create an account
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
