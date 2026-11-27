import type { Metadata } from 'next';
import { LegalPolicyPage, LegalSection } from '../../../components/legal-policy-page';
import { CookiePreferencesManager } from '../../../components/cookie-preferences-manager';

export const metadata: Metadata = {
  title: 'Cookie Policy & Consent | HeyLaunch',
  description: 'Understand how HeyLaunch uses cookies, session tokens, and local storage, and manage your cookie preferences in real-time.',
  robots: { index: true, follow: true },
};

export default function CookiesPage() {
  return (
    <LegalPolicyPage title="Cookie Policy & Consent">
      <p>
        This Cookie Policy explains how <strong>HeyLaunch</strong> (&ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;), operated by <strong>Siva Goram</strong> in Hyderabad, Telangana, India, uses cookies, local storage, and similar technologies when you visit our website, sign in to your dashboard, and use our Instagram automation services.
      </p>

      {/* Interactive Live Preferences Manager */}
      <LegalSection title="Manage Your Cookie Preferences">
        <p>
          You have full control over non-essential cookies. Use the real-time manager below to inspect your current status or adjust your settings at any time. Your preferences are saved immediately without requiring a page refresh.
        </p>
        <CookiePreferencesManager />
      </LegalSection>

      <LegalSection title="1. What Are Cookies and Local Storage?">
        <p>
          Cookies are small data files placed on your device by websites you visit. They are widely used to make websites work efficiently, provide secure authentication, and supply reporting information.
        </p>
        <p>
          In addition to standard HTTP cookies, HeyLaunch utilizes modern web storage technologies such as <code>localStorage</code> and <code>sessionStorage</code>. In this policy, we collectively refer to all these mechanisms as &ldquo;cookies and tracking technologies.&rdquo;
        </p>
      </LegalSection>

      <LegalSection title="2. Categories of Cookies We Use">
        <p>We classify our cookies and local storage items into three distinct categories:</p>

        <div style={{ marginTop: 14 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: '14px 0 6px', color: 'var(--text)' }}>
            A. Strictly Necessary (Essential) Cookies
          </h3>
          <p>
            These cookies are indispensable for our service to function. They handle secure user authentication, token refresh flows, Cross-Site Request Forgery (CSRF) protection, and store your cookie consent preferences. Because the platform cannot operate securely without them, these cookies cannot be disabled.
          </p>

          <h3 style={{ fontSize: 16, fontWeight: 700, margin: '18px 0 6px', color: 'var(--text)' }}>
            B. Preferences &amp; Functional Cookies (Optional)
          </h3>
          <p>
            These cookies allow our website to remember choices you make—such as your selected dashboard theme mode (dark or light), collapsed sidebar states, and regional language preferences (English, Hinglish, or Telugu). Enabling these cookies ensures a consistent, personalized creator experience across sessions.
          </p>

          <h3 style={{ fontSize: 16, fontWeight: 700, margin: '18px 0 6px', color: 'var(--text)' }}>
            C. Performance &amp; Analytics Cookies (Optional)
          </h3>
          <p>
            These cookies collect aggregated, pseudonymized information regarding how visitors navigate the platform, API endpoint latency, and page load performance. They do not store personal identifiable information and are used solely to diagnose technical bottlenecks and improve platform reliability.
          </p>
        </div>
      </LegalSection>

      <LegalSection title="3. Full Cookie & Storage Inventory">
        <div style={{ overflowX: 'auto', marginTop: 12 }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: 13,
              textAlign: 'left',
              border: '1px solid var(--border)',
              borderRadius: 8,
            }}
          >
            <thead>
              <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '10px 12px', fontWeight: 700 }}>Identifier / Name</th>
                <th style={{ padding: '10px 12px', fontWeight: 700 }}>Type &amp; Duration</th>
                <th style={{ padding: '10px 12px', fontWeight: 700 }}>Category</th>
                <th style={{ padding: '10px 12px', fontWeight: 700 }}>Purpose</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '10px 12px', fontFamily: 'monospace' }}>token</td>
                <td style={{ padding: '10px 12px' }}>HTTP Cookie (15 min)</td>
                <td style={{ padding: '10px 12px', fontWeight: 600, color: '#16a34a' }}>Strictly Necessary</td>
                <td style={{ padding: '10px 12px' }}>Cryptographically signed JWT access token for authenticated API requests.</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '10px 12px', fontFamily: 'monospace' }}>refreshToken</td>
                <td style={{ padding: '10px 12px' }}>HTTP-only (30 days)</td>
                <td style={{ padding: '10px 12px', fontWeight: 600, color: '#16a34a' }}>Strictly Necessary</td>
                <td style={{ padding: '10px 12px' }}>Secure, HTTP-only refresh token to maintain creator session persistence.</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '10px 12px', fontFamily: 'monospace' }}>heylaunch_cookie_consent_v1</td>
                <td style={{ padding: '10px 12px' }}>localStorage (Persistent)</td>
                <td style={{ padding: '10px 12px', fontWeight: 600, color: '#16a34a' }}>Strictly Necessary</td>
                <td style={{ padding: '10px 12px' }}>Remembers your cookie preferences and consent timestamp so the banner does not repeatedly prompt you.</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '10px 12px', fontFamily: 'monospace' }}>heylaunch_theme</td>
                <td style={{ padding: '10px 12px' }}>localStorage (Persistent)</td>
                <td style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--text)' }}>Preferences</td>
                <td style={{ padding: '10px 12px' }}>Stores your selected dark or light appearance setting.</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '10px 12px', fontFamily: 'monospace' }}>heylaunch_sidebar_collapsed</td>
                <td style={{ padding: '10px 12px' }}>localStorage (Persistent)</td>
                <td style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--text)' }}>Preferences</td>
                <td style={{ padding: '10px 12px' }}>Remembers whether your dashboard navigation rail is expanded or collapsed.</td>
              </tr>
              <tr>
                <td style={{ padding: '10px 12px', fontFamily: 'monospace' }}>heylaunch_telemetry</td>
                <td style={{ padding: '10px 12px' }}>sessionStorage (Session)</td>
                <td style={{ padding: '10px 12px', fontWeight: 600, color: '#8B5CF6' }}>Analytics</td>
                <td style={{ padding: '10px 12px' }}>Aggregates web vitals and frontend response latencies to detect network degradations.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </LegalSection>

      <LegalSection title="4. Third-Party Cookies &amp; Social Platform Integrations">
        <p>
          HeyLaunch integrates with the official <strong>Meta Instagram Graph API</strong> and <strong>Razorpay</strong> payment gateway. When you initiate Meta OAuth or pay for a plan upgrade, these third-party providers may set security and fraud-prevention cookies on their respective domains.
        </p>
        <p>
          We do not inject third-party ad-tracking cookies, tracking pixels, or cross-site tracking scripts into your browser.
        </p>
      </LegalSection>

      <LegalSection title="5. How to Control Cookies in Your Browser">
        <p>
          In addition to our live preferences manager above, you can block or delete cookies through your web browser settings. Note that disabling strictly necessary cookies will prevent you from signing in to HeyLaunch:
        </p>
        <ul>
          <li><strong>Google Chrome:</strong> Settings &rarr; Privacy and security &rarr; Third-party cookies.</li>
          <li><strong>Apple Safari:</strong> Settings &rarr; Safari &rarr; Advanced &rarr; Block All Cookies.</li>
          <li><strong>Mozilla Firefox:</strong> Settings &rarr; Privacy &amp; Security &rarr; Cookies and Site Data.</li>
          <li><strong>Microsoft Edge:</strong> Settings &rarr; Cookies and site permissions &rarr; Manage and delete cookies.</li>
        </ul>
      </LegalSection>

      <LegalSection title="6. Compliance with Privacy Regulations">
        <p>
          Our cookie management framework adheres to the following privacy standards:
        </p>
        <ul>
          <li><strong>Digital Personal Data Protection Act (DPDP Act 2023, India):</strong> Clear notice and voluntary choice regarding personal data collection.</li>
          <li><strong>EU ePrivacy Directive &amp; General Data Protection Regulation (GDPR):</strong> Prior opt-in consent for non-essential cookies with equal ease of accepting or rejecting.</li>
          <li><strong>Meta Developer Data Policies:</strong> Complete prohibition of third-party profiling or unauthorized scraping of Instagram Graph API data.</li>
        </ul>
      </LegalSection>

      <LegalSection title="7. Contact &amp; Grievance Redressal">
        <p>
          If you have questions about our use of cookies or wish to submit a privacy request, please contact our team:
        </p>
        <div style={{ marginTop: 12, padding: 16, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg)' }}>
          <p style={{ margin: '0 0 6px' }}><strong>Officer:</strong> Siva Goram</p>
          <p style={{ margin: '0 0 6px' }}><strong>Entity:</strong> HeyLaunch</p>
          <p style={{ margin: '0 0 6px' }}><strong>Registered Location:</strong> Madhapur, Hyderabad, Telangana, India - 500081</p>
          <p style={{ margin: 0 }}><strong>Email:</strong> <a href="mailto:mrsivagoram@gmail.com" style={{ color: 'var(--text)' }}>mrsivagoram@gmail.com</a></p>
        </div>
      </LegalSection>
    </LegalPolicyPage>
  );
}
