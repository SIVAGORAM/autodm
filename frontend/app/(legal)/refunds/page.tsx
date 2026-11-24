import type { Metadata } from 'next';
import { LegalPolicyPage, LegalSection } from '../../../components/legal-policy-page';

export const metadata: Metadata = { 
  title: 'Refund & Cancellation Policy | HeyLaunch', 
  description: 'Learn about refund eligibility, cancellation procedures, and processing timelines for HeyLaunch plans.',
  robots: { index: true, follow: true } 
};

export default function RefundsPage() {
  return (
    <LegalPolicyPage title="Refund & Cancellation Policy">
      <p>
        At <strong>HeyLaunch</strong>, operated by <strong>Siva Goram</strong> (Hyderabad, Telangana, India), we strive to provide high-quality, reliable Instagram automation software for creators. This Refund &amp; Cancellation Policy outlines the conditions under which refunds are granted and the timelines for processing through our payment partner, <strong>Razorpay</strong>.
      </p>

      <LegalSection title="1. Overview of Plan Purchases">
        <p>
          HeyLaunch provides monthly cloud software subscriptions billed as one-time, fixed-duration purchases for <strong>30 calendar days</strong>. All prices are listed in Indian Rupees (INR) at checkout.
        </p>
        <p>
          We do not store payment credentials or enroll users in unannounced recurring charges. You maintain complete control over renewals.
        </p>
      </LegalSection>

      <LegalSection title="2. Refund Eligibility">
        <p>
          We offer refunds under the following clear circumstances:
        </p>
        <ul>
          <li><strong>Duplicate Transaction:</strong> If you are charged more than once for the same plan due to a technical glitch or network interruption during checkout.</li>
          <li><strong>Service Non-Fulfillment:</strong> If payment is deducted via Razorpay but your HeyLaunch account fails to activate or provision your plan features within 24 hours and our support team is unable to resolve it.</li>
          <li><strong>Accidental Plan Upgrade:</strong> If you notify us within <strong>7 calendar days</strong> of payment and have not actively dispatched automated direct messages on the new tier.</li>
        </ul>
        <p>
          Refunds are <strong>not eligible</strong> for:
        </p>
        <ul>
          <li>Accounts suspended or terminated due to violations of Meta Platform Policies or our Terms of Service (e.g. sending spam, harassment, or prohibited content).</li>
          <li>Dissatisfaction after extensive use of plan quota or after the 7-day initial purchase window has elapsed.</li>
        </ul>
      </LegalSection>

      <LegalSection title="3. Refund Request Process & SLA">
        <p>To initiate a refund request:</p>
        <ol style={{ paddingLeft: 20, margin: '10px 0' }}>
          <li>Send an email to our dedicated billing desk at <a href="mailto:mrsivagoram@gmail.com" style={{ color: 'var(--text)' }}>mrsivagoram@gmail.com</a> with the subject line <strong>&ldquo;Refund Request - [Your Registered Email]&rdquo;</strong>.</li>
          <li>Include your Razorpay Payment ID (e.g., <code>pay_...</code>) or Order ID, date of payment, and the reason for the request.</li>
          <li><strong>Never email card details, PINs, or OTPs.</strong> We will never ask for your confidential banking credentials.</li>
        </ol>
        <p>
          <strong>Acknowledgment Timeline:</strong> Our billing team will acknowledge your request within <strong>24 business hours</strong>.
        </p>
        <p>
          <strong>Resolution Timeline:</strong> We will review transaction logs and communicate a formal decision within <strong>48 to 72 business hours</strong>.
        </p>
      </LegalSection>

      <LegalSection title="4. Processing Timeline & Payout via Razorpay">
        <p>
          Once a refund is approved by HeyLaunch:
        </p>
        <ul>
          <li>The refund is triggered immediately through the <strong>Razorpay payment gateway</strong> back to the original payment source (UPI ID, bank account, debit card, or credit card).</li>
          <li>According to standard banking and Razorpay settlement protocols, refunds typically reflect in your account within <strong>5 to 7 working days</strong> (excluding bank holidays and weekends).</li>
          <li>You will receive an automated email confirmation from Razorpay containing the Refund Reference Number (RRN) to track the credit with your bank.</li>
        </ul>
      </LegalSection>

      <LegalSection title="5. Cancellation & Account Deletion">
        <p>
          Because paid plans are non-renewing 30-day passes, there is no automatic subscription billing to cancel.
        </p>
        <p>
          If you wish to stop using HeyLaunch, you may simply let your access expire or permanently delete your account at any time via <strong>Settings &rarr; Account &rarr; Delete Account</strong>. Account deletion takes effect immediately after draining pending jobs.
        </p>
      </LegalSection>

      <LegalSection title="6. Contact Billing Support">
        <p>
          For any billing disputes or payment queries, please reach out to us:
        </p>
        <div style={{ marginTop: 12, padding: 16, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg)' }}>
          <p style={{ margin: '0 0 6px' }}><strong>Billing & Support Contact:</strong> Siva Goram</p>
          <p style={{ margin: '0 0 6px' }}><strong>Entity:</strong> HeyLaunch</p>
          <p style={{ margin: '0 0 6px' }}><strong>Address:</strong> Madhapur, Hyderabad, Telangana, India - 500081</p>
          <p style={{ margin: '0 0 6px' }}><strong>Email:</strong> <a href="mailto:mrsivagoram@gmail.com" style={{ color: 'var(--text)' }}>mrsivagoram@gmail.com</a></p>
          <p style={{ margin: 0 }}><strong>Support Hours:</strong> Monday &ndash; Saturday, 9:00 AM &ndash; 6:00 PM IST</p>
        </div>
      </LegalSection>
    </LegalPolicyPage>
  );
}
