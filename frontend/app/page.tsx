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
  Instagram,
  MessageCircle,
  ShieldCheck,
} from 'lucide-react';
import { LEGAL_POLICIES_APPROVED } from '../lib/legal-policy';
import styles from './page.module.css';

const signupCtaHref = LEGAL_POLICIES_APPROVED ? '/signup' : '/contact';
const signupCtaLabel = LEGAL_POLICIES_APPROVED ? 'Start free' : 'Contact us';

export const metadata: Metadata = {
  title: 'HeyLaunch — Thoughtful Instagram comment automation',
  description:
    'Prepare private replies for comments on supported Instagram photo and carousel posts, then review recorded delivery outcomes in one workspace.',
  openGraph: {
    title: 'HeyLaunch — Thoughtful Instagram comment automation',
    description:
      'Choose a supported post, match a comment, prepare an eligible private reply, and see what happened.',
    type: 'website',
    siteName: 'HeyLaunch',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'HeyLaunch — Thoughtful Instagram comment automation',
    description: 'Prepare a reply for supported Instagram comment workflows and review delivery outcomes.',
  },
};

const plans = [
  {
    name: 'Free',
    price: '₹0',
    cadence: '',
    note: 'A simple place to begin.',
    features: ['1 Instagram account', '150 DMs / month', '1 keyword per automation', 'Supported post comment triggers', 'Live status + delivery log'],
  },
  {
    name: 'Creator',
    price: '₹299',
    cadence: '/ 30 days',
    note: 'For a growing creator workflow.',
    features: ['2 Instagram accounts', '2,000 DMs / month', 'Up to 5 keywords per automation', 'Supported post comment triggers', 'Follow-ups'],
  },
  {
    name: 'Pro',
    price: '₹599',
    cadence: '/ 30 days',
    note: 'For a busy business account.',
    features: ['5 Instagram accounts', '10,000 DMs / month', 'Unlimited keywords', 'Supported post comment triggers', 'Follow-ups and click tracking'],
    featured: true,
  },
  {
    name: 'Agency',
    price: '₹1,499',
    cadence: '/ 30 days',
    note: 'For managing several accounts.',
    features: ['15 Instagram accounts', '50,000 DMs / month', 'Unlimited keywords', 'Supported post comment triggers', 'Follow-ups and click tracking'],
  },
];

const faqs = [
  {
    question: 'Which Instagram posts can I automate?',
    answer:
      'The current workflow supports comment automations on eligible Instagram photo and carousel posts. Reliable Reel-specific automation has not been verified in staging, so HeyLaunch does not advertise it as available.',
  },
  {
    question: 'Does HeyLaunch send a private reply for every comment?',
    answer:
      'No. A matching comment can qualify for a private reply when the connected professional account, granted permissions, Meta messaging rules, and applicable reply window allow it. HeyLaunch records sent, skipped, and failed outcomes for review.',
  },
  {
    question: 'Do I share my Instagram password?',
    answer:
      'No. Account connections use Meta’s official authorization flow. HeyLaunch does not ask for your Instagram password or use browser bots.',
  },
  {
    question: 'What happens if my connection needs attention?',
    answer:
      'The dashboard shows connection health and recorded automation outcomes. If access expires or a required permission is unavailable, reconnect the account before expecting new automations to run.',
  },
  {
    question: 'Do paid plans renew automatically?',
    answer:
      'No. Each payment provides 30 days of access. Renew manually when you want to continue.',
  },
  {
    question: 'Can an agency give each client a separate workspace?',
    answer:
      'Not yet. The Agency plan can connect multiple Instagram accounts under one HeyLaunch login. Separate client workspaces and team permissions are not available.',
  },
];

function Brand() {
  return (
    <Link href="/" className={styles.brand} aria-label="HeyLaunch home">
      <Image src="/heylaunch-logo.png" alt="HeyLaunch" width={130} height={37} priority />
    </Link>
  );
}

