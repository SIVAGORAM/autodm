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

// These are the trigger types currently routed by WebhookService. Keep the
// database enum's legacy values readable for existing rows, but do not accept
// them in new or edited API payloads.
export const supportedTriggerTypes = ['POST_COMMENT', 'ANY_POST', 'STORY_REPLY', 'STORY_MENTION', 'LIVE_COMMENT', 'DM'] as const;

export const createAutomationSchema = z.object({
  igAccountId: z.string().uuid(),
  name: z.string().min(1).max(120),
  triggerType: z.enum(supportedTriggerTypes),
  mediaId: z.string().trim().min(1).max(128).optional().nullable(),
  // AI_INTENT remains in the database enum for legacy rows, but there is no
  // intent-classification service. Do not let API clients create or restore
  // an automation mode that cannot be executed.
  matchMode: z.enum(['KEYWORDS', 'ANY']).default('KEYWORDS'),
  keywords: z.array(z.string().min(1)).default([]),
  publicReplies: z.array(z.string().min(1)).max(25).default([]),
  replyToComment: z.boolean().default(false),
  autoLikeComment: z.boolean().optional().default(false),
  askToFollow: z.boolean().default(false),
  collectEmail: z.boolean().default(false),
  trackClicks: z.boolean().default(true),
  language: z.enum(['ENGLISH', 'TENGLISH', 'TELUGU_ENGLISH']).optional().default('ENGLISH'),
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
export type CreateAutomationDto = Omit<z.infer<typeof createAutomationSchema>, 'language' | 'autoLikeComment'> & {
  language?: 'ENGLISH' | 'TENGLISH' | 'TELUGU_ENGLISH';
  autoLikeComment?: boolean;
};
export type UpdateAutomationDto = z.infer<typeof updateAutomationSchema>;
