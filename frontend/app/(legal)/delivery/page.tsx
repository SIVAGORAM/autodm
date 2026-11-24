import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPolicyPage, LegalSection } from '../../../components/legal-policy-page';

export const metadata: Metadata = { 
  title: 'Shipping & Delivery Policy | HeyLaunch', 
  description: 'Digital service fulfillment and delivery policy for HeyLaunch SaaS plans.',
  robots: { index: true, follow: true } 
};

export default function DeliveryPage() {
  return (
    <LegalPolicyPage title="Shipping & Digital Delivery Policy">
      <p>
        <strong>HeyLaunch</strong> (operated by Siva Goram, Hyderabad, Telangana, India) provides digital software-as-a-service (SaaS) solutions for Instagram creators and businesses. This policy outlines how services and plan upgrades are delivered to customers.
      </p>

      <LegalSection title="1. Nature of Product & Services">
        <p>
          HeyLaunch is a <strong>100% cloud-hosted digital software service</strong>. We do not sell or deliver any tangible or physical merchandise. Consequently, <strong>no physical shipping, packaging, courier delivery, or postal logistics</strong> are involved in the delivery of our services.
        </p>
      </LegalSection>

      <LegalSection title="2. Fulfillment & Delivery Timelines">
        <p>
          Digital service fulfillment occurs <strong>electronically and immediately</strong>:
        </p>
        <ul>
          <li><strong>Instant Account Activation:</strong> Upon successful completion and authorization of payment through our payment gateway partner, <strong>Razorpay</strong>, your selected plan tier (Starter, Pro, or Scale) is unlocked and provisioned to your account in real time (within 1 to 5 seconds).</li>
          <li><strong>Access Credentials:</strong> Access to your plan features is provided directly within your HeyLaunch web dashboard (<Link href="/dashboard" style={{ color: 'var(--text)', textDecoration: 'underline' }}>https://frontend-fawn-six-26.vercel.app/dashboard</Link>). No shipping code or physical voucher is required.</li>
          <li><strong>Digital Invoices & Receipts:</strong> An automated purchase confirmation and payment receipt containing your transaction reference number and plan details is sent immediately to your registered email address by Razorpay and HeyLaunch.</li>
        </ul>
      </LegalSection>

      <LegalSection title="3. Delivery Issues & Support SLA">
        <p>
          In rare circumstances where network disruption prevents immediate account upgrading after payment:
        </p>
        <ul>
          <li>Please allow up to 10 minutes for automated background webhook reconciliation between Razorpay and HeyLaunch.</li>
          <li>If your features are not reflected after 10 minutes, contact our technical support desk at <a href="mailto:mrsivagoram@gmail.com" style={{ color: 'var(--text)' }}>mrsivagoram@gmail.com</a> with your Payment ID (<code>pay_...</code>).</li>
          <li>Our engineering team will manually verify the payment status and ensure your plan is provisioned within <strong>2 to 4 hours</strong> of notification.</li>
        </ul>
      </LegalSection>

      <LegalSection title="4. Contact Information">
        <p>
          For questions regarding digital service delivery or order fulfillment, please contact:
        </p>
        <div style={{ marginTop: 12, padding: 16, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg)' }}>
          <p style={{ margin: '0 0 6px' }}><strong>Service Provider:</strong> HeyLaunch</p>
          <p style={{ margin: '0 0 6px' }}><strong>Operator:</strong> Siva Goram</p>
          <p style={{ margin: '0 0 6px' }}><strong>Office Address:</strong> Madhapur, Hyderabad, Telangana, India - 500081</p>
          <p style={{ margin: '0 0 6px' }}><strong>Support Email:</strong> <a href="mailto:mrsivagoram@gmail.com" style={{ color: 'var(--text)' }}>mrsivagoram@gmail.com</a></p>
          <p style={{ margin: 0 }}><strong>Operational Hours:</strong> Monday &ndash; Saturday, 9:00 AM &ndash; 6:00 PM IST</p>
        </div>
      </LegalSection>
    </LegalPolicyPage>
  );
}
