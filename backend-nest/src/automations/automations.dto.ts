import { z } from 'zod';

const buttonSchema = z.object({ title: z.string().min(1).max(20), url: z.string().url() });
const blockSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('text'), text: z.string().min(1).max(1000) }),
  z.object({ type: z.literal('image'), url: z.string().url() }),
  z.object({ type: z.literal('video'), url: z.string().url() }),
  z.object({ type: z.literal('buttons'), buttons: z.array(buttonSchema).min(1).max(3) }),
]);

const followUpSchema = z.object({
  order: z.number().int().min(0).default(0),
  condition: z.enum(['DELAY', 'LINK_NOT_CLICKED', 'NO_REPLY', 'BOUGHT', 'NOT_BOUGHT', 'FORM_NOT_SUBMITTED']),
  delayMinutes: z.number().int().min(0).max(1439).default(60),
  dmBlocks: z.array(blockSchema).min(1),
});

export const createAutomationSchema = z.object({
  igAccountId: z.string().uuid(),
  name: z.string().min(1).max(120),
  triggerType: z.enum(['POST_COMMENT', 'NEXT_POST', 'ANY_POST', 'STORY_REPLY', 'LIVE_COMMENT', 'DM']),
  mediaId: z.string().optional().nullable(),
  matchMode: z.enum(['KEYWORDS', 'ANY', 'AI_INTENT']).default('KEYWORDS'),
  keywords: z.array(z.string().min(1)).default([]),
  publicReplies: z.array(z.string().min(1)).max(3).default([]),
  replyToComment: z.boolean().default(false),
  askToFollow: z.boolean().default(false),
  collectEmail: z.boolean().default(false),
  trackClicks: z.boolean().default(true),
  dmBlocks: z.array(blockSchema).min(1),
  status: z.enum(['DRAFT', 'LIVE', 'PAUSED']).default('DRAFT'),
  followUps: z.array(followUpSchema).max(3).default([]),
});

export const updateAutomationSchema = createAutomationSchema.partial().omit({ igAccountId: true });
export type CreateAutomationDto = z.infer<typeof createAutomationSchema>;
