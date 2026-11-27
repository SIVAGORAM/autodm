import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  CheckCircle2,
  MessageCircle,
  ShieldCheck,
  UserCheck,
  Flame,
} from 'lucide-react';
import { LEGAL_POLICIES_APPROVED } from '../lib/legal-policy';
import { LandingReplyDemo } from '../components/landing-reply-demo';
import styles from './page.module.css';

const signupCtaHref = LEGAL_POLICIES_APPROVED ? '/signup' : '/contact';
const signupCtaLabel = LEGAL_POLICIES_APPROVED ? 'Start free' : 'Contact us';

export const metadata: Metadata = {
  title: 'HeyLaunch — Instagram Automation for Reels, Comments & Stories',
  description:
    'The #1 Instagram automation platform built for creators. Automate Reel comments, Story mentions, viral giveaways, and chat in native Hinglish & Tenglish without ManyChat’s expensive fees.',
  openGraph: {
    title: 'HeyLaunch — Instagram Automation for Reels, Comments & Stories',
    description:
      'Turn Reel comments into instant link deliveries, convert casual viewers into followers with Follow-First, appreciate Story mentions, and chat natively in Hinglish & Tenglish.',
    type: 'website',
    siteName: 'HeyLaunch',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'HeyLaunch — Instagram Automation for Reels, Comments & Stories',
    description:
      'Automate Reel comments, Story mentions, viral giveaways, and chat in native Hinglish & Tenglish.',
  },
};

const superpowers = [
  {
    badge: 'Fan Loyalty Booster ❤️',
    badgeTone: '#ec4899',
    badgeBg: 'rgba(236, 72, 153, 0.12)',
    title: 'Story Mention Automation',
    description:
      'When fans tag your handle (@yourhandle) in their Instagram Story, HeyLaunch automatically sends a warm thank-you DM within seconds.',
    advantage: 'ManyChat locks this behind $45–$100/mo plans. Included in HeyLaunch.',
    previewTitle: 'Automated Story DM',
    previewText: '“Thank you so much for the story mention! Means the world to me 🙌 Here is a special gift link for you ✨”',
  },
  {
    badge: '150M+ Audience 🇮🇳',
    badgeTone: '#f59e0b',
    badgeBg: 'rgba(245, 158, 11, 0.12)',
    title: 'Native Hinglish & Tenglish',
    description:
      'Don’t sound like an American corporate robot. Text your audience the way they actually talk with authentic regional Indian phrasing.',
    advantage: 'ManyChat has ZERO regional Indian language support. Our biggest regional moat.',
    previewTitle: 'Hinglish Reply & Follow Prompt',
    previewText: '“Bhai DM check karo! Link bhej diya hai 📩” · Buttons: [Profile Dekho ↗] and [Follow Kar Liya ⚡]',
  },
  {
    badge: 'Follower Multiplier 👤',
    badgeTone: '#17827E',
    badgeBg: 'rgba(23, 130, 126, 0.12)',
    title: 'Follow-First Verification',
    description:
      'Verify if a commenter follows your account before delivering the secret resource or link. Prompts non-followers to follow first.',
    advantage: 'Converts 60%+ of viral Reel commenters into permanent followers.',
    previewTitle: 'Follow-to-Unlock Gate',
    previewText: '“Arey ruko bro! Pehle @username ko follow karo, fir link unlock ho jayega ✨”',
  },
  {
    badge: 'Viral Growth 🎁',
    badgeTone: '#8b5cf6',
    badgeBg: 'rgba(139, 92, 246, 0.12)',
    title: '1-Click Viral Giveaway Picker',
    description:
      'Host “Comment GIFT to win” contests on Reels. HeyLaunch automatically delivers unique lucky ticket numbers (#4182) to verified followers.',
    advantage: 'Replaces 3 paid third-party contest websites with built-in confetti winner draw.',
    previewTitle: 'Automated DM & Dashboard Draw',
    previewText: '“You’re entered! Your lucky ticket # is 4182 🎟️” · 1-Click Pick Winner + CSV Export',
  },
  {
    badge: 'Algorithm Booster 🔥',
    badgeTone: '#f43f5e',
    badgeBg: 'rgba(244, 63, 94, 0.12)',
    title: 'Auto-Like User Comments',
    description:
      'Automatically gives a heart ❤️ to their comment within seconds. Notifies the commenter instantly and signals high engagement velocity to Instagram.',
    advantage: 'Signals the Instagram algorithm to push your Reel to the Explore page.',
    previewTitle: 'Instant Comment Like',
    previewText: 'Notification on commenter’s phone: “@yourhandle liked your comment ❤️”',
  },
  {
    badge: 'Weekly Digest 📩',
    badgeTone: '#0ea5e9',
    badgeBg: 'rgba(14, 165, 233, 0.12)',
    title: 'Weekly Creator Celebration Email',
    description:
      'Every Monday at 9:00 AM, receive a beautifully branded performance report tallying DMs delivered, new followers gained, and top Reel click rates.',
    advantage: 'Take a screenshot and share it straight to your Instagram Story for viral authority.',
    previewTitle: 'Monday Morning Report',
    previewText: '“🎉 Siva, your automations were on fire! 840 DMs delivered · 320 New followers · Top Reel (62% CTR)”',
  },
];

