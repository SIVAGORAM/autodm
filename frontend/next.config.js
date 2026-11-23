const path = require('path');
const { PHASE_DEVELOPMENT_SERVER } = require('next/constants');
const { resolveApiBase } = require('./lib/api-url-policy.cjs');

/** @type {import('next').NextConfig} */
const createNextConfig = (phase) => ({
  // `next dev` and `next build` must not share manifests or chunks. A build
  // during local development otherwise replaces `.next` files that the dev
  // server still references, producing missing chunk/CSS responses.
  distDir: phase === PHASE_DEVELOPMENT_SERVER ? '.next-dev' : '.next-prod',
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '..'),
  // Keep static generation deterministic on constrained/Windows build hosts.
  // Multiple workers have intermittently observed Next's generated manifests
  // before they were fully written during local production builds.
  experimental: { cpus: 2 },
  // Proxy browser API calls through the frontend origin. This keeps HTTP-only
  // auth cookies first-party even when the API and web app use separate hosts.
  async rewrites() {
    const apiOrigin = resolveApiBase(process.env.NEXT_PUBLIC_API_URL, {
      production: process.env.NODE_ENV === 'production',
      requireHttps: process.env.RENDER === 'true',
    });
    return [{ source: '/api/:path*', destination: `${apiOrigin}/api/:path*` }];
  },
  // The build script runs ESLint directly; Next 15's embedded lint wrapper
  // currently misreads this ESLint 9 flat config.
  eslint: { ignoreDuringBuilds: true },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
});

module.exports = createNextConfig;
