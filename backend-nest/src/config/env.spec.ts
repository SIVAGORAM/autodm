import { validateEnv } from './env';

const productionEnv = () => ({
  DATABASE_URL: 'postgresql://app:secret@db.example.com/app?sslmode=require',
  DIRECT_URL: 'postgresql://app:secret@db.example.com/app?sslmode=require',
  REDIS_URL: 'rediss://default:secret@redis.example.com:6379',
  REDIS_REQUIRE_NOEVICTION: true,
  JWT_ACCESS_SECRET: 'a'.repeat(40),
  JWT_REFRESH_SECRET: 'b'.repeat(40),
  ENCRYPTION_KEY: 'c'.repeat(40),
  META_APP_ID: 'meta-app-id',
  META_APP_SECRET: 'meta-app-secret',
  INSTAGRAM_APP_ID: 'instagram-app-id',
  INSTAGRAM_APP_SECRET: 'instagram-app-secret',
  META_WEBHOOK_VERIFY_TOKEN: 'a-secure-random-webhook-verification-token',
  RAZORPAY_KEY_ID: 'rzp_live_example',
  RAZORPAY_KEY_SECRET: 'razorpay-secret',
  RAZORPAY_WEBHOOK_SECRET: 'razorpay-webhook-secret-with-32-plus-chars',
  SMTP_HOST: 'smtp.example.com',
  SMTP_USER: 'smtp-user',
  SMTP_PASS: 'smtp-password',
  COOKIE_SECURE: true,
  PUBLIC_URL: 'https://api.example.com',
  CORS_ORIGIN: 'https://app.example.com',
  INSTAGRAM_OAUTH_REDIRECT_URI: 'https://app.example.com/api/instagram/callback',
  NODE_ENV: 'production',
});

