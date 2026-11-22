const assert = require('node:assert/strict');
const { resolveApiBase } = require('../lib/api-url-policy.cjs');

assert.equal(resolveApiBase(undefined), 'http://localhost:4000');
assert.throws(() => resolveApiBase('', { production: true }), /required for production builds/);
assert.equal(resolveApiBase('https://api.example.test/'), 'https://api.example.test');
assert.throws(() => resolveApiBase('https://api.example.test/api'), /without credentials, path/);
assert.throws(() => resolveApiBase('https://user:pass@api.example.test'), /without credentials, path/);
assert.equal(resolveApiBase('https://api.example.test', { production: true, requireHttps: true }), 'https://api.example.test');
assert.throws(() => resolveApiBase('http://api.example.test', { production: true, requireHttps: true }), /require NEXT_PUBLIC_API_URL to use HTTPS/);
assert.throws(() => resolveApiBase('https://localhost:4000', { production: true, requireHttps: true }), /require NEXT_PUBLIC_API_URL to use HTTPS/);

process.stdout.write('API URL policy checks passed (8 assertions).\n');
