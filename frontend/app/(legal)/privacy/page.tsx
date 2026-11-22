import type { Metadata } from 'next';
import { LegalPolicyPage, LegalSection } from '../../../components/legal-policy-page';

export const metadata: Metadata = { title: 'Privacy Notice | HeyLaunch', robots: { index: false, follow: true } };

export default function PrivacyPage() {
  return <LegalPolicyPage title="Privacy Notice">
    <p><strong>Draft operator:</strong> HeyLaunch, operated by <strong>[INSERT REGISTERED LEGAL NAME]</strong>, Hyderabad, Telangana, India. <strong>[REPLACE SUPPORT EMAIL]</strong>. This notice is a working draft. Confirm the actual operator, providers, data locations, retention periods, and legal obligations before launch.</p>
    <LegalSection title="1. Data we handle">
      <ul>
        <li><strong>Account and security data:</strong> name, email, password hash, verification and recovery state, session-token hashes, and account-security events.</li>
        <li><strong>Instagram and automation data:</strong> connected account identifiers and usernames, encrypted access tokens, automation rules and message content, recipient Instagram-scoped identifiers and usernames, contact notes/tags, delivery status, and button-click records when tracking is enabled.</li>
        <li><strong>Billing and support data:</strong> plan, payment/order identifiers and amounts, support or feedback messages, and account-deletion requests. The payment provider handles payment credentials; HeyLaunch does not intentionally store full card details.</li>
        <li><strong>Public contact enquiries:</strong> name, email address, subject, message, administrator replies and internal notes, assignment/status/priority, and email delivery state when you submit the public contact form. Contact form submissions can be sent without creating a HeyLaunch account.</li>
        <li><strong>Technical data:</strong> service and security logs needed to operate, troubleshoot, and protect the product. <strong>[OWNER: identify any analytics, cookies, IP logging, and retention not currently documented in code.]</strong></li>
      </ul>
    </LegalSection>
    <LegalSection title="2. Why we use it">
      <p>We use data to create and secure accounts; verify email; connect authorized Instagram accounts; run the automations you configure; show delivery and click activity; process payments; respond to support requests and contact enquiries; prevent abuse; meet legal obligations; and maintain service reliability. Public contact form information is used to review and answer the enquiry, not to enroll the sender in promotional campaigns. We do not use Instagram passwords to connect accounts.</p>
    </LegalSection>
    <LegalSection title="3. Sharing and service providers">
      <p>We share the minimum data needed with Meta/Instagram to connect accounts and perform authorized messaging, with the selected payment processor to collect payments, and with hosting, database, Redis/queue, and email providers to operate the service. <strong>[OWNER: list the actual providers, subprocessors, processing purposes, and locations, including cross-border processing.]</strong> We do not sell personal data as a business model.</p>
    </LegalSection>
    <LegalSection title="4. Cookies and tokens">
      <p>Authentication uses HTTP-only cookies. Instagram access tokens are encrypted at rest. Refresh-token database records store SHA-256 digests rather than raw tokens. These security measures reduce exposure but cannot eliminate all risk; protect your email account and devices as well.</p>
    </LegalSection>
    <LegalSection title="5. Retention and deletion">
      <p>We keep account and automation data while needed to provide the service. Settings provides a data export and account-deletion request. Deletion is staged so queued messages can be stopped safely; limited payment references and opaque Meta callback receipts may remain for operational or legal reasons. Dead-letter webhook payloads are configured for automatic purge after 30 days by default, while a minimal receipt remains for deduplication. <strong>[OWNER: approve retention and deletion periods for public contact enquiries, logs, support threads, payment records, backups, and other customer data.]</strong></p>
      <p>Unverified signups are currently scheduled for deletion after <strong>30 days</strong> by default. Access is locked and credentials are cleared first; account data is removed after the safety period and queued work drain. This period is configurable and must be confirmed before launch.</p>
    </LegalSection>
    <LegalSection title="6. Your choices and requests">
      <p>Use Settings to request a copy of your data or delete your account. Contact <strong>[REPLACE WITH MONITORED SUPPORT EMAIL]</strong> for privacy questions, correction requests, or other rights that apply to you. We will verify requests and respond under applicable law.</p>
    </LegalSection>
    <LegalSection title="7. Children and age">
      <p>The service is intended for adults. Signup asks users to confirm they are at least 18. We do not knowingly design the service for children. <strong>[OWNER/COUNSEL: confirm age-assurance and child-data procedures before launch.]</strong></p>
    </LegalSection>
    <LegalSection title="8. India privacy-law implementation — review required">
      <p>This draft is not a compliance certification. India's Digital Personal Data Protection Act and Rules have phased commencement dates; some provisions are already in force while major processing duties are scheduled later. The operator must confirm which duties apply on the launch date, provide the required notice and request channels, and update this policy and product controls accordingly.</p>
    </LegalSection>
    <LegalSection title="9. Updates and contact">
      <p>We will version this notice when it changes and record the version acknowledged at signup. Contact <strong>[REPLACE WITH MONITORED SUPPORT EMAIL]</strong>. <strong>[OWNER: add grievance contact, contact address, and response timeline required for the final policy.]</strong></p>
    </LegalSection>
  </LegalPolicyPage>;
}