describe('production environment validation', () => {
  it('accepts configured production services and secure origins', () => {
    const parsed = validateEnv(productionEnv());
    expect(parsed.COOKIE_SECURE).toBe(true);
    expect(parsed.WEBHOOK_PAYLOAD_RETENTION_DAYS).toBe(30);
    expect(parsed.UNVERIFIED_ACCOUNT_RETENTION_DAYS).toBe(30);
    expect(parsed.LEGAL_POLICY_STATUS).toBe('DRAFT');
    expect(validateEnv({ ...productionEnv(), LEGAL_POLICY_STATUS: 'APPROVED' }).LEGAL_POLICY_STATUS).toBe('APPROVED');
  });

  it('requires explicit noeviction policy enforcement in production', () => {
    expect(validateEnv(productionEnv()).REDIS_REQUIRE_NOEVICTION).toBe(true);
    const log = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => validateEnv({ ...productionEnv(), REDIS_REQUIRE_NOEVICTION: false }))
      .toThrow('Invalid environment configuration');
    log.mockRestore();
  });

  it('keeps Cloudinary uploads disabled until all server-side credentials are set', () => {
    expect(validateEnv({ ...productionEnv(), NODE_ENV: 'development' }).CLOUDINARY_CLOUD_NAME).toBe('');
    const log = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => validateEnv({ ...productionEnv(), NODE_ENV: 'development', CLOUDINARY_CLOUD_NAME: 'creator-cloud' }))
      .toThrow('Invalid environment configuration');
    const parsed = validateEnv({ ...productionEnv(), CLOUDINARY_CLOUD_NAME: 'creator-cloud', CLOUDINARY_API_KEY: 'key', CLOUDINARY_API_SECRET: 'secret' });
    expect(parsed.CLOUDINARY_CLOUD_NAME).toBe('creator-cloud');
    expect(parsed.CLOUDINARY_API_SECRET).toBe('secret');
    log.mockRestore();
  });

  it('keeps Unified Login disabled by default and validates its configuration ID when supplied', () => {
    expect(validateEnv(productionEnv()).META_UNIFIED_LOGIN_ENABLED).toBe(false);
    expect(validateEnv(productionEnv()).META_UNIFIED_TOKEN_REFRESH_ENABLED).toBe(false);
    expect(validateEnv({ ...productionEnv(), META_UNIFIED_LOGIN_CONFIG_ID: '1848584173153195' }).META_UNIFIED_LOGIN_CONFIG_ID)
      .toBe('1848584173153195');
    const log = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => validateEnv({ ...productionEnv(), META_UNIFIED_LOGIN_CONFIG_ID: '1848-abcd' }))
      .toThrow('Invalid environment configuration');
    log.mockRestore();
  });

  it('requires Instagram product credentials as a pair and validates the frontend callback URI', () => {
    const base = productionEnv();
    expect(validateEnv({ ...base, INSTAGRAM_APP_ID: 'instagram-id', INSTAGRAM_APP_SECRET: 'instagram-secret' }))
      .toMatchObject({ INSTAGRAM_APP_ID: 'instagram-id', INSTAGRAM_APP_SECRET: 'instagram-secret' });

    expect(validateEnv({ ...base, INSTAGRAM_APP_ID: '', INSTAGRAM_APP_SECRET: '' }))
      .toMatchObject({ INSTAGRAM_APP_ID: '', INSTAGRAM_APP_SECRET: '' });
    expect(validateEnv({ ...base, INSTAGRAM_OAUTH_REDIRECT_URI: '' }))
      .toMatchObject({ INSTAGRAM_OAUTH_REDIRECT_URI: '' });
    const log = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => validateEnv({ ...base, INSTAGRAM_APP_ID: 'instagram-id', INSTAGRAM_APP_SECRET: '' })).toThrow('Invalid environment configuration');
    expect(() => validateEnv({ ...base, INSTAGRAM_OAUTH_REDIRECT_URI: 'http://app.example.com/api/instagram/callback' }))
      .toThrow('Invalid environment configuration');
    expect(() => validateEnv({ ...base, INSTAGRAM_OAUTH_REDIRECT_URI: 'https://app.example.com/api/auth/callback' }))
      .toThrow('Invalid environment configuration');
    expect(() => validateEnv({ ...base, INSTAGRAM_OAUTH_REDIRECT_URI: 'https://preview.example.com/api/instagram/callback' }))
      .toThrow('Invalid environment configuration');
    expect(validateEnv({ ...base, CORS_ORIGIN: 'https://app.example.com,https://preview.example.com', INSTAGRAM_OAUTH_REDIRECT_URI: 'https://preview.example.com/api/instagram/callback' }))
      .toMatchObject({ INSTAGRAM_OAUTH_REDIRECT_URI: 'https://preview.example.com/api/instagram/callback' });
    log.mockRestore();
  });

  it('validates encryption key rotation inputs', () => {
    const oldKey = 'old-encryption-key-that-is-also-at-least-32-characters';
    const newKey = 'new-encryption-key-that-is-also-at-least-32-characters';
    expect(validateEnv({ ...productionEnv(), ENCRYPTION_KEY: newKey, ENCRYPTION_FALLBACK_KEYS: oldKey }))
      .toMatchObject({ ENCRYPTION_KEY: newKey, ENCRYPTION_FALLBACK_KEYS: oldKey });
    expect(validateEnv({ ...productionEnv(), ENCRYPTION_KEY: `${newKey},${oldKey}` }))
      .toMatchObject({ ENCRYPTION_KEY: `${newKey},${oldKey}` });

    const log = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => validateEnv({ ...productionEnv(), ENCRYPTION_KEY: `${newKey},short-key` })).toThrow('Invalid environment configuration');
    expect(() => validateEnv({ ...productionEnv(), ENCRYPTION_KEY: `${newKey},${newKey}` })).toThrow('Invalid environment configuration');
    expect(() => validateEnv({ ...productionEnv(), ENCRYPTION_FALLBACK_KEYS: 'short-key' })).toThrow('Invalid environment configuration');
    expect(() => validateEnv({ ...productionEnv(), ENCRYPTION_FALLBACK_KEYS: `${oldKey},${oldKey}` })).toThrow('Invalid environment configuration');
    expect(() => validateEnv({ ...productionEnv(), ENCRYPTION_FALLBACK_KEYS: `${oldKey},` })).toThrow('Invalid environment configuration');
    log.mockRestore();
  });

  it('uses direct Meta egress by default and accepts only an explicit HTTP(S) proxy', () => {
    expect(validateEnv(productionEnv()).META_HTTPS_PROXY).toBeUndefined();
    expect(validateEnv({ ...productionEnv(), META_HTTPS_PROXY: 'https://proxy.example.com:8443' }).META_HTTPS_PROXY)
      .toBe('https://proxy.example.com:8443');
    const log = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => validateEnv({ ...productionEnv(), META_HTTPS_PROXY: 'socks5://proxy.example.com:1080' }))
      .toThrow('Invalid environment configuration');
    log.mockRestore();
  });

  it('requires Unified Login configuration and Meta credentials in every environment when enabled', () => {
    const log = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => validateEnv({ ...productionEnv(), NODE_ENV: 'development', META_UNIFIED_LOGIN_ENABLED: true, META_UNIFIED_LOGIN_CONFIG_ID: '' }))
      .toThrow('Invalid environment configuration');
    expect(() => validateEnv({ ...productionEnv(), NODE_ENV: 'development', META_UNIFIED_LOGIN_ENABLED: true, META_APP_SECRET: '' }))
      .toThrow('Invalid environment configuration');
    expect(() => validateEnv({ ...productionEnv(), NODE_ENV: 'development', META_UNIFIED_TOKEN_REFRESH_ENABLED: true }))
      .toThrow('Invalid environment configuration');
    expect(validateEnv({
      ...productionEnv(), NODE_ENV: 'development', META_UNIFIED_LOGIN_ENABLED: true,
      META_UNIFIED_LOGIN_CONFIG_ID: '1848584173153195', META_UNIFIED_TOKEN_REFRESH_ENABLED: true,
    }).META_UNIFIED_TOKEN_REFRESH_ENABLED).toBe(true);
    log.mockRestore();
  });

  it('rejects unknown legal policy status values', () => {
    const log = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => validateEnv({ ...productionEnv(), LEGAL_POLICY_STATUS: 'READY' })).toThrow('Invalid environment configuration');
    log.mockRestore();
  });

  it('accepts an absent or blank optional support notification inbox and rejects invalid addresses', () => {
    expect(validateEnv(productionEnv()).SUPPORT_NOTIFICATION_EMAIL).toBeUndefined();
    expect(validateEnv({ ...productionEnv(), SUPPORT_NOTIFICATION_EMAIL: '' }).SUPPORT_NOTIFICATION_EMAIL).toBe('');
    const log = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => validateEnv({ ...productionEnv(), SUPPORT_NOTIFICATION_EMAIL: 'not-an-email' })).toThrow('Invalid environment configuration');
    log.mockRestore();
  });

  it('rejects webhook payload retention outside the supported range', () => {
    expect(() => validateEnv({ ...productionEnv(), WEBHOOK_PAYLOAD_RETENTION_DAYS: '0' })).toThrow('Invalid environment configuration');
  });

  it('rejects unverified-account retention outside the supported range', () => {
    const log = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => validateEnv({ ...productionEnv(), UNVERIFIED_ACCOUNT_RETENTION_DAYS: '0' })).toThrow('Invalid environment configuration');
    expect(() => validateEnv({ ...productionEnv(), UNVERIFIED_ACCOUNT_RETENTION_DAYS: '366' })).toThrow('Invalid environment configuration');
    log.mockRestore();
  });

  it('rejects placeholder webhook credentials and insecure cookies', () => {
    const env = productionEnv();
    env.META_WEBHOOK_VERIFY_TOKEN = 'change-me';
    env.COOKIE_SECURE = false;
    const log = jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => validateEnv(env)).toThrow('Invalid environment configuration');
    log.mockRestore();
  });

  it('rejects plaintext Redis transport in production', () => {
    const log = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => validateEnv({ ...productionEnv(), REDIS_URL: 'redis://default:secret@redis.example.com:6379' }))
      .toThrow('Invalid environment configuration');
    log.mockRestore();
  });

  it('rejects PostgreSQL URLs without an explicit TLS mode in production', () => {
    const log = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => validateEnv({ ...productionEnv(), DIRECT_URL: 'postgresql://app:secret@db.example.com/app?sslmode=disable' }))
      .toThrow('Invalid environment configuration');
    expect(() => validateEnv({ ...productionEnv(), DATABASE_URL: 'postgresql://app:secret@db.example.com/app' }))
      .toThrow('Invalid environment configuration');
    log.mockRestore();
  });
});

