import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const token = request.cookies.get('auth_token')?.value
  const { pathname } = request.nextUrl

  // Ignore Next.js internals, static files, and api routes
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next()
  }

  // Unauthenticated user trying to access protected route
  if (!token && pathname !== '/login') {
    const loginUrl = new URL('/login', request.url)
    return NextResponse.redirect(loginUrl)
  }

  // Authenticated user trying to access login page
  if (token && pathname === '/login') {
    const zonesUrl = new URL('/hosted-zones', request.url)
    return NextResponse.redirect(zonesUrl)
  }

  // Root path redirect
  if (pathname === '/') {
    const targetUrl = new URL(token ? '/hosted-zones' : '/login', request.url)
    return NextResponse.redirect(targetUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)'],
}
