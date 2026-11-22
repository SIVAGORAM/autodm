import type { Metadata } from 'next';
import { LegalPolicyPage, LegalSection } from '../../../components/legal-policy-page';

export const metadata: Metadata = { title: 'Refund Policy | HeyLaunch', robots: { index: false, follow: true } };

export default function RefundsPage() {
  return <LegalPolicyPage title="Refund Policy">
    <p><strong>Draft operator:</strong> HeyLaunch, operated by <strong>[INSERT REGISTERED LEGAL NAME]</strong>, Hyderabad, Telangana, India. <strong>[REPLACE SUPPORT EMAIL]</strong>. This proposed policy is not final and must be approved against applicable consumer law and payment-provider rules before public checkout is enabled.</p>
    <LegalSection title="1. What a purchase provides">
      <p>Paid plans are one-time purchases for 30 days of access. They do not renew automatically. The checkout page should show the selected plan, total amount in INR, and access term before you pay.</p>
    </LegalSection>
    <LegalSection title="2. Proposed refund request process">
      <p><strong>Owner decision required:</strong> Choose the customer refund window and eligibility before launch. Suggested starting point for review: contact support within 7 calendar days for a duplicate charge, an unauthorized charge, or a material service failure that HeyLaunch cannot resolve. Include the account email, payment/order reference, and a short description; do not email card credentials or authentication codes.</p>
      <p>We will acknowledge a complete request within <strong>[INSERT RESPONSE TIME]</strong> and provide a decision or status update within <strong>[INSERT RESOLUTION TIME]</strong>. Any refund approved will be returned through the original payment method when supported by the payment provider. Processing time may depend on the provider and bank.</p>
    </LegalSection>
    <LegalSection title="3. Cancellation and access">
      <p>There is no automatic renewal to cancel. You may stop using the product or request account deletion in Settings. Account deletion does not by itself reverse a completed payment. Paid access generally remains available through its displayed expiry date unless account safety, platform rules, or applicable law require otherwise.</p>
    </LegalSection>
    <LegalSection title="4. Statutory rights and disputes">
      <p>This draft does not remove any refund, withdrawal, complaint, or other right that applies under mandatory law. <strong>[LEGAL REVIEW: confirm consumer/e-commerce obligations, exceptions, grievance contact, and payment-dispute handling for the final operator and customer base.]</strong></p>
    </LegalSection>
    <LegalSection title="5. Contact">
      <p>Send refund questions to <strong>[REPLACE WITH MONITORED SUPPORT EMAIL]</strong>. Never include your password, OTP, full card number, or payment authentication secret.</p>
    </LegalSection>
  </LegalPolicyPage>;
}
