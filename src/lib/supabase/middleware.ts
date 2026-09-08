import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isAdminEmail, localDevAdminEmail, supabaseConfig } from "./config";

/**
 * Refresh the Supabase session cookie and gate /admin.
 * Unauthenticated -> /admin/login. Authenticated but not allow-listed -> /admin/denied.
 */
export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAdminRoute = pathname.startsWith("/admin");
  const isPublicAdminRoute = pathname === "/admin/login" || pathname === "/admin/denied";

  let response = NextResponse.next({ request });
  const cfg = supabaseConfig();

  if (localDevAdminEmail()) return response;

  if (!cfg) {
    // Supabase not configured: the login page explains what's missing; everything else in /admin is closed.
    if (isAdminRoute && !isPublicAdminRoute) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
    return response;
  }

  const supabase = createServerClient(cfg.url, cfg.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // Do not put logic between createServerClient and getUser: it can cause random logouts.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (isAdminRoute && !isPublicAdminRoute) {
    if (!user) {
      const url = new URL("/admin/login", request.url);
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
    if (!isAdminEmail(user.email)) {
      return NextResponse.redirect(new URL("/admin/denied", request.url));
    }
  }

  return response;
}
