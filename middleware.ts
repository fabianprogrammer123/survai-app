import { NextRequest, NextResponse } from "next/server"

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Protect admin routes (except the login page itself)
  if (pathname.startsWith("/admin/")) {
    const session = request.cookies.get("admin_session")
    if (session?.value !== "authenticated") {
      return NextResponse.redirect(new URL("/admin", request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/admin/:path+"],
}
