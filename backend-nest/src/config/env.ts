import { z } from 'zod';

export const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url().optional(),
  REDIS_URL: z.string().url(),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),
  ENCRYPTION_KEY: z.string().min(32),
  ENCRYPTION_FALLBACK_KEYS: z.string().default(''),
  META_APP_ID: z.string().default(''),
  META_APP_SECRET: z.string().default(''),
  INSTAGRAM_APP_ID: z.string().default(''),
  INSTAGRAM_APP_SECRET: z.string().default(''),
  INSTAGRAM_OAUTH_REDIRECT_URI: z.string().default(''),
  META_WEBHOOK_VERIFY_TOKEN: z.string().default('change-me'),
  META_GRAPH_VERSION: z.string().default('v26.0'),
  META_HTTPS_PROXY: z.preprocess((value) => value === '' ? undefined : value, z.string().url().optional())
    .refine((value) => {
      if (value === undefined) return true;
      const protocol = new URL(value).protocol;
      return protocol === 'http:' || protocol === 'https:';
    }, 'META_HTTPS_PROXY must use HTTP or HTTPS'),
  META_UNIFIED_LOGIN_ENABLED: z.preprocess(
    (value) => typeof value === 'boolean' ? value : value === 'true' ? true : value === 'false' ? false : undefined,
    z.boolean(),
  ).default(false),
  META_UNIFIED_TOKEN_REFRESH_ENABLED: z.preprocess(
    (value) => typeof value === 'boolean' ? value : value === 'true' ? true : value === 'false' ? false : undefined,
    z.boolean(),
  ).default(false),
  META_UNIFIED_LOGIN_CONFIG_ID: z.string()
    .default('')
    .refine((value) => value === '' || /^\d+$/.test(value), 'META_UNIFIED_LOGIN_CONFIG_ID must contain only digits'),
  CLOUDINARY_CLOUD_NAME: z.string().default(''),
  CLOUDINARY_API_KEY: z.string().default(''),
  CLOUDINARY_API_SECRET: z.string().default(''),
  CLOUDINARY_AVATAR_FOLDER: z.string()
    .regex(/^[a-zA-Z0-9_/-]{1,120}$/, 'CLOUDINARY_AVATAR_FOLDER contains unsupported characters')
    .default('heylaunch/avatars'),
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  RUN_SCHEDULED_JOBS_IN_DEVELOPMENT: z.preprocess(
    (value) => typeof value === 'boolean' ? value : value === 'true' ? true : value === 'false' ? false : undefined,
    z.boolean(),
  ).default(false),
  RUN_DELIVERY_WORKER_IN_DEVELOPMENT: z.preprocess(
    (value) => typeof value === 'boolean' ? value : value === 'true' ? true : value === 'false' ? false : undefined,
    z.boolean(),
  ).default(false),
  RUN_MAIL_OUTBOX_WORKER_IN_DEVELOPMENT: z.preprocess(
    (value) => typeof value === 'boolean' ? value : value === 'true' ? true : value === 'false' ? false : undefined,
    z.boolean(),
  ).default(false),
  LEGAL_POLICY_STATUS: z.enum(['DRAFT', 'APPROVED']).default('DRAFT'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  PUBLIC_URL: z.string().url().default('http://localhost:4000'),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  WEBHOOK_PAYLOAD_RETENTION_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  UNVERIFIED_ACCOUNT_RETENTION_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  MAIL_FROM: z.string().default('HeyLaunch <no-reply@heylaunch.app>'),
  SUPPORT_NOTIFICATION_EMAIL: z.union([z.string().email(), z.literal('')]).optional(),
  COOKIE_SECURE: z.preprocess(
    (value) => typeof value === 'boolean' ? value : value === 'true' ? true : value === 'false' ? false : undefined,
    z.boolean(),
  ).default(false),
  RAZORPAY_KEY_ID: z.string().default(''),
  RAZORPAY_KEY_SECRET: z.string().default(''),
  RAZORPAY_WEBHOOK_SECRET: z.string().default(''),
}).superRefine((env, ctx) => {
  // Older local/deployed configs may keep the primary and prior keys in one
  // comma-separated value. Continue to accept that format while validating
  // each key; new configs should put prior keys in ENCRYPTION_FALLBACK_KEYS.
  const primaryKeys = env.ENCRYPTION_KEY.split(',').map((key) => key.trim());
  if (primaryKeys.some((key) => !key)) {
    ctx.addIssue({ code: 'custom', path: ['ENCRYPTION_KEY'], message: 'ENCRYPTION_KEY key entries must be comma-separated non-empty values.' });
  }
  if (primaryKeys.some((key) => key.length < 32)) {
    ctx.addIssue({ code: 'custom', path: ['ENCRYPTION_KEY'], message: 'Each primary/fallback encryption key must contain at least 32 characters.' });
  }
  const fallbackKeys = env.ENCRYPTION_FALLBACK_KEYS ? env.ENCRYPTION_FALLBACK_KEYS.split(',').map((key) => key.trim()) : [];
  if (fallbackKeys.some((key) => !key)) {
    ctx.addIssue({ code: 'custom', path: ['ENCRYPTION_FALLBACK_KEYS'], message: 'Fallback encryption keys must be comma-separated non-empty values.' });
  }
  if (fallbackKeys.some((key) => key.length < 32)) {
    ctx.addIssue({ code: 'custom', path: ['ENCRYPTION_FALLBACK_KEYS'], message: 'Each fallback encryption key must contain at least 32 characters.' });
  }
  const allEncryptionKeys = [...primaryKeys, ...fallbackKeys];
  if (new Set(allEncryptionKeys).size !== allEncryptionKeys.length) {
    ctx.addIssue({ code: 'custom', path: ['ENCRYPTION_FALLBACK_KEYS'], message: 'Fallback encryption keys must be unique and must not repeat ENCRYPTION_KEY.' });
  }
  if (Boolean(env.INSTAGRAM_APP_ID.trim()) !== Boolean(env.INSTAGRAM_APP_SECRET.trim())) {
    ctx.addIssue({
      code: 'custom',
      path: ['INSTAGRAM_APP_ID'],
      message: 'Configure the Instagram product App ID and App Secret together, or leave both blank to use the legacy META_APP_ID/META_APP_SECRET fallback.',
    });
  }
  if (env.INSTAGRAM_OAUTH_REDIRECT_URI.trim()) {
    try {
      const redirect = new URL(env.INSTAGRAM_OAUTH_REDIRECT_URI);
      if (!['http:', 'https:'].includes(redirect.protocol) || !redirect.hostname || redirect.username || redirect.password ||
          redirect.search || redirect.hash || redirect.pathname !== '/api/instagram/callback') {
        throw new Error('invalid OAuth callback URI shape');
      }
      if (env.NODE_ENV === 'production' && redirect.protocol !== 'https:') {
        throw new Error('production callback must use HTTPS');
      }
      const frontendOrigins = env.CORS_ORIGIN.split(',').flatMap((value) => {
        try { return [new URL(value.trim()).origin]; } catch { return []; }
      });
      if (!frontendOrigins.includes(redirect.origin)) {
        throw new Error('OAuth callback host must match a configured frontend origin');
      }
    } catch {
      ctx.addIssue({
        code: 'custom',
        path: ['INSTAGRAM_OAUTH_REDIRECT_URI'],
        message: 'INSTAGRAM_OAUTH_REDIRECT_URI must use a configured CORS_ORIGIN plus /api/instagram/callback (HTTPS in production), without credentials, query, or fragment.',
      });
    }
  }
  const cloudinaryValues = [env.CLOUDINARY_CLOUD_NAME, env.CLOUDINARY_API_KEY, env.CLOUDINARY_API_SECRET];
  const cloudinaryCount = cloudinaryValues.filter(Boolean).length;
  if (cloudinaryCount > 0 && cloudinaryCount < cloudinaryValues.length) {
    ctx.addIssue({ code: 'custom', path: ['CLOUDINARY_CLOUD_NAME'], message: 'Configure Cloud name, API key, and API secret together, or leave all blank to disable avatar uploads.' });
  }
  if (env.META_UNIFIED_LOGIN_ENABLED) {
    if (!env.META_UNIFIED_LOGIN_CONFIG_ID.trim()) {
      ctx.addIssue({ code: 'custom', path: ['META_UNIFIED_LOGIN_CONFIG_ID'], message: 'Unified Login requires a Facebook Login for Business configuration ID' });
    }
    if (!env.META_APP_ID.trim()) {
      ctx.addIssue({ code: 'custom', path: ['META_APP_ID'], message: 'Unified Login requires the Meta app ID' });
    }
    if (!env.META_APP_SECRET.trim()) {
      ctx.addIssue({ code: 'custom', path: ['META_APP_SECRET'], message: 'Unified Login requires the Meta app secret' });
    }
  }
  if (env.META_UNIFIED_TOKEN_REFRESH_ENABLED && !env.META_UNIFIED_LOGIN_ENABLED) {
    ctx.addIssue({
      code: 'custom',
      path: ['META_UNIFIED_TOKEN_REFRESH_ENABLED'],
      message: 'Unified token refresh requires META_UNIFIED_LOGIN_ENABLED=true.',
    });
  }
  if (env.NODE_ENV !== 'production') return;
  const required: Array<[keyof typeof env, string]> = [
    ['META_APP_ID', 'Meta app ID'],
    ['META_APP_SECRET', 'Meta app secret'],
    ['INSTAGRAM_APP_ID', 'Instagram product App ID'],
    ['INSTAGRAM_APP_SECRET', 'Instagram product App Secret'],
    ['INSTAGRAM_OAUTH_REDIRECT_URI', 'Instagram OAuth callback URL'],
    ['META_WEBHOOK_VERIFY_TOKEN', 'Meta webhook verification token'],
    ['RAZORPAY_KEY_ID', 'Razorpay key ID'],
    ['RAZORPAY_KEY_SECRET', 'Razorpay key secret'],
    ['RAZORPAY_WEBHOOK_SECRET', 'Razorpay webhook secret'],
    ['SMTP_HOST', 'SMTP host'],
    ['SMTP_USER', 'SMTP username'],
    ['SMTP_PASS', 'SMTP password'],
  ];
  for (const [key, label] of required) {
    const value = env[key];
    if (typeof value !== 'string' || !value.trim() || value === 'change-me') {
      ctx.addIssue({ code: 'custom', path: [key], message: `${label} must be configured in production` });
    }
  }
  for (const key of ['DATABASE_URL', 'DIRECT_URL'] as const) {
    const connectionString = env[key];
    if (connectionString) {
      const sslmode = new URL(connectionString).searchParams.get('sslmode')?.toLowerCase();
      if (!sslmode || !['require', 'verify-ca', 'verify-full'].includes(sslmode)) {
        ctx.addIssue({ code: 'custom', path: [key], message: `${key} must require TLS with sslmode=require, verify-ca, or verify-full in production` });
      }
    }
  }
  if (env.META_WEBHOOK_VERIFY_TOKEN.length < 32) {
    ctx.addIssue({ code: 'custom', path: ['META_WEBHOOK_VERIFY_TOKEN'], message: 'Use a webhook verification token of at least 32 characters' });
  }
  if (env.RAZORPAY_WEBHOOK_SECRET.length < 32) {
    ctx.addIssue({ code: 'custom', path: ['RAZORPAY_WEBHOOK_SECRET'], message: 'Use a Razorpay webhook secret of at least 32 characters' });
  }
  if (env.COOKIE_SECURE !== true) {
    ctx.addIssue({ code: 'custom', path: ['COOKIE_SECURE'], message: 'COOKIE_SECURE must be true in production' });
  }
  if (new URL(env.REDIS_URL).protocol !== 'rediss:') {
    ctx.addIssue({ code: 'custom', path: ['REDIS_URL'], message: 'REDIS_URL must use TLS (rediss://) in production' });
  }
  if (!env.PUBLIC_URL.startsWith('https://')) {
    ctx.addIssue({ code: 'custom', path: ['PUBLIC_URL'], message: 'PUBLIC_URL must use HTTPS in production' });
  }
  if (env.CORS_ORIGIN.split(',').some((origin) => !origin.trim().startsWith('https://'))) {
    ctx.addIssue({ code: 'custom', path: ['CORS_ORIGIN'], message: 'All production CORS_ORIGIN values must use HTTPS' });
  }
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors);
    throw new Error('Invalid environment configuration');
  }
  return parsed.data;
}
