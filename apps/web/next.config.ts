import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
import packageJson from './package.json' with { type: 'json' };

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

// Where the Next.js server reaches the API. Browsers never call it directly:
// /api and /l are proxied, so the app and the API share one origin and the
// session cookie never crosses sites.
const apiUrl = (process.env.API_INTERNAL_URL ?? 'http://localhost:4000').replace(/\/+$/, '');

const config: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  reactStrictMode: true,
  transpilePackages: ['@conversa/shared'],
  // Inlined into the build, so the browser knows which version it runs
  // (src/lib/version.ts). CONVERSA_COMMIT is a Docker build argument.
  env: {
    CONVERSA_VERSION: packageJson.version,
    CONVERSA_COMMIT: process.env.CONVERSA_COMMIT ?? '',
  },
  async rewrites() {
    return [
      { source: '/api/:path*', destination: `${apiUrl}/api/:path*` },
      { source: '/l/:slug', destination: `${apiUrl}/l/:slug` },
    ];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), payment=()',
          },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
        ],
      },
    ];
  },
};

export default withNextIntl(config);
