import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPolicyPage, LegalSection } from '../../../components/legal-policy-page';

export const metadata: Metadata = { 
  title: 'Privacy Policy | HeyLaunch', 
  description: 'Learn how HeyLaunch collects, processes, and protects your information and Instagram Graph API data.',
  robots: { index: true, follow: true } 
};

export default function PrivacyPage() {
  return (
    <LegalPolicyPage title="Privacy Policy">
      <p>
        <strong>HeyLaunch</strong> (&ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;) is an Instagram automation platform operated by <strong>Siva Goram</strong>, headquartered in Hyderabad, Telangana, India. We are committed to safeguarding your privacy and ensuring the security of all user data and Meta platform data in compliance with applicable laws, including India&rsquo;s Digital Personal Data Protection Act (DPDP Act 2023) and Meta&rsquo;s Platform Terms and Developer Policies.
      </p>

      <LegalSection title="1. Information We Collect">
        <p>We collect and process only the minimum information necessary to provide our Instagram automation and account management services:</p>
        <ul>
          <li><strong>Account Information:</strong> Your name, email address, password hash, account creation date, and email verification status.</li>
          <li><strong>Instagram Graph API Data:</strong> When you connect your Instagram Professional (Creator or Business) account via Meta OAuth, we receive authorized access tokens, your Instagram Business Account ID, username, and profile metadata. When automations run, we receive webhook notifications for comments on your public posts, reels, and stories (including commenter Instagram-scoped ID, username, timestamp, and comment text) solely to evaluate your keyword rules and trigger your configured direct message reply.</li>
          <li><strong>Automation & Delivery Records:</strong> Configured keyword triggers, automated reply templates, delivery timestamps, delivery status (sent, pending, failed), and button-click counters if custom link tracking is enabled.</li>
          <li><strong>Payment & Billing Information:</strong> Plan subscriptions, Razorpay payment and order identifiers, payment amounts, and transaction status. All payment transactions are processed securely through Razorpay. HeyLaunch does not collect, receive, or store credit/debit card numbers, CVVs, or net banking passwords.</li>
          <li><strong>Communications & Support:</strong> Inquiries sent through our contact form, support requests, and correspondence with our team.</li>
          <li><strong>Technical & Log Data:</strong> IP address, browser type, device information, and secure HTTP-only session cookies required for authentication and fraud prevention.</li>
        </ul>
      </LegalSection>

      <LegalSection title="2. How We Use Your Information">
        <p>We use the collected information strictly for legitimate business and operational purposes:</p>
        <ul>
          <li>To authenticate your identity and provide secure access to your HeyLaunch dashboard.</li>
          <li>To receive Instagram webhook events and deliver automated direct messages and comment replies via the official Meta Instagram Graph API.</li>
          <li>To verify Instagram account permissions, token validity, and maintain continuous service.</li>
          <li>To process one-time plan upgrade payments via Razorpay and generate purchase receipts.</li>
          <li>To provide customer support, troubleshoot technical issues, and respond to inquiries.</li>
          <li>To detect, prevent, and mitigate security threats, abuse, spam, and violations of our Terms of Service.</li>
        </ul>
        <p><strong>We do NOT sell, rent, monetize, or trade your personal data or Instagram Graph API data to third-party data brokers, marketers, or advertisers.</strong></p>
      </LegalSection>

      <LegalSection title="3. Authorized Sub-processors & Service Providers">
        <p>We engage reputable third-party infrastructure providers to host and deliver our service under strict data protection terms:</p>
        <ul>
          <li><strong>Meta Platforms, Inc. (USA):</strong> Official Instagram Graph API provider for account authentication, webhook intake, and direct message dispatch.</li>
          <li><strong>Razorpay Software Private Limited (India):</strong> Payment gateway provider for processing subscription fees via UPI, credit/debit cards, and net banking.</li>
          <li><strong>Neon, Inc. (USA / AWS Asia-Pacific):</strong> Managed PostgreSQL database hosting with end-to-end TLS encryption and automated backups.</li>
          <li><strong>Upstash Inc. (USA / AWS Asia-Pacific):</strong> Managed serverless Redis for asynchronous task queue management and rate limiting.</li>
          <li><strong>Cloudinary Ltd. (USA):</strong> Cloud storage for user profile avatar images.</li>
          <li><strong>Vercel Inc. & Render Services, Inc. (USA):</strong> Secure cloud application hosting and content delivery network (CDN).</li>
          <li><strong>Google LLC (Gmail SMTP):</strong> Secure transmission of transactional verification codes, password reset emails, and support replies.</li>
        </ul>
      </LegalSection>

      <LegalSection title="4. Data Security & Storage">
        <p>
          We employ industry-standard technical and organizational security measures to protect your data. All Meta OAuth access tokens and sensitive credentials are encrypted at rest using <strong>AES-256-GCM</strong> encryption. Passwords are cryptographically hashed using <strong>bcrypt</strong> with salt rounds. All external communication between your browser, our servers, Meta, and Razorpay occurs over encrypted <strong>HTTPS / TLS 1.3</strong> connections.
        </p>
      </LegalSection>

      <LegalSection title="5. Data Retention & Automatic Purging">
        <p>
          We retain your personal data and automation configurations only for as long as your account remains active. Operational webhook payloads are retained for 30 days to facilitate troubleshooting and are automatically purged thereafter. If you do not verify your email address after registration, your account is automatically purged after 30 days.
        </p>
      </LegalSection>

      <LegalSection title="6. User Rights & Data Deletion Instructions">
        <p>
          You have full control over your data. You may at any time:
        </p>
        <ul>
          <li>Export your automation data, contact records, and profile details from your dashboard.</li>
          <li>Disconnect your Instagram account from HeyLaunch directly via your dashboard or through your Facebook/Instagram security settings.</li>
          <li>Request complete deletion of your account and all associated data via <strong>Settings &rarr; Account &rarr; Delete Account</strong>, or by visiting our dedicated <Link href="/data-deletion" style={{ color: 'var(--text)', textDecoration: 'underline' }}>User Data Deletion Instructions</Link> page.</li>
          <li>Request manual deletion by emailing our support team at <a href="mailto:mrsivagoram@gmail.com" style={{ color: 'var(--text)' }}>mrsivagoram@gmail.com</a>. We will process your deletion request and purge all stored data within 48 hours.</li>
        </ul>
      </LegalSection>

      <LegalSection title="7. Children's Privacy">
        <p>
          HeyLaunch is intended solely for adults and business entities. You must be at least 18 years of age to register and use our service. We do not knowingly collect personal data from minors under 18. If we discover that a minor has provided us with personal information, we will immediately delete such data.
        </p>
      </LegalSection>

      <LegalSection title="8. Grievance Officer & Contact Information">
        <p>
          In accordance with the Information Technology Act, 2000 and the Digital Personal Data Protection Act, 2023, the details of our Grievance Officer are provided below:
        </p>
        <div style={{ marginTop: 12, padding: 16, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg)' }}>
          <p style={{ margin: '0 0 6px' }}><strong>Name:</strong> Siva Goram</p>
          <p style={{ margin: '0 0 6px' }}><strong>Designation:</strong> Grievance Officer & Founder, HeyLaunch</p>
          <p style={{ margin: '0 0 6px' }}><strong>Registered Address:</strong> Madhapur, Hyderabad, Telangana, India - 500081</p>
          <p style={{ margin: '0 0 6px' }}><strong>Email:</strong> <a href="mailto:mrsivagoram@gmail.com" style={{ color: 'var(--text)' }}>mrsivagoram@gmail.com</a></p>
          <p style={{ margin: 0 }}><strong>Response Timeline:</strong> Acknowledgments within 24 hours; grievances resolved within 15 working days.</p>
        </div>
      </LegalSection>
    </LegalPolicyPage>
  );
}
