const assert = require('node:assert/strict');
const { PHASE_DEVELOPMENT_SERVER, PHASE_PRODUCTION_BUILD } = require('next/constants');
const createNextConfig = require('../next.config.js');

(async () => {
  const development = createNextConfig(PHASE_DEVELOPMENT_SERVER, {});
  const production = createNextConfig(PHASE_PRODUCTION_BUILD, {});

  assert.equal(development.distDir, '.next-dev', 'Next development needs an isolated output directory.');
  assert.equal(production.distDir, '.next-prod', 'Production builds must use an isolated standalone output directory.');
  assert.notEqual(development.distDir, production.distDir, 'Development and production output must never overlap.');
  assert.equal(production.output, 'standalone', 'Production must retain the standalone output directory.');
  assert.equal(production.experimental.cpus, 2, 'Static generation must use a bounded worker count.');

  const originalApiUrl = process.env.NEXT_PUBLIC_API_URL;
  const originalNodeEnv = process.env.NODE_ENV;
  const originalRender = process.env.RENDER;
  try {
    process.env.NEXT_PUBLIC_API_URL = 'https://api.example.test';
    process.env.NODE_ENV = 'production';
    process.env.RENDER = 'true';
    assert.deepEqual(await production.rewrites(), [
      { source: '/api/:path*', destination: 'https://api.example.test/api/:path*' },
    ], 'Browser API calls must use the same-origin API proxy.');
  } finally {
    if (originalApiUrl === undefined) delete process.env.NEXT_PUBLIC_API_URL;
    else process.env.NEXT_PUBLIC_API_URL = originalApiUrl;
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
    if (originalRender === undefined) delete process.env.RENDER;
    else process.env.RENDER = originalRender;
  }

  process.stdout.write('Next.js output directory and same-origin API proxy checks passed (5 assertions).\n');
})().catch((error) => {
  process.stderr.write(`${error.stack ?? error}\n`);
  process.exitCode = 1;
});
