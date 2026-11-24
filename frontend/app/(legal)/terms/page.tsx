import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPolicyPage, LegalSection } from '../../../components/legal-policy-page';

export const metadata: Metadata = { 
  title: 'Terms of Service | HeyLaunch', 
  description: 'Terms of Service and commercial agreement for using HeyLaunch Instagram automation software.',
  robots: { index: true, follow: true } 
};

export default function TermsPage() {
  return (
    <LegalPolicyPage title="Terms of Service">
      <p>
        These Terms of Service (&ldquo;Terms&rdquo;) constitute a legally binding agreement between you (&ldquo;Customer&rdquo;, &ldquo;User&rdquo;, or &ldquo;You&rdquo;) and <strong>HeyLaunch</strong>, operated by <strong>Siva Goram</strong> (&ldquo;Company&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;), located in Hyderabad, Telangana, India. By accessing our website, creating an account, or using our software, you agree to be bound by these Terms.
      </p>

      <LegalSection title="1. Service Description">
        <p>
          HeyLaunch is a software-as-a-service (SaaS) application that enables creators, influencers, and businesses to automate responses to public comments on their Instagram posts, reels, and stories, and deliver automated direct messages using official Meta Instagram Graph API endpoints.
        </p>
        <p>
          HeyLaunch is an independent software tool built on official Meta developer APIs. HeyLaunch is not sponsored, endorsed, or affiliated with Instagram or Meta Platforms, Inc.
        </p>
      </LegalSection>

      <LegalSection title="2. Eligibility & Account Responsibilities">
        <p>
          To use HeyLaunch, you must:
        </p>
        <ul>
          <li>Be at least 18 years of age and possess the legal capacity to enter into binding agreements.</li>
          <li>Be an authorized administrator or owner of the Instagram Professional (Creator or Business) account you connect.</li>
          <li>Maintain the confidentiality of your login credentials and immediately notify us of any unauthorized account access.</li>
          <li>Provide accurate, truthful, and complete registration information.</li>
        </ul>
      </LegalSection>

      <LegalSection title="3. Meta Platform Policies & Acceptable Use">
        <p>
          You agree to strictly comply with Meta&rsquo;s Platform Terms, Instagram Community Guidelines, and Developer Policies at all times. Specifically, you agree NOT to:
        </p>
        <ul>
          <li>Use HeyLaunch to send unsolicited bulk messages (spam), misleading links, phishing schemes, or deceptive promotions.</li>
          <li>Transmit abusive, defamatory, harassing, sexually explicit, hateful, or unlawful content.</li>
          <li>Attempt to bypass or circumvent Meta&rsquo;s official rate limits, automated cooldown periods, or the 24-hour standard messaging window.</li>
          <li>Engage in automated scraping, reverse engineering, or disruption of HeyLaunch or Meta services.</li>
        </ul>
        <p>
          Violation of these rules may result in immediate suspension or termination of your HeyLaunch account without refund.
        </p>
      </LegalSection>

      <LegalSection title="4. Subscription Plans & Payments via Razorpay">
        <p>
          HeyLaunch offers free tier access and premium paid tiers (e.g. Starter, Pro, Scale) designed for growing creators:
        </p>
        <ul>
          <li><strong>Pricing & Currency:</strong> All prices are displayed and charged in <strong>Indian Rupees (INR)</strong>. Prices are clearly stated on our plans page prior to checkout.</li>
          <li><strong>Payment Processing:</strong> All transactions are securely processed through our authorized payment gateway partner, <strong>Razorpay Software Private Limited</strong>. Supported payment methods include UPI, credit cards, debit cards, and net banking.</li>
          <li><strong>Fixed Duration Access:</strong> Paid plans provide 30 calendar days of premium feature access. Plans do not auto-debit or renew automatically unless explicitly stated. You have full discretion whether to purchase a subsequent month.</li>
          <li><strong>Refunds & Cancellation:</strong> Refund eligibility and timelines are governed by our <Link href="/refunds" style={{ color: 'var(--text)', textDecoration: 'underline' }}>Refund Policy</Link>.</li>
        </ul>
      </LegalSection>

      <LegalSection title="5. Digital Service Delivery">
        <p>
          HeyLaunch delivers cloud-based software services. No physical goods or packages are shipped. Upon successful payment verification via Razorpay, your account is provisioned and upgraded <strong>immediately and automatically</strong>. Details are outlined in our <Link href="/delivery" style={{ color: 'var(--text)', textDecoration: 'underline' }}>Digital Delivery Policy</Link>.
        </p>
      </LegalSection>

      <LegalSection title="6. Intellectual Property & User Content">
        <p>
          You retain full ownership of all text, media, trademarks, and content you configure in your automation templates. You grant HeyLaunch a limited, non-exclusive license to transmit and display such content solely to execute your configured automations via Meta APIs.
        </p>
        <p>
          HeyLaunch, its branding, software code, UI designs, and documentation remain the exclusive intellectual property of Siva Goram.
        </p>
      </LegalSection>

      <LegalSection title="7. Disclaimers & Limitation of Liability">
        <p>
          HeyLaunch is provided on an &ldquo;AS IS&rdquo; and &ldquo;AS AVAILABLE&rdquo; basis. While we strive for maximum uptime and reliability, we do not warrant that service will be uninterrupted or error-free. We are not liable for any service interruptions caused by third-party outages (including Meta Instagram API downtime, Razorpay gateway delays, or hosting connectivity).
        </p>
        <p>
          To the maximum extent permitted by Indian law, HeyLaunch&rsquo;s total aggregate liability arising out of or related to these Terms shall not exceed the amount actually paid by you to HeyLaunch in the one (1) month preceding the event giving rise to liability.
        </p>
      </LegalSection>

      <LegalSection title="8. Governing Law & Jurisdiction">
        <p>
          These Terms shall be governed by, interpreted, and construed in accordance with the laws of <strong>India</strong>, without regard to conflict of law principles. Any legal dispute, claim, or controversy arising out of or relating to these Terms or your use of HeyLaunch shall be subject to the exclusive jurisdiction of the competent courts in <strong>Hyderabad, Telangana, India</strong>.
        </p>
      </LegalSection>

      <LegalSection title="9. Contact & Support">
        <p>
          If you have questions, concerns, or notices regarding these Terms, please contact:
        </p>
        <div style={{ marginTop: 12, padding: 16, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg)' }}>
          <p style={{ margin: '0 0 6px' }}><strong>Company:</strong> HeyLaunch</p>
          <p style={{ margin: '0 0 6px' }}><strong>Contact Person:</strong> Siva Goram</p>
          <p style={{ margin: '0 0 6px' }}><strong>Address:</strong> Madhapur, Hyderabad, Telangana, India - 500081</p>
          <p style={{ margin: '0 0 6px' }}><strong>Support Email:</strong> <a href="mailto:mrsivagoram@gmail.com" style={{ color: 'var(--text)' }}>mrsivagoram@gmail.com</a></p>
          <p style={{ margin: 0 }}><strong>Support Hours:</strong> Monday &ndash; Saturday, 9:00 AM &ndash; 6:00 PM IST</p>
        </div>
      </LegalSection>
    </LegalPolicyPage>
  );
}
