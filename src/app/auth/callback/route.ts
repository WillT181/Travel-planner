import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { recordReferral } from "@/lib/referrals/actions";

/**
 * OAuth / email-confirmation callback. Exchanges the `code` for a session
 * (setting the auth cookie) and redirects to the `next` destination.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const nextParam = searchParams.get("next") ?? "/dashboard";

  // Guard against open redirects — only same-site relative paths.
  const next =
    nextParam.startsWith("/") && !nextParam.startsWith("//")
      ? nextParam
      : "/dashboard";

  if (code) {
    const supabase = createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Attribute a referral captured in the wl_ref cookie (OAuth sign-ups).
      const ref = request.cookies.get("wl_ref")?.value;
      if (ref) {
        try {
          await recordReferral(ref);
        } catch {
          // non-fatal — onboarding completion retries attribution
        }
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(
    `${origin}/login?error=${encodeURIComponent("Could not sign you in. Please try again.")}`
  );
}