describe('development worker environment flags', () => {
  it('keeps delivery and maintenance workers disabled by default', () => {
    const parsed = validateEnv({ ...productionEnv(), NODE_ENV: 'development' });
    expect(parsed.RUN_DELIVERY_WORKER_IN_DEVELOPMENT).toBe(false);
    expect(parsed.RUN_SCHEDULED_JOBS_IN_DEVELOPMENT).toBe(false);
    expect(parsed.RUN_MAIL_OUTBOX_WORKER_IN_DEVELOPMENT).toBe(false);
  });

  it('accepts explicit development opt-ins as environment strings', () => {
    const parsed = validateEnv({
      ...productionEnv(),
      NODE_ENV: 'development',
      RUN_DELIVERY_WORKER_IN_DEVELOPMENT: 'true',
      RUN_SCHEDULED_JOBS_IN_DEVELOPMENT: 'true',
      RUN_MAIL_OUTBOX_WORKER_IN_DEVELOPMENT: 'true',
    });
    expect(parsed.RUN_DELIVERY_WORKER_IN_DEVELOPMENT).toBe(true);
    expect(parsed.RUN_SCHEDULED_JOBS_IN_DEVELOPMENT).toBe(true);
    expect(parsed.RUN_MAIL_OUTBOX_WORKER_IN_DEVELOPMENT).toBe(true);
  });
});
