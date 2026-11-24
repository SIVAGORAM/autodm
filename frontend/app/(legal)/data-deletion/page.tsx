import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPolicyPage, LegalSection } from '../../../components/legal-policy-page';

export const metadata: Metadata = { 
  title: 'User Data Deletion Instructions | HeyLaunch', 
  description: 'Step-by-step instructions for deleting your Instagram and personal data from HeyLaunch in compliance with Meta Platform Terms.',
  robots: { index: true, follow: true } 
};

export default function DataDeletionPage() {
  return (
    <LegalPolicyPage title="User Data Deletion Instructions">
      <p>
        In accordance with the <strong>Meta Platform Terms</strong> and Developer Policies, <strong>HeyLaunch</strong> provides clear, simple mechanisms for users to request the permanent deletion of their account, connected Instagram account details, and all associated personal data stored on our servers.
      </p>

      <LegalSection title="Option 1: Instant Self-Service Deletion (Recommended)">
        <p>You can permanently delete all data stored by HeyLaunch directly from your account dashboard:</p>
        <ol style={{ paddingLeft: 22, margin: '12px 0', lineHeight: 1.8 }}>
          <li>Log in to your HeyLaunch account at <Link href="/login" style={{ color: 'var(--text)', textDecoration: 'underline' }}>https://frontend-fawn-six-26.vercel.app/login</Link>.</li>
          <li>Navigate to <strong>Dashboard &rarr; Settings &rarr; Account</strong>.</li>
          <li>Scroll down to the <strong>&ldquo;Delete Account&rdquo;</strong> section.</li>
          <li>Click the <strong>&ldquo;Delete My Account&rdquo;</strong> button and confirm your password.</li>
        </ol>
        <p>
          Once confirmed, all active automations are instantly stopped, all stored Meta OAuth tokens are revoked and purged from memory, and your account records and contact lists are permanently deleted from our database.
        </p>
      </LegalSection>

      <LegalSection title="Option 2: Revoking Access via Facebook / Instagram">
        <p>If you wish to revoke HeyLaunch&rsquo;s access to your Instagram account without logging into HeyLaunch:</p>
        <ol style={{ paddingLeft: 22, margin: '12px 0', lineHeight: 1.8 }}>
          <li>Open your <strong>Facebook Account Settings &rarr; Security &rarr; Apps and Websites</strong>.</li>
          <li>Locate <strong>&ldquo;HeyLaunch&rdquo;</strong> in the list of authorized apps.</li>
          <li>Click <strong>&ldquo;Remove&rdquo;</strong> to revoke all API permissions and tokens.</li>
          <li>(Alternatively, in the <strong>Instagram App</strong>: Go to <strong>Settings &rarr; Security &rarr; Apps and Websites &rarr; Active</strong>, find HeyLaunch and tap <strong>Remove</strong>).</li>
        </ol>
        <p>
          Meta will send an automated de-authorization event to our backend webhook, which will immediately deactivate your automation sync and clear cached tokens.
        </p>
      </LegalSection>

      <LegalSection title="Option 3: Manual Deletion Request via Email">
        <p>
          If you are unable to access your dashboard or prefer manual deletion handled by our support engineering team:
        </p>
        <ol style={{ paddingLeft: 22, margin: '12px 0', lineHeight: 1.8 }}>
          <li>Send an email to our Data Protection team at <a href="mailto:mrsivagoram@gmail.com" style={{ color: 'var(--text)' }}>mrsivagoram@gmail.com</a>.</li>
          <li>Use the subject line: <strong>&ldquo;Meta Data Deletion Request - [Your Instagram Username]&rdquo;</strong>.</li>
          <li>Include your registered email address and your connected Instagram handle.</li>
        </ol>
        <p>
          <strong>SLA & Confirmation:</strong> We will acknowledge your email within <strong>24 business hours</strong>. Our team will verify ownership, permanently delete all database rows, encrypted tokens, and log references, and reply with an official <strong>Confirmation of Data Deletion</strong> within <strong>48 hours</strong>.
        </p>
      </LegalSection>

      <LegalSection title="What Data Is Permanently Purged">
        <p>Upon processing your deletion request, HeyLaunch permanently deletes:</p>
        <ul>
          <li>All Instagram User IDs, Instagram Business Account IDs, and connected profile data.</li>
          <li>All encrypted Meta OAuth access tokens and refresh tokens.</li>
          <li>All automation rules, trigger keywords, and prepared reply templates.</li>
          <li>All recipient DM delivery logs, tracking click logs, and contact interaction histories.</li>
          <li>Your user account record, email, and authentication hashes.</li>
        </ul>
        <p style={{ fontSize: 13, color: 'var(--text-faint)', marginTop: 12 }}>
          Note: Anonymized payment settlement receipts may be retained for statutory taxation and accounting compliance under Indian law for the period required by authorities.
        </p>
      </LegalSection>

      <LegalSection title="Questions & Support">
        <div style={{ padding: 16, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg)' }}>
          <p style={{ margin: '0 0 6px' }}><strong>Data Protection Officer:</strong> Siva Goram</p>
          <p style={{ margin: '0 0 6px' }}><strong>Service:</strong> HeyLaunch</p>
          <p style={{ margin: '0 0 6px' }}><strong>Email:</strong> <a href="mailto:mrsivagoram@gmail.com" style={{ color: 'var(--text)' }}>mrsivagoram@gmail.com</a></p>
          <p style={{ margin: 0 }}><strong>Registered Address:</strong> Madhapur, Hyderabad, Telangana, India - 500081</p>
        </div>
      </LegalSection>
    </LegalPolicyPage>
  );
}