const plans = [
  {
    name: 'Free',
    price: '₹0',
    cadence: '',
    note: 'Everything you need to get started.',
    features: [
      '1 Instagram Professional account',
      '150 automated DMs / month',
      'Reel & Post comment automations',
      'Story Mention fan appreciation',
      'Native Hinglish & Tenglish replies',
      'Auto-Like comment algorithm booster',
      'Viral giveaway ticket generator',
      'Live delivery logs & analytics',
    ],
  },
  {
    name: 'Creator',
    price: '₹299',
    cadence: '/ 30 days',
    note: 'For growing creators posting daily Reels.',
    features: [
      '2 Instagram accounts',
      '2,000 automated DMs / month',
      'Up to 5 trigger keywords per post',
      'Follow-First follower verification',
      '1-Click Random Giveaway Winner Draw',
      'Story Mention fan automation',
      'Multi-step DM follow-up sequences',
      'Native Hinglish, Tenglish & English',
    ],
  },
  {
    name: 'Pro',
    price: '₹599',
    cadence: '/ 30 days',
    note: 'For high-growth creators & brands.',
    features: [
      '5 Instagram accounts',
      '10,000 automated DMs / month',
      'Unlimited keywords per automation',
      'Custom link tracking & CTR analytics',
      'Weekly Creator Celebration Email digest',
      'Export giveaway entries to CSV',
      'Voluntary email lead capture',
      'Priority delivery queue',
    ],
    featured: true,
  },
  {
    name: 'Agency',
    price: '₹1,499',
    cadence: '/ 30 days',
    note: 'For marketing agencies & managers.',
    features: [
      '15 Instagram accounts',
      '50,000 automated DMs / month',
      'Unlimited automations & keywords',
      'Full feature access across all clients',
      'Click tracking & conversion analytics',
      'High-volume concurrent throughput',
      'Priority email & WhatsApp support',
    ],
  },
];

