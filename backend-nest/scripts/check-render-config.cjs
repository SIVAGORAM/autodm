const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const renderPath = path.resolve(__dirname, '../../render.yaml');
const lines = fs.readFileSync(renderPath, 'utf8').split(/\r?\n/);
const serviceStarts = lines
  .map((line, index) => /^  - type: /.test(line) ? index : -1)
  .filter((index) => index >= 0);

function service(name) {
  for (let offset = 0; offset < serviceStarts.length; offset += 1) {
    const start = serviceStarts[offset];
    const end = serviceStarts[offset + 1] ?? lines.length;
    const block = lines.slice(start, end);
    if (!block.some((line) => line.trim() === `name: ${name}`)) continue;
    const envStart = block.findIndex((line) => /^    envVars:\s*$/.test(line));
    assert.notEqual(envStart, -1, `Render service ${name} is missing envVars`);
    const envLines = block.slice(envStart + 1);
    const entries = new Map();
    for (let index = 0; index < envLines.length; index += 1) {
      const key = envLines[index].match(/^      - key: ([A-Z0-9_]+)\s*$/)?.[1];
      if (!key) continue;
      const following = [];
      for (let next = index + 1; next < envLines.length && !/^      - key: /.test(envLines[next]); next += 1) {
        following.push(envLines[next]);
      }
      assert(!entries.has(key), `Render service ${name} declares ${key} more than once`);
      entries.set(key, following.join('\n'));
    }
    return entries;
  }
  assert.fail(`Render service ${name} was not found`);
}

const api = service('relayo-api');
const worker = service('relayo-worker');
const proxy = api.get('META_HTTPS_PROXY') ?? '';
assert.match(proxy, /^\s+sync: false\s*$/m, 'API META_HTTPS_PROXY must remain secret-only in the Render Blueprint');

const inheritedKeys = [
  'DATABASE_URL', 'DIRECT_URL', 'REDIS_URL', 'REDIS_REQUIRE_NOEVICTION', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET',
  'ENCRYPTION_KEY', 'ENCRYPTION_FALLBACK_KEYS', 'META_APP_ID', 'META_APP_SECRET', 'META_HTTPS_PROXY',
  'INSTAGRAM_APP_ID', 'INSTAGRAM_APP_SECRET', 'INSTAGRAM_OAUTH_REDIRECT_URI', 'META_WEBHOOK_VERIFY_TOKEN',
  'META_UNIFIED_LOGIN_ENABLED', 'META_UNIFIED_TOKEN_REFRESH_ENABLED', 'META_LIVE_COMMENTS_ENABLED',
  'META_UNIFIED_LOGIN_CONFIG_ID', 'WEBHOOK_PAYLOAD_RETENTION_DAYS', 'UNVERIFIED_ACCOUNT_RETENTION_DAYS',
  'RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET', 'RAZORPAY_WEBHOOK_SECRET', 'SMTP_HOST', 'SMTP_PORT',
  'SMTP_USER', 'SMTP_PASS', 'MAIL_FROM', 'SUPPORT_NOTIFICATION_EMAIL', 'PUBLIC_URL', 'CORS_ORIGIN',
];

for (const key of inheritedKeys) {
  const reference = worker.get(key);
  assert(reference, `Render worker is missing ${key}`);
  assert.match(reference, /fromService:\s*\n\s+type: web\s*\n\s+name: relayo-api\s*\n\s+envVarKey: /,
    `Render worker ${key} must inherit from relayo-api`);
  assert.match(reference, new RegExp(`envVarKey: ${key}\\s*$`),
    `Render worker ${key} must inherit the matching API variable`);
}

process.stdout.write(`Render API/worker environment contract passed (${inheritedKeys.length} inherited settings).\n`);