function ReplyPathDemo() {
  return (
    <div className={styles.replyPath} aria-label="Illustrative comment automation workflow">
      <div className={styles.demoHeader}>
        <span><Instagram size={15} aria-hidden="true" /> A supported post</span>
        <span className={styles.exampleTag}>Illustrative example</span>
      </div>

      <div className={styles.pathBody}>
        <div className={styles.pathRail} aria-hidden="true"><span /><span /><span /></div>
        <article className={styles.pathStep}>
          <span className={styles.pathIndex}>01</span>
          <div className={styles.commentCard}>
            <div className={styles.commentAvatar} aria-hidden="true">M</div>
            <div className={styles.commentText}><small>Comment · @mira</small><p>Could you share the guide?</p></div>
            <MessageCircle size={17} aria-hidden="true" />
          </div>
        </article>
        <article className={styles.pathStep}>
          <span className={styles.pathIndex}>02</span>
          <div className={styles.matchCard}>
            <div className={styles.matchMark}><Check size={16} aria-hidden="true" /></div>
            <div><small>Your keyword rule</small><p>“guide” found in comment</p></div>
            <span className={styles.matchState}>Match</span>
          </div>
        </article>
        <article className={styles.pathStep}>
          <span className={styles.pathIndex}>03</span>
          <div className={styles.replyCard}>
            <div className={styles.replyLabel}><MessageCircle size={15} aria-hidden="true" /><small>Prepared private reply</small></div>
            <p>Thanks for asking. Here’s the guide you wanted.</p>
            <div className={styles.replyFooter}><span>Sent only when eligible</span><ArrowUpRight size={14} aria-hidden="true" /></div>
          </div>
        </article>
      </div>
      <div className={styles.demoFoot}><ShieldCheck size={14} aria-hidden="true" /><span>Meta permissions, account eligibility, and messaging limits apply</span></div>
    </div>
  );
}