const faqs = [
  {
    question: 'Which Instagram content can I automate with HeyLaunch?',
    answer:
      'You can automate comments on Instagram Reels, Carousels, and Photos, as well as incoming direct message keywords and Instagram Story Mentions (when a fan tags you in their Story).',
  },
  {
    question: 'How is HeyLaunch different from ManyChat?',
    answer:
      'ManyChat charges expensive US-dollar pricing ($15 to $100+/month), locks Story Mention automation behind expensive higher tiers, and has zero native support for regional languages. HeyLaunch is built specifically for creators with transparent pricing (starting at ₹0 and ₹299/mo), native Hinglish & Tenglish support, built-in viral giveaway pickers, and Follow-First verification.',
  },
  {
    question: 'How does Follow-First verification grow my follower count?',
    answer:
      'When someone comments on your Reel requesting a link or preset, HeyLaunch checks if they already follow you. If they don’t, it sends a friendly DM prompting them to follow before the link unlocks. When they tap the “Followed!” button, HeyLaunch verifies their follow and instantly unlocks the link—turning 60%+ of commenters into permanent followers.',
  },
  {
    question: 'Can I reply in regional languages like Hinglish and Tenglish?',
    answer:
      'Yes! HeyLaunch has a native regional language engine. You can select Hinglish (Hindi in English letters) or Tenglish (Telugu in English letters) with one click to send natural, human-sounding replies like “Bhai DM check karo! Link bhej diya hai 📩” with matching quick-reply buttons.',
  },
  {
    question: 'How does the 1-Click Viral Giveaway Picker work?',
    answer:
      'When hosting a contest on your Reel, participants comment your keyword (e.g., “GIFT”). HeyLaunch automatically issues them a unique sequential ticket number in DM (e.g., “You’re entered! Ticket #4182 🎟️”). When the contest ends, you click “Pick Random Winner” in your dashboard for a celebratory confetti draw and export all entries to CSV.',
  },
  {
    question: 'Do I need to share my Instagram password?',
    answer:
      'Never. HeyLaunch uses the official Meta Instagram Graph API OAuth authorization flow. We never ask for your password, and we never use fragile browser automation or scraping bots that could risk your account.',
  },
  {
    question: 'Do paid plans renew automatically?',
    answer:
      'No. In accordance with Indian payment standards, each payment provides 30 days of access with no unexpected recurring card charges. You can renew manually whenever you want to continue.',
  },
];

function Brand() {
  return (
    <Link href="/" className={styles.brand} aria-label="HeyLaunch home">
      <Image src="/heylaunch-logo.png" alt="HeyLaunch" width={130} height={37} priority />
    </Link>
  );
}

