'use strict';

const assert = require('node:assert/strict');
const { databaseTarget, validateBootstrapRequest } = require('./bootstrap-super-admin-policy.cjs');

const databaseUrl = 'postgresql://user:secret@ep-dev-branch.ap-southeast-1.aws.neon.tech/neondb?sslmode=require';
const target = 'ep-dev-branch.ap-southeast-1.aws.neon.tech/neondb';
const email = 'owner@example.com';
const requiredConfirmation = new Set(['--confirm=CREATE_SUPER_ADMIN', `--confirm-database=${target}`]);

assert.equal(databaseTarget(databaseUrl), target);
assert.doesNotThrow(() => validateBootstrapRequest({ email, flags: requiredConfirmation, env: { NODE_ENV: 'development', DATABASE_URL: databaseUrl } }));
assert.throws(() => validateBootstrapRequest({ email, flags: new Set(['--confirm=CREATE_SUPER_ADMIN']), env: { NODE_ENV: 'development', DATABASE_URL: databaseUrl } }), /Database target confirmation is missing/);
assert.throws(() => validateBootstrapRequest({ email, flags: new Set(['--confirm=CREATE_SUPER_ADMIN', '--confirm-database=other-host/neondb']), env: { NODE_ENV: 'development', DATABASE_URL: databaseUrl } }), /Database target confirmation is missing/);
assert.throws(() => validateBootstrapRequest({ email, flags: requiredConfirmation, env: { NODE_ENV: 'production', DATABASE_URL: databaseUrl } }), /without --allow-production/);
assert.doesNotThrow(() => validateBootstrapRequest({ email, flags: new Set([...requiredConfirmation, '--allow-production']), env: { NODE_ENV: 'production', DATABASE_URL: databaseUrl } }));
assert.throws(() => validateBootstrapRequest({ email, flags: requiredConfirmation, env: { DATABASE_URL: databaseUrl } }), /Set NODE_ENV/);
assert.throws(() => databaseTarget('not-a-url'), /valid PostgreSQL connection URL/);

console.log('Super Admin bootstrap target-policy checks passed (7 assertions).');
