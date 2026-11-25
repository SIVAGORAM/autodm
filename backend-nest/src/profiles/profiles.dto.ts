import { z } from 'zod';
import { isIP } from 'node:net';

export const PROFILE_PLATFORMS = [
  'instagram', 'youtube', 'linkedin', 'x', 'facebook', 'tiktok',
  'github', 'whatsapp', 'telegram', 'pinterest', 'website',
] as const;

const normalizeUrlString = (value: string) => {
  let trimmed = (value || '').trim();
  if (trimmed && !/^https?:\/\//i.test(trimmed)) {
    trimmed = `https://${trimmed}`;
  }
  return trimmed;
};

const safeExternalUrl = z.string().trim().min(1).max(2048)
  .transform(normalizeUrlString)
  .pipe(z.string().url())
  .superRefine((value, ctx) => {
  let url: URL;
  try { url = new URL(value); } catch { return; }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) {
    ctx.addIssue({ code: 'custom', message: 'Use an HTTP or HTTPS URL without embedded credentials.' });
  }
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  const ipLiteral = host.replace(/^\[|\]$/g, '');
  const localSuffix = ['.localhost', '.local', '.internal', '.lan', '.home.arpa', '.test', '.invalid', '.example'];
  if (isIP(ipLiteral) !== 0 || !host.includes('.') || host === 'localhost' || localSuffix.some((suffix) => host.endsWith(suffix))) {
    ctx.addIssue({ code: 'custom', message: 'This destination is not allowed.' });
  }
});

const username = z.string().trim().transform((value) => value.toLowerCase())
  .pipe(z.string().min(3).max(30).regex(/^[a-z0-9_]+$/, 'Use 3–30 lowercase letters, numbers, or underscores.'));

const socialLink = z.object({
  platform: z.enum(PROFILE_PLATFORMS),
  title: z.string().trim().min(1).max(80),
  url: safeExternalUrl,
  sortOrder: z.number().int().min(0).max(100),
  isVisible: z.boolean(),
}).strict();

const customLink = z.object({
  title: z.string().trim().min(1).max(80),
  url: safeExternalUrl,
  description: z.string().trim().max(200).nullable(),
  sortOrder: z.number().int().min(0).max(100),
  isVisible: z.boolean(),
}).strict();

export const usernameQuerySchema = z.object({ username }).strict();

export const updatePublicProfileSchema = z.object({
  username,
  displayName: z.string().trim().min(1).max(80),
  bio: z.string().trim().max(160).nullable(),
  visibility: z.enum(['PRIVATE', 'PUBLIC']),
  appearance: z.enum(['LIGHT', 'DARK', 'NEUTRAL']),
  socialLinks: z.array(socialLink).max(11),
  customLinks: z.array(customLink).max(20),
}).strict().superRefine((value, ctx) => {
  const platforms = value.socialLinks.map((link) => link.platform);
  if (new Set(platforms).size !== platforms.length) {
    ctx.addIssue({ code: 'custom', path: ['socialLinks'], message: 'Add each social platform only once.' });
  }
});

export type UpdatePublicProfileInput = z.infer<typeof updatePublicProfileSchema>;
export type PublicProfilePlatform = typeof PROFILE_PLATFORMS[number];