export default function Home() {
  return (
    <main className={styles.site} id="top">
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Brand />
          <nav aria-label="Main navigation" className={styles.desktopNav}>
            <a href="#superpowers">Features</a>
            <a href="#how-it-works">How it works</a>
            <a href="#plans">Plans</a>
            <a href="#questions">Questions</a>
          </nav>
          <div className={styles.headerActions}>
            <Link href="/login" className={styles.login}>Log in</Link>
            <Link href={signupCtaHref} className={styles.headerCta}>{signupCtaLabel}<ArrowUpRight size={16} aria-hidden="true" /></Link>
          </div>
          <details className={styles.mobileNav}>
            <summary aria-label="Open navigation"><span /><span /></summary>
            <nav aria-label="Mobile navigation">
              <a href="#superpowers">Features</a>
              <a href="#how-it-works">How it works</a>
              <a href="#plans">Plans</a>
              <a href="#questions">Questions</a>
              <Link href="/login">Log in</Link>
              <Link href={signupCtaHref}>{signupCtaLabel}</Link>
            </nav>
          </details>
        </div>
      </header>

      {!LEGAL_POLICIES_APPROVED && (
        <div className={styles.previewNotice} role="status">
          <span className={styles.noticeMark} aria-hidden="true" />
          <span><strong>Launch preview</strong> Sign-up and checkout are paused while draft policies are reviewed.</span>
          <a href="#plans">See plan details <ArrowRight size={14} aria-hidden="true" /></a>
        </div>
      )}

      {/* HERO SECTION */}
      <section className={styles.hero} aria-labelledby="hero-title">
        <div className={styles.heroInner}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}><span className={styles.eyebrowRule} />Instagram Automation for Modern Creators &amp; Reels 🚀</p>
            <h1 id="hero-title">Grow your audience.<br /><span>Automate with heart.</span></h1>
            <p className={styles.heroLead}>Turn Reel comments into instant link deliveries, convert casual viewers into followers with Follow-First, appreciate Story mentions, and chat natively in Hinglish &amp; Tenglish.</p>
            <div className={styles.heroActions}>
              <Link href={signupCtaHref} className={styles.primaryButton}>{signupCtaLabel}<ArrowUpRight size={17} aria-hidden="true" /></Link>
              <a href="#superpowers" className={styles.secondaryButton}>Explore creator superpowers<ArrowDownRight size={16} aria-hidden="true" /></a>
            </div>
            <p className={styles.heroTrust}><ShieldCheck size={16} aria-hidden="true" />Official Meta Instagram Graph API · Zero password sharing · 100% Policy Safe</p>
          </div>
          <LandingReplyDemo />
        </div>
        <div className={styles.audienceLine}>
          <span>Trusted by creators who take community seriously</span>
          <div><span>Reel Creators &amp; Influencers</span><span>Educators &amp; Coaches</span><span>E-commerce Brands</span><span>Agencies</span></div>
        </div>
      </section>

      {/* SUPERPOWERS SHOWCASE */}
      <section className={styles.superpowersSection} id="superpowers" aria-labelledby="superpowers-title">
        <div className={styles.superpowersHead}>
          <p className={styles.eyebrow}><span className={styles.eyebrowRule} />Why Creators Choose HeyLaunch over ManyChat</p>
          <h2 id="superpowers-title">Built with the features <span>creators actually asked for.</span></h2>
          <p>No generic corporate bots. HeyLaunch is engineered with high-converting growth loops that turn comments into followers and customers.</p>
        </div>

        <div className={styles.superpowersGrid}>
          {superpowers.map((sp, idx) => (
            <article key={idx} className={styles.superpowerCard}>
              <span
                className={styles.superpowerBadge}
                style={{ color: sp.badgeTone, background: sp.badgeBg }}
              >
                {sp.badge}
              </span>
              <h3>{sp.title}</h3>
              <p>{sp.description}</p>
              <div style={{ marginBottom: 14, fontSize: 11.5, fontWeight: 650, color: '#16a34a' }}>
                ✓ {sp.advantage}
              </div>
              <div className={styles.superpowerPreview}>
                <small>{sp.previewTitle}</small>
                <strong>{sp.previewText}</strong>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* STORY SECTION */}
      <section className={styles.storySection} aria-labelledby="story-title">
        <div className={styles.storyInner}>
          <p className={styles.sectionNumber}><span>01</span> The reason we built HeyLaunch</p>
          <div className={styles.storyContent}>
            <h2 id="story-title">A comment is a person asking for the <em>next step.</em></h2>
            <div className={styles.storyAside}>
              <p>When you post a viral Reel, replying to 500 comments manually is impossible. HeyLaunch ensures every fan gets an instant, personal response while you focus on creating.</p>
              <a href="#how-it-works">See how it works <ArrowRight size={15} aria-hidden="true" /></a>
            </div>
          </div>
        </div>
      </section>

      {/* WORKFLOW SECTION */}
      <section className={styles.workflowSection} id="how-it-works" aria-labelledby="workflow-title">
        <div className={styles.workflowHeader}>
          <div><p className={styles.eyebrow}><span className={styles.eyebrowRule} />A clear path from comment to customer</p><h2 id="workflow-title">Set the rule.<br />Stay in the loop.</h2></div>
          <p>Choose any Reel, post, or Story trigger. Set your keywords. Choose your language. HeyLaunch handles the rest 24/7.</p>
        </div>
        <div className={styles.workflowSteps}>
          <article className={styles.workflowStep}>
            <span className={styles.stepNumber}>01</span><span className={styles.stepRule} aria-hidden="true" />
            <h3>Choose a trigger</h3><p>Select a Reel, Carousel, any new post, or set an automated Story Mention appreciation rule.</p>
          </article>
          <article className={styles.workflowStep}>
            <span className={styles.stepNumber}>02</span><span className={styles.stepRule} aria-hidden="true" />
            <h3>Match &amp; verify</h3><p>Trigger on keywords (e.g., “LINK” or “GIFT”), auto-like their comment, and verify follower status.</p>
          </article>
          <article className={styles.workflowStep}>
            <span className={styles.stepNumber}>03</span><span className={styles.stepRule} aria-hidden="true" />
            <h3>Deliver &amp; celebrate</h3><p>Deliver the resource in English, Hinglish, or Tenglish. Review open rates and get your Monday celebration email.</p>
          </article>
        </div>
        <div className={styles.activityPanel} aria-label="Illustrative HeyLaunch activity log">
          <div className={styles.activityHeading}><div><span className={styles.activityDot} /><strong>Real-time delivery log</strong></div><span>Live dashboard preview</span></div>
          <div className={styles.activityEntry}><span className={styles.activityGlyph}><Flame size={17} aria-hidden="true" /></span><div><strong>Auto-liked user comment</strong><small>Post comment · @creator_fan</small></div><span className={styles.activityStatus}>Boosted ❤️</span></div>
          <div className={styles.activityEntry}><span className={styles.activityGlyph}><UserCheck size={17} aria-hidden="true" /></span><div><strong>Follower status verified</strong><small>Follow-first gate unlocked</small></div><span className={styles.activityStatus}>Verified 👤</span></div>
          <div className={styles.activityEntry}><span className={styles.activityGlyph}><MessageCircle size={17} aria-hidden="true" /></span><div><strong>Private DM delivered</strong><small>Lightroom Preset link dispatched</small></div><span className={styles.activityStatus}>Delivered ⚡</span></div>
          <p className={styles.activityNote}>Connected securely to Meta Instagram Graph API.</p>
        </div>
      </section>

      {/* USE CASES */}
      <section className={styles.useCases} aria-labelledby="usecases-title">
        <div className={styles.useCaseIntro}>
          <p className={styles.sectionNumber}><span>02</span> Built for real creators</p>
          <h2 id="usecases-title">More growth.<br />Less busywork.</h2>
          <p>Automate repetitive questions and lead magnets so you can spend your time making great content.</p>
        </div>
        <div className={styles.useCaseList}>
          <article><span>Reel Creators &amp; Influencers</span><h3>Turn viral Reels into massive follower growth.</h3><p>Use Follow-First verification on your presets, templates, or resources to add hundreds of new followers on every video.</p></article>
          <article><span>Educators &amp; Coaches</span><h3>Deliver guides, webinars, and course links instantly.</h3><p>Provide the destination your audience is asking for while their intent is at its absolute peak.</p></article>
          <article><span>E-commerce &amp; Brands</span><h3>Drive traffic directly to product pages &amp; discounts.</h3><p>Track every button click with built-in analytics and recover abandoned interactions with automated follow-ups.</p></article>
        </div>
      </section>

      {/* PRICING */}
      <section className={styles.pricingSection} id="plans" aria-labelledby="plans-title">
        <div className={styles.pricingInner}>
          <div className={styles.pricingHead}><div><p className={styles.eyebrow}><span className={styles.eyebrowRule} />Affordable plans in Indian Rupees (₹)</p><h2 id="plans-title">Start free.<br />Grow at your pace.</h2></div><p>{LEGAL_POLICIES_APPROVED ? 'Start with a 2-day Pro trial after verified sign-up. No credit card required.' : 'Plan details are available for review. Sign-up and checkout are paused while draft policies are reviewed.'}</p></div>
          <div className={styles.planGrid}>
            {plans.map((plan) => (
              <article key={plan.name} className={`${styles.plan} ${plan.featured ? styles.planFeatured : ''}`}>
                {plan.featured && <span className={styles.planFlag}>Most popular</span>}
                <h3>{plan.name}</h3><p className={styles.planNote}>{plan.note}</p>
                <p className={styles.planPrice}>{plan.price}<span>{plan.cadence}</span></p>
                <ul>{plan.features.map((feature) => <li key={feature}><CheckCircle2 size={16} aria-hidden="true" />{feature}</li>)}</ul>
                <Link className={styles.planCta} href={signupCtaHref}>{LEGAL_POLICIES_APPROVED && plan.name !== 'Free' ? 'Start free trial' : signupCtaLabel}<ArrowUpRight size={15} aria-hidden="true" /></Link>
              </article>
            ))}
          </div>
          <p className={styles.planCaveat}>Each paid plan provides 30 days of full access with manual renewal—no hidden auto-debits. Compliant with RBI and Indian payment regulations.</p>
        </div>
      </section>

      {/* SCOPE & TRUST */}
      <section className={styles.scopeSection} aria-labelledby="scope-title">
        <div className={styles.scopeTop}>
          <p className={styles.sectionNumber}><span>03</span> Complete transparency</p>
          <h2 id="scope-title">What is live &amp; <em>ready today.</em></h2>
        </div>
        <div className={styles.scopeBody}>
          <p>HeyLaunch is built on the official Meta Graph API v26.0 with high-durability task queues. Here is our live feature status:</p>
          <div className={styles.scopeRows}>
            <div><Check size={16} aria-hidden="true" /><strong>Reel &amp; Post Comment Automations</strong><span style={{ color: '#16a34a', fontWeight: 600 }}>Live &amp; Verified</span></div>
            <div><Check size={16} aria-hidden="true" /><strong>Story Mention Fan Appreciation</strong><span style={{ color: '#16a34a', fontWeight: 600 }}>Live &amp; Verified</span></div>
            <div><Check size={16} aria-hidden="true" /><strong>Follow-First Verification &amp; Auto-Like</strong><span style={{ color: '#16a34a', fontWeight: 600 }}>Live &amp; Verified</span></div>
            <div><Check size={16} aria-hidden="true" /><strong>Native Hinglish &amp; Tenglish Regional Engine</strong><span style={{ color: '#16a34a', fontWeight: 600 }}>Live &amp; Verified</span></div>
            <div><Check size={16} aria-hidden="true" /><strong>1-Click Viral Giveaway Lucky Draw Picker</strong><span style={{ color: '#16a34a', fontWeight: 600 }}>Live &amp; Verified</span></div>
            <div><Check size={16} aria-hidden="true" /><strong>Public Creator Bio Profiles (/[username])</strong><span style={{ color: '#16a34a', fontWeight: 600 }}>Live &amp; Verified</span></div>
            <div><Check size={16} aria-hidden="true" /><strong>Weekly Creator Celebration Email Digest</strong><span style={{ color: '#16a34a', fontWeight: 600 }}>Live &amp; Verified</span></div>
          </div>
        </div>
      </section>

      {/* FAQS */}
      <section className={styles.faqSection} id="questions" aria-labelledby="faq-title">
        <div className={styles.faqTitle}><p className={styles.eyebrow}><span className={styles.eyebrowRule} />Before you get started</p><h2 id="faq-title">Frequently asked<br />questions.</h2></div>
        <div className={styles.faqList}>{faqs.map((faq, index) => <details key={faq.question} className={styles.faq}><summary><span><small>{String(index + 1).padStart(2, '0')}</small>{faq.question}</span><ChevronDown size={19} aria-hidden="true" /></summary><p>{faq.answer}</p></details>)}</div>
      </section>

      {/* LAST CALL CTA */}
      <section className={styles.lastCall}>
        <div className={styles.lastCallInner}>
          <div>
            <p className={styles.eyebrowLight}><span className={styles.eyebrowRule} />Ready to explode your Instagram reach?</p>
            <h2>Start automating<br />in <em>under 2 minutes.</em></h2>
          </div>
          <div className={styles.lastCallAction}>
            <p>Connect your Instagram account, pick a Reel, and launch your first automation for free.</p>
            <Link href={signupCtaHref} className={styles.lastButton}>{LEGAL_POLICIES_APPROVED ? 'Start free trial' : 'Contact us for launch updates'}<ArrowUpRight size={17} aria-hidden="true" /></Link>
          </div>
        </div>
      </section>

      <footer className={styles.footer}>
        <div className={styles.footerMain}>
          <div className={styles.footerBrand}><Brand /><p>Thoughtful Instagram comment and story automation for creators, educators, and brands.</p><span>Independent product. Not affiliated with or endorsed by Instagram or Meta Platforms, Inc.</span></div>
          <div className={styles.footerColumn}><h2>Features</h2><a href="#superpowers">Story Mentions</a><a href="#superpowers">Hinglish &amp; Tenglish</a><a href="#superpowers">Giveaway Picker</a><a href="#superpowers">Follow-First</a></div>
          <div className={styles.footerColumn}><h2>HeyLaunch</h2><Link href="/contact">Contact</Link><Link href="/login">Log in</Link><Link href={signupCtaHref}>{signupCtaLabel}</Link></div>
          <div className={styles.footerColumn}><h2>Legal</h2><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><Link href="/cookies">Cookies</Link><Link href="/refunds">Refunds</Link><Link href="/delivery">Delivery</Link><Link href="/data-deletion">Data Deletion</Link></div>
        </div>
        <div className={styles.footerBottom}><span>© 2026 HeyLaunch. All rights reserved.</span><a href="#top">Back to top <ArrowUpRight size={14} aria-hidden="true" /></a></div>
      </footer>
    </main>
  );
}
