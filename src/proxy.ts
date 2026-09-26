import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  // Supabase falls back to the Site URL when a redirect isn't allow-listed, so an
  // email confirmation or reset link can land on any page with ?code=. Finish it.
  const code = searchParams.get("code");
  if (code && pathname !== "/auth/callback") {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/callback";
    url.search = "";
    url.searchParams.set("code", code);
    url.searchParams.set("next", searchParams.get("next") ?? "/app");
    return NextResponse.redirect(url);
  }
  return updateSession(request);
}

export const config = {
  matcher: [
    "/app/:path*",
    "/admin/:path*",
    "/admin",
    "/login",
    "/auth/:path*",
    // Any page carrying an auth code (only matches when ?code= is present).
    { source: "/((?!_next/static|_next/image|favicon.ico|icon.svg).*)", has: [{ type: "query", key: "code" }] },
  ],
};
