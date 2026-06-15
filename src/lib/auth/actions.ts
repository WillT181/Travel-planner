"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { isStripeConfigured } from "@/lib/stripe/server";
import { ensureStripeCustomer } from "@/lib/stripe/actions";

export interface AuthFormState {
  error?: string;
  /** Set when sign-up succeeded but the user must confirm their email. */
  message?: string;
}

/** Build an absolute origin for OAuth redirect URLs. */
function getOrigin(): string {
  const hdrs = headers();
  const origin = hdrs.get("origin");
  if (origin) return origin;
  const host = hdrs.get("host") ?? "localhost:3000";
  const proto = hdrs.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

function readCredentials(formData: FormData): {
  email: string;
  password: string;
} {
  return {
    email: String(formData.get("email") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
  };
}

export async function signUpWithEmail(
  _prev: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const { email, password } = readCredentials(formData);

  if (!email || !password) {
    return { error: "Email and password are both required." };
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  const supabase = createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${getOrigin()}/auth/callback?next=/onboarding`,
    },
  });

  if (error) {
    return { error: error.message };
  }

  // If email confirmation is disabled, a session is returned immediately.
  if (data.session) {
    // Best-effort: provision a Stripe customer on sign-up. Never block the
    // flow if Stripe is unconfigured or the call fails — checkout re-ensures it.
    if (data.user && isStripeConfigured()) {
      try {
        await ensureStripeCustomer(
          supabase,
          data.user.id,
          data.user.email ?? null
        );
      } catch {
        // ignore — created lazily at checkout
      }
    }
    redirect("/onboarding");
  }

  return {
    message:
      "Check your inbox to confirm your email, then continue to onboarding.",
  };
}

export async function signInWithEmail(
  _prev: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const { email, password } = readCredentials(formData);
  const returnTo = String(formData.get("returnTo") ?? "").trim();

  if (!email || !password) {
    return { error: "Email and password are both required." };
  }

  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: error.message };
  }

  redirect(safeReturnTo(returnTo) ?? "/dashboard");
}

export async function signInWithGoogle(formData: FormData): Promise<void> {
  const next = safeReturnTo(String(formData.get("next") ?? "")) ?? "/dashboard";

  const supabase = createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${getOrigin()}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });

  if (error || !data.url) {
    redirect(
      `/login?error=${encodeURIComponent(error?.message ?? "oauth_failed")}`
    );
  }

  redirect(data.url);
}

export async function signOut(): Promise<void> {
  const supabase = createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

/** Only allow same-site relative paths as redirect targets (no open redirect). */
function safeReturnTo(value: string): string | null {
  if (value && value.startsWith("/") && !value.startsWith("//")) {
    return value;
  }
  return null;
}
