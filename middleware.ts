import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { Role } from "@/lib/types";

const roleRoutes: Record<string, Role> = {
  "/admin": "admin",
  "/mentor": "mentor",
  "/student": "student"
};

export async function middleware(request: NextRequest) {
  const response = NextResponse.next();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        }
      }
    }
  );

  const pathname = request.nextUrl.pathname;
  const requiredRole = Object.entries(roleRoutes).find(([prefix]) => pathname.startsWith(prefix))?.[1];
  const protectedRoute = requiredRole || pathname.startsWith("/leaderboard") || pathname.startsWith("/profile");

  if (!protectedRoute) {
    return response;
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role,status")
    .eq("user_id", user.id)
    .single();

  if (!profile || profile.status !== "active") {
    const status = profile?.status ?? "missing";
    return NextResponse.redirect(new URL(`/login?status=${status}`, request.url));
  }

  if (requiredRole && profile.role !== requiredRole) {
    return NextResponse.redirect(new URL(`/${profile.role}`, request.url));
  }

  return response;
}

export const config = {
  matcher: ["/admin/:path*", "/mentor/:path*", "/student/:path*", "/leaderboard/:path*", "/profile/:path*"]
};
