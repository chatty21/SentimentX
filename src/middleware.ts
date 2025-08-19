// src/middleware.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const { pathname } = req.nextUrl;

  // Gate the public /contact page so it only opens from the About "Contact" button.
  if (pathname.startsWith("/contact")) {
    const cameCookie = req.cookies.get("sx_contact_gate")?.value;
    const referer = req.headers.get("referer") || "";

    // Allow if cookie is present OR user navigated from /about (referrer check).
    if (cameCookie || referer.includes("/about")) {
      // If allowed via referrer, set the short-lived cookie so reload/deep links keep working.
      if (!cameCookie) {
        res.cookies.set({
          name: "sx_contact_gate",
          value: "1",
          path: "/",
          maxAge: 300, // 5 minutes
          sameSite: "lax",
        });
      }
      return res;
    }

    const url = req.nextUrl.clone();
    url.pathname = "/about";
    url.searchParams.set("needContactGate", "1");
    return NextResponse.redirect(url);
  }

  const cookieAdapter = {
    get(name: string) {
      return req.cookies.get(name)?.value;
    },
    set(name: string, value: string, options: CookieOptions) {
      res.cookies.set({ name, value, ...options });
    },
    remove(name: string, options: CookieOptions) {
      res.cookies.set({ name, value: "", ...options, maxAge: 0 });
    },
  } as unknown as Parameters<typeof createServerClient>[2]["cookies"];

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: cookieAdapter }
  );

  const { data: { user } } = await supabase.auth.getUser();

  // Protect only private routes (everything in matcher except /contact)
  if (!user) {
    const next = encodeURIComponent(req.nextUrl.pathname + req.nextUrl.search);
    return NextResponse.redirect(new URL(`/login?next=${next}`, req.url));
  }

  return res;
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/portfolio/:path*",
    "/chat/:path*",
    "/api/chat",
    "/api/portfolio/:path*",
    "/contact/:path*", // run gating for contact page
  ],
};