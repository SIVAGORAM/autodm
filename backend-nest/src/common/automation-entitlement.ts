import { PlanDef } from './plan.config';

export interface AutomationEntitlementsInput {
  triggerType?: string;
  mediaId?: string | null;
  matchMode?: string;
  keywords?: string[];
  askToFollow?: boolean;
  collectEmail?: boolean;
  followUpCount?: number;
}

export function automationRestriction(
  plan: PlanDef,
  automation: AutomationEntitlementsInput,
  options: { includeFollowUps?: boolean } = {},
): string | null {
  if (automation.triggerType === 'NEXT_POST') {
    return 'This trigger is not available yet.';
  }
  if (automation.matchMode === 'AI_INTENT') return 'AI intent matching is not available yet.';
  if (automation.askToFollow && !plan.features.askToFollow) {
    return 'Follow gating needs a higher plan.';
  }
  if (automation.collectEmail && !plan.features.collectEmail) {
    return 'Email collection needs a higher plan.';
  }
  if (automation.matchMode === 'KEYWORDS' && (automation.keywords?.length ?? 0) > plan.features.keywordsPerAutomation) {
    return `This automation exceeds the ${plan.features.keywordsPerAutomation}-keyword limit on your current plan.`;
  }
  // A legacy POST_COMMENT row without a media ID behaves like a global
  // comment trigger in the webhook worker, so it must retain ANY_POST's paid
  // entitlement even though new global rules use the explicit ANY_POST type.
  const isGlobalComment = automation.triggerType === 'ANY_POST'
    || (automation.triggerType === 'POST_COMMENT' && (automation.mediaId === null || automation.mediaId?.trim() === ''));
  if ((['STORY_REPLY', 'LIVE_COMMENT', 'DM'].includes(automation.triggerType ?? '') || isGlobalComment) && !plan.features.paidTriggers) {
    return 'This trigger needs a higher plan.';
  }
  if (options.includeFollowUps !== false && (automation.followUpCount ?? 0) > 0 && !plan.features.followUps) {
    return 'Follow-ups need a higher plan.';
  }
  return null;
}
