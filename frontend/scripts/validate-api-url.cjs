const { loadEnvConfig } = require('@next/env');
const { resolveApiBase } = require('../lib/api-url-policy.cjs');

loadEnvConfig(process.cwd());
resolveApiBase(process.env.NEXT_PUBLIC_API_URL, {
  production: true,
  requireHttps: process.env.RENDER === 'true',
});
