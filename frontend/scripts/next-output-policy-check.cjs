const assert = require('node:assert/strict');
const { PHASE_DEVELOPMENT_SERVER, PHASE_PRODUCTION_BUILD } = require('next/constants');
const createNextConfig = require('../next.config.js');

const development = createNextConfig(PHASE_DEVELOPMENT_SERVER, {});
const production = createNextConfig(PHASE_PRODUCTION_BUILD, {});

assert.equal(development.distDir, '.next-dev', 'Next development needs an isolated output directory.');
assert.equal(production.distDir, '.next', 'Production builds must keep the standalone output directory.');
assert.notEqual(development.distDir, production.distDir, 'Development and production output must never overlap.');
assert.equal(production.output, 'standalone', 'Production must retain the standalone deployment output.');

process.stdout.write('Next.js output directory policy checks passed (4 assertions).\n');
