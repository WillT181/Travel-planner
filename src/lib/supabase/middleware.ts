import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** Route prefixes that require an authenticated user. */
const PROTECTED_PREFIXES = ["/dashboard", "/trip", "/account", "/refer"];

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

/**
 * Refreshes the Supabase auth session on every request (keeping the cookie
 * fresh for Server Components) and gates protected routes. Unauthenticated
 * users hitting a protected path are redirected to /login?returnTo=<path>.
 */
export async function updateSession(
  request: NextRequest
): Promise<NextResponse> {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: getUser() (not getSession) revalidates the token with Supabase.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname, search } = request.nextUrl;

  // Capture a referral code (?ref=CODE) into a cookie so it survives sign-up,
  // including the OAuth round-trip away from the site. Read back at onboarding.
  const ref = request.nextUrl.searchParams.get("ref");
  if (ref && /^[A-Za-z0-9]{4,16}$/.test(ref)) {
    supabaseResponse.cookies.set("wl_ref", ref.toUpperCase(), {
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
      sameSite: "lax",
    });
  }

  if (!user && isProtectedPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("returnTo", `${pathname}${search}`);
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
