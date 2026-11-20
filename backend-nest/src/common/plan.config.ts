// ───────────────────────────────────────────────────────────────────────────
// SINGLE SOURCE OF TRUTH for every plan, limit, quota, price and feature gate.
// Change pricing or limits HERE and it flows to: account caps, DM quotas,
// feature gating, Razorpay amounts, and the billing page. Nothing is hard-coded
// anywhere else.
// ───────────────────────────────────────────────────────────────────────────

export type Tier = 'FREE' | 'CREATOR' | 'PRO' | 'AGENCY';

// Order matters: used for upgrade/downgrade comparisons and card order.
export const TIER_ORDER: Tier[] = ['FREE', 'CREATOR', 'PRO', 'AGENCY'];
export const PAID_TIERS: Tier[] = ['CREATOR', 'PRO', 'AGENCY'];

// A paid subscription lasts this many days before it needs renewing.
export const PLAN_DAYS = 30;

export interface PlanFeatures {
  keywordsPerAutomation: number; // how many keywords one automation may match
  paidTriggers: boolean;         // Stories, Lives, incoming DMs (beyond post comments)
  followUps: boolean;            // scheduled follow-up messages
  askToFollow: boolean;          // follow-gate
  collectEmail: boolean;         // email capture step
  leadCollection: boolean;       // lead export / CRM view
  clientWorkspaces: boolean;     // agency: separate client spaces
  teamSeats: boolean;            // agency: invite teammates
  removeBranding: boolean;       // drop the "powered by Relayo" badge
}

export interface PlanDef {
  id: Tier;
  name: string;
  pricePaise: number;   // monthly price in paise, for Razorpay (0 = free)
  priceLabel: string;   // display, e.g. "₹299"
  tagline: string;
  accountCap: number;   // max connected Instagram accounts
  dmQuota: number;      // max DMs triggered per calendar month
  features: PlanFeatures;
  highlights: string[]; // bullet list for the billing card
}

const BIG = 9999; // effectively "unlimited" keywords

export const PLANS: Record<Tier, PlanDef> = {
  FREE: {
    id: 'FREE',
    name: 'Free',
    pricePaise: 0,
    priceLabel: '₹0',
    tagline: 'Try it out',
    accountCap: 1,
    dmQuota: 150,
    features: {
      keywordsPerAutomation: 1,
      paidTriggers: false,
      followUps: false,
      askToFollow: false,
      collectEmail: false,
      leadCollection: false,
      clientWorkspaces: false,
      teamSeats: false,
      removeBranding: false,
    },
    highlights: [
      '1 Instagram account',
      '1 keyword per automation',
      '150 DMs / month',
      'Post & Reel comment triggers',
      'Live status + delivery log',
    ],
  },
  CREATOR: {
    id: 'CREATOR',
    name: 'Creator',
    pricePaise: 29900, // ₹299
    priceLabel: '₹299',
    tagline: 'For growing creators',
    accountCap: 2,
    dmQuota: 2000,
    features: {
      keywordsPerAutomation: 5,
      paidTriggers: true,
      followUps: true,
      askToFollow: true,
      collectEmail: true,
      leadCollection: false,
      clientWorkspaces: false,
      teamSeats: false,
      removeBranding: true,
    },
    highlights: [
      '2 Instagram accounts',
      'Up to 5 keywords per automation',
      '2,000 DMs / month',
      'Stories, Lives & incoming DMs',
      'Follow-ups & ask-to-follow',
      'Branding removed',
    ],
  },
  PRO: {
    id: 'PRO',
    name: 'Pro',
    pricePaise: 59900, // ₹599
    priceLabel: '₹599',
    tagline: 'For serious businesses',
    accountCap: 5,
    dmQuota: 10000,
    features: {
      keywordsPerAutomation: BIG,
      paidTriggers: true,
      followUps: true,
      askToFollow: true,
      collectEmail: true,
      leadCollection: true,
      clientWorkspaces: false,
      teamSeats: false,
      removeBranding: true,
    },
    highlights: [
      '5 Instagram accounts',
      'Unlimited keywords',
      '10,000 DMs / month',
      'Advanced workflows',
      'Lead collection & export',
      'Priority support',
    ],
  },
  AGENCY: {
    id: 'AGENCY',
    name: 'Agency',
    pricePaise: 149900, // ₹1,499
    priceLabel: '₹1,499',
    tagline: 'For teams & agencies',
    accountCap: 15,
    dmQuota: 50000,
    features: {
      keywordsPerAutomation: BIG,
      paidTriggers: true,
      followUps: true,
      askToFollow: true,
      collectEmail: true,
      leadCollection: true,
      clientWorkspaces: true,
      teamSeats: true,
      removeBranding: true,
    },
    highlights: [
      '15 Instagram accounts',
      'Unlimited keywords',
      '50,000 DMs / month',
      'Client workspaces',
      'Team access & seats',
      'White-label client reports',
    ],
  },
};

export function planDef(tier: Tier): PlanDef {
  return PLANS[tier] ?? PLANS.FREE;
}