export default function Home() {
  return (
    <main className={styles.site} id="top">
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Brand />
          <nav aria-label="Main navigation" className={styles.desktopNav}>
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

      <section className={styles.hero} aria-labelledby="hero-title">
        <div className={styles.heroInner}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}><span className={styles.eyebrowRule} />Instagram comment automation for creators</p>
            <h1 id="hero-title">Someone asked.<br /><span>Reply with care.</span></h1>
            <p className={styles.heroLead}>Prepare a thoughtful private reply for comments on supported photo and carousel posts. Then see what happened, all from one calm workspace.</p>
            <div className={styles.heroActions}>
              <Link href={signupCtaHref} className={styles.primaryButton}>{signupCtaLabel}<ArrowUpRight size={17} aria-hidden="true" /></Link>
              <a href="#how-it-works" className={styles.secondaryButton}>See the reply path<ArrowDownRight size={16} aria-hidden="true" /></a>
            </div>
            <p className={styles.heroTrust}><ShieldCheck size={16} aria-hidden="true" />Official Meta authorization · No password sharing</p>
          </div>
          <ReplyPathDemo />
        </div>
        <div className={styles.audienceLine}>
          <span>For the people behind the posts</span>
          <div><span>Independent creators</span><span>Small businesses</span><span>Marketing teams</span></div>
        </div>
      </section>

      <section className={styles.storySection} aria-labelledby="story-title">
        <div className={styles.storyInner}>
          <p className={styles.sectionNumber}><span>01</span> The reason we built HeyLaunch</p>
          <div className={styles.storyContent}>
            <h2 id="story-title">A comment is a person asking for the <em>next step.</em></h2>
            <div className={styles.storyAside}>
              <p>When you publish often, the same helpful answer can be easy to miss. Set up the reply once, choose the comment rule, and keep the outcome visible.</p>
              <a href="#how-it-works">See how it works <ArrowRight size={15} aria-hidden="true" /></a>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.workflowSection} id="how-it-works" aria-labelledby="workflow-title">
        <div className={styles.workflowHeader}>
          <div><p className={styles.eyebrow}><span className={styles.eyebrowRule} />A clear path from comment to response</p><h2 id="workflow-title">Set the rule.<br />Stay in the loop.</h2></div>
          <p>Choose an eligible photo or carousel post. Decide what counts as a match. Write the reply in your own words.</p>
        </div>
        <div className={styles.workflowSteps}>
          <article className={styles.workflowStep}>
            <span className={styles.stepNumber}>01</span><span className={styles.stepRule} aria-hidden="true" />
            <h3>Choose a post</h3><p>Select an Instagram photo or carousel from the connected professional account.</p>
          </article>
          <article className={styles.workflowStep}>
            <span className={styles.stepNumber}>02</span><span className={styles.stepRule} aria-hidden="true" />
            <h3>Match a comment</h3><p>Use a keyword rule or respond to any comment that meets the configured trigger.</p>
          </article>
          <article className={styles.workflowStep}>
            <span className={styles.stepNumber}>03</span><span className={styles.stepRule} aria-hidden="true" />
            <h3>Review the outcome</h3><p>Check whether a reply was sent, skipped, or failed and reconnect if access needs attention.</p>
          </article>
        </div>
        <div className={styles.activityPanel} aria-label="Illustrative HeyLaunch activity log">
          <div className={styles.activityHeading}><div><span className={styles.activityDot} /><strong>Activity, with context</strong></div><span>Illustrative interface</span></div>
          <div className={styles.activityEntry}><span className={styles.activityGlyph}><MessageCircle size={17} aria-hidden="true" /></span><div><strong>Comment matched</strong><small>Keyword · “guide”</small></div><span className={styles.activityStatus}>Matched</span></div>
          <div className={styles.activityEntry}><span className={styles.activityGlyph}><ArrowUpRight size={17} aria-hidden="true" /></span><div><strong>Private reply outcome</strong><small>See the recorded delivery status</small></div><span className={styles.activityStatus}>Recorded</span></div>
          <p className={styles.activityNote}>Example view only. This is not connected to a live Instagram account.</p>
        </div>
      </section>

      <section className={styles.useCases} aria-labelledby="usecases-title">
        <div className={styles.useCaseIntro}>
          <p className={styles.sectionNumber}><span>02</span> Built for a real working day</p>
          <h2 id="usecases-title">A little more room to be present.</h2>
          <p>Use a prepared response for the moments when people ask for the same resource, detail, or next step.</p>
        </div>
        <div className={styles.useCaseList}>
          <article><span>Creators & educators</span><h3>Share the guide, class, or resource they came for.</h3><p>Set up a reply for a supported post so a familiar question has a useful next step ready.</p></article>
          <article><span>Small businesses</span><h3>Make product questions easier to answer.</h3><p>Prepare the detail or destination your audience asks for, and review what the workflow delivered.</p></article>
          <article><span>Marketing teams</span><h3>Keep several account workflows in view.</h3><p>Connect accounts within your plan and review recent automation activity from one login.</p></article>
        </div>
      </section>

      <section className={styles.pricingSection} id="plans" aria-labelledby="plans-title">
        <div className={styles.pricingInner}>
          <div className={styles.pricingHead}><div><p className={styles.eyebrow}><span className={styles.eyebrowRule} />Plans with clear limits</p><h2 id="plans-title">Start with one.<br />Grow at your pace.</h2></div><p>{LEGAL_POLICIES_APPROVED ? 'Start with a 2-day Pro trial after verified sign-up. No card is required.' : 'Plan details are available for review. Sign-up and checkout are paused while draft policies are reviewed.'}</p></div>
          <div className={styles.planGrid}>
            {plans.map((plan) => (
              <article key={plan.name} className={`${styles.plan} ${plan.featured ? styles.planFeatured : ''}`}>
                {plan.featured && <span className={styles.planFlag}>Most room to grow</span>}
                <h3>{plan.name}</h3><p className={styles.planNote}>{plan.note}</p>
                <p className={styles.planPrice}>{plan.price}<span>{plan.cadence}</span></p>
                <ul>{plan.features.map((feature) => <li key={feature}><CheckCircle2 size={16} aria-hidden="true" />{feature}</li>)}</ul>
                <Link className={styles.planCta} href={signupCtaHref}>{LEGAL_POLICIES_APPROVED && plan.name !== 'Free' ? 'Start free trial' : signupCtaLabel}<ArrowUpRight size={15} aria-hidden="true" /></Link>
              </article>
            ))}
          </div>
          <p className={styles.planCaveat}>Each paid plan provides 30 days of access. Paid access does not renew automatically. Reel-specific automation, story replies, and incoming DM triggers are not verified for reliable staging use. Agency accounts currently share one login; client workspaces and team permissions are not available.</p>
        </div>
      </section>

      <section className={styles.scopeSection} aria-labelledby="scope-title">
        <div className={styles.scopeTop}>
          <p className={styles.sectionNumber}><span>03</span> Clear about what works today</p>
          <h2 id="scope-title">Trust starts with <em>the truth.</em></h2>
        </div>
        <div className={styles.scopeBody}>
          <p>The product is built around Instagram photo and carousel comment automations. A live staging account still needs to confirm end-to-end delivery across connected accounts.</p>
          <div className={styles.scopeRows}>
            <div><Check size={16} aria-hidden="true" /><strong>Photo & carousel comment automations</strong><span>Implemented · staging verification pending</span></div>
            <div><span className={styles.scopeHollow} aria-hidden="true" /><strong>Unified inbox</strong><span>In development</span></div>
            <div><span className={styles.scopeHollow} aria-hidden="true" /><strong>Public creator profiles</strong><span>Implemented · staging verification pending</span></div>
          </div>
        </div>
      </section>

      <section className={styles.faqSection} id="questions" aria-labelledby="faq-title">
        <div className={styles.faqTitle}><p className={styles.eyebrow}><span className={styles.eyebrowRule} />Before you get started</p><h2 id="faq-title">Good questions.<br />Straight answers.</h2></div>
        <div className={styles.faqList}>{faqs.map((faq, index) => <details key={faq.question} className={styles.faq}><summary><span><small>{String(index + 1).padStart(2, '0')}</small>{faq.question}</span><ChevronDown size={19} aria-hidden="true" /></summary><p>{faq.answer}</p></details>)}</div>
      </section>

      <section className={styles.lastCall}>
        <div className={styles.lastCallInner}><div><p className={styles.eyebrowLight}><span className={styles.eyebrowRule} />Every message is someone reaching out</p><h2>Make room<br />to <em>reach back.</em></h2></div><div className={styles.lastCallAction}><p>Start with a supported post and a reply you’re proud to send.</p><Link href={signupCtaHref} className={styles.lastButton}>{LEGAL_POLICIES_APPROVED ? 'Start free' : 'Contact us for launch updates'}<ArrowUpRight size={17} aria-hidden="true" /></Link></div></div>
      </section>

      <footer className={styles.footer}>
        <div className={styles.footerMain}>
          <div className={styles.footerBrand}><Brand /><p>Thoughtful Instagram comment automation for creators and small teams.</p><span>Independent product. Not affiliated with or endorsed by Instagram or Meta.</span></div>
          <div className={styles.footerColumn}><h2>Explore</h2><a href="#how-it-works">How it works</a><a href="#plans">Plans</a><a href="#questions">Questions</a></div>
          <div className={styles.footerColumn}><h2>HeyLaunch</h2><Link href="/contact">Contact</Link><Link href="/login">Log in</Link><Link href={signupCtaHref}>{signupCtaLabel}</Link></div>
          <div className={styles.footerColumn}><h2>Legal</h2><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><Link href="/refunds">Refunds</Link></div>
        </div>
        <div className={styles.footerBottom}><span>© 2026 HeyLaunch. All rights reserved.</span><a href="#top">Back to top <ArrowUpRight size={14} aria-hidden="true" /></a></div>
      </footer>
    </main>
  );
}
