import { type NextRequest, NextResponse } from 'next/server';

/** Pages anyone may open without a session. */
const PUBLIC_PATHS = [
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/invite',
  '/legal',
];
const SESSION_COOKIES = ['__Host-conversa_session', 'conversa_session'];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

/**
 * A strict, per-request Content Security Policy: scripts run only with this
 * request's nonce (Next.js tags its own scripts with it), nothing may frame
 * the app, and forms post only to the app itself. Turnstile is the one
 * third party, and only when it is configured.
 */
function contentSecurityPolicy(nonce: string): string {
  const dev = process.env.NODE_ENV === 'development';
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://challenges.cloudflare.com${dev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    // Instagram serves avatars and post thumbnails from its CDNs.
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src 'self'${dev ? ' ws:' : ''}`,
    'frame-src https://challenges.cloudflare.com',
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(dev ? [] : ['upgrade-insecure-requests']),
  ].join('; ');
}

export function proxy(request: NextRequest): NextResponse {
  const { pathname, search } = request.nextUrl;
  const signedIn = SESSION_COOKIES.some((name) => request.cookies.has(name));

  // The cookie's presence is only a hint for routing; the API checks the session itself.
  if (!signedIn && !isPublic(pathname)) {
    const login = new URL('/login', request.url);
    if (pathname !== '/') login.searchParams.set('next', `${pathname}${search}`);
    return NextResponse.redirect(login);
  }

  const nonce = btoa(crypto.randomUUID());
  const csp = contentSecurityPolicy(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  // Lets a server-side prefetch that finds the session gone send the person back here after sign-in.
  requestHeaders.set('x-pathname', `${pathname}${search}`);
  requestHeaders.set('Content-Security-Policy', csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', csp);
  return response;
}

export const config = {
  // Everything except the proxied API, tracked links, Next's assets and static files.
  matcher: [
    {
      source: '/((?!api/|l/|_next/static|_next/image|favicon.ico|icon.svg|robots.txt).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
