import { z } from 'zod';

const buttonSchema = z.object({
  title: z.string().trim().min(1).max(20),
  url: z.string().url().refine((value) => {
    try {
      const url = new URL(value);
      return (url.protocol === 'https:' || url.protocol === 'http:') && !url.username && !url.password;
    } catch {
      return false;
    }
  }, 'Button URLs must use HTTP or HTTPS and cannot include embedded credentials.'),
});
const blockSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('text'), text: z.string().min(1).max(1000) }),
  z.object({ type: z.literal('buttons'), buttons: z.array(buttonSchema).min(1).max(3) }),
]);

const followUpSchema = z.object({
  order: z.number().int().min(0).default(0),
  condition: z.enum(['DELAY', 'LINK_NOT_CLICKED', 'NO_REPLY']),
  delayMinutes: z.number().int().min(0).max(1439).default(60),
  dmBlocks: z.array(blockSchema).min(1),
});

export const createAutomationSchema = z.object({
  igAccountId: z.string().uuid(),
  name: z.string().min(1).max(120),
  triggerType: z.enum(['POST_COMMENT', 'NEXT_POST', 'ANY_POST', 'STORY_REPLY', 'LIVE_COMMENT', 'DM']),
  mediaId: z.string().trim().min(1).max(128).optional().nullable(),
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

// Accept the old condition values only on updates so existing rows can be
// preserved or migrated off them. AutomationsService rejects adding or
// changing to one of these unsupported values.
const updateFollowUpSchema = followUpSchema.extend({
  id: z.string().uuid().optional(),
  condition: z.enum(['DELAY', 'LINK_NOT_CLICKED', 'NO_REPLY', 'BOUGHT', 'NOT_BOUGHT', 'FORM_NOT_SUBMITTED']),
});
export const updateAutomationSchema = createAutomationSchema.partial().omit({ igAccountId: true }).extend({
  followUps: z.array(updateFollowUpSchema).max(3).optional(),
});
export type CreateAutomationDto = z.infer<typeof createAutomationSchema>;
export type UpdateAutomationDto = z.infer<typeof updateAutomationSchema>;
