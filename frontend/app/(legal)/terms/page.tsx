import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPolicyPage, LegalSection } from '../../../components/legal-policy-page';

export const metadata: Metadata = { title: 'Terms of Service | HeyLaunch', robots: { index: false, follow: true } };

export default function TermsPage() {
  return <LegalPolicyPage title="Terms of Service">
    <p><strong>Draft operator:</strong> HeyLaunch, operated by <strong>[INSERT REGISTERED LEGAL NAME]</strong>, Hyderabad, Telangana, India. <strong>[REPLACE SUPPORT EMAIL]</strong>. This draft is for owner and legal review and is not approved for public launch.</p>
    <LegalSection title="1. Using HeyLaunch">
      <p>HeyLaunch provides tools to configure Instagram comment and message automations, send prepared replies through Meta-approved interfaces, review delivery records, and manage related contacts. Available triggers and plan limits are shown in the product and may depend on Meta permissions and account eligibility.</p>
      <p>You must be at least 18, have authority to connect each Instagram account, and use the service in compliance with applicable law and Meta's current terms, policies, messaging windows, and rate limits. You remain responsible for the content and targeting of every automation.</p>
    </LegalSection>
    <LegalSection title="2. Account security and acceptable use">
      <p>Keep your login details secure, provide accurate account information, and notify us if you suspect unauthorized access. Do not use HeyLaunch for unsolicited bulk messages, deceptive or unlawful content, harassment, scraping, credential sharing, policy circumvention, or activity that interferes with the service or another person's rights. We may pause automations or restrict an account when reasonably needed to protect users, the service, or platform access.</p>
    </LegalSection>
    <LegalSection title="3. Plans and payment">
      <p>Paid plans are one-time purchases that provide the displayed plan access for 30 days. They do not renew automatically. Prices are shown in INR at checkout. A later purchase may extend access according to the plan terms shown at checkout. Payment processing is handled by the displayed payment provider; HeyLaunch does not store full card credentials.</p>
      <p>Refund eligibility and support steps are described in the <Link href="/refunds">Refund Policy draft</Link>. Replace and approve that draft before accepting public payments.</p>
    </LegalSection>
    <LegalSection title="4. Third-party services and availability">
      <p>Instagram, Meta, payment providers, email delivery, hosting, database, and queue providers are third-party services with their own terms and availability. HeyLaunch is independent and is not affiliated with, endorsed by, or sponsored by Instagram or Meta. We cannot guarantee uninterrupted access, message delivery, account eligibility, or that a platform will continue to expose an API feature.</p>
    </LegalSection>
    <LegalSection title="5. Your content and our service">
      <p>You retain rights to content you submit. You authorize HeyLaunch to process it only as needed to provide, secure, and support the service. You must have the rights and permissions needed for that content and for messages sent through your account. Do not include sensitive personal information in automation messages or contact notes unless you have a lawful reason and appropriate safeguards.</p>
    </LegalSection>
    <LegalSection title="6. Suspension, deletion, and changes">
      <p>You may stop using the service and request account deletion from Settings. Deletion may take time while queued sends are safely drained; payment records and limited security or deletion receipts may be retained where required or needed for legitimate operational purposes. We may update the service or these terms. Material policy changes should be versioned and presented for renewed acceptance before they apply to existing users.</p>
    </LegalSection>
    <LegalSection title="7. Disclaimers and disputes — owner review required">
      <p>The service is provided subject to applicable consumer and other mandatory law. <strong>[LEGAL REVIEW: finalize warranties, liability allocation, governing law, dispute process, and venue for Hyderabad/Telangana.]</strong> Nothing in this draft is intended to exclude rights that cannot legally be excluded.</p>
    </LegalSection>
    <LegalSection title="8. Contact">
      <p>Questions or complaints: <strong>[REPLACE WITH MONITORED SUPPORT EMAIL]</strong>. Add the required grievance contact, response timelines, and escalation details after legal review.</p>
    </LegalSection>
  </LegalPolicyPage>;
}
