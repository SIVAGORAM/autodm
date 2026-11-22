import Link from 'next/link';
import Image from 'next/image';

/**
 * Auth palette — mapped onto the HeyLaunch semantic tokens (globals.css).
 * Every value is a CSS custom property, so the five auth screens adapt to
 * Light / Dark / System automatically. Do not reintroduce raw hex here.
 */
export const AC = {
  bg: 'var(--bg)',
  soft: 'var(--card-hover)',
  line: 'var(--border)',
  ink: 'var(--text)',
  muted: 'var(--text-muted)',
  teal: 'var(--btn-primary)',        // primary action + inline links (adaptive ink)
  btnText: 'var(--btn-primary-text)',
  tealSoft: 'var(--focus-ring)',     // focus glow
  coral: 'var(--error)',
  green: 'var(--success)',
  // status surfaces
  errBg: 'var(--error-soft)', err: 'var(--error)',
  okBg: 'var(--success-soft)', ok: 'var(--success)',
};

/**
 * The branded panel shown on the left of every auth screen.
 * Intentionally fixed-dark (charcoal) in both themes — a premium split-screen
 * pattern — with the signature lime accent. The icon is used as-is.
 */
export function AuthBrand() {
  return (
    <div
      className="auth-brand"
      style={{
        background: 'linear-gradient(165deg, #0B0B0D 0%, #17171B 100%)',
        color: '#F9FAFB',
        padding: '48px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div style={{ position: 'absolute', top: -140, right: -140, width: 340, height: 340, borderRadius: '50%', background: 'rgba(185,245,0,.10)', filter: 'blur(90px)' }} />
      <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 11, fontWeight: 700, fontSize: 21, letterSpacing: '-.4px', color: '#F9FAFB', textDecoration: 'none', position: 'relative' }}>
        <Image src="/heylaunch-icon.png" alt="" width={30} height={30} />HeyLaunch
      </Link>

      <div style={{ position: 'relative' }}>
        <h2 style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-1px', lineHeight: 1.18, maxWidth: 360 }}>
          Know when a connection needs attention.
        </h2>
        <p style={{ color: '#A1A1AA', fontSize: 15.5, lineHeight: 1.6, marginTop: 14, maxWidth: 340 }}>
          Check automation health, recorded delivery outcomes, and connection status in one place. If email is configured, we send an alert after a scheduled token refresh fails.
        </p>
        <div style={{ marginTop: 28, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 14, padding: '16px 18px', maxWidth: 340 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>Example: guide link from a post</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#17171B', background: '#B9F500', padding: '4px 10px', borderRadius: 999 }}>Healthy</span>
          </div>
          <div style={{ fontSize: 12.5, color: '#A1A1AA', marginTop: 5 }}>Sample status · comment matched · DM recorded</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16, fontSize: 12.5, color: '#A1A1AA', position: 'relative', flexWrap: 'wrap' }}>
        <span>Official Instagram API</span><span style={{ color: 'rgba(255,255,255,.25)' }}>·</span><span>AES-256 encrypted tokens</span>
      </div>
    </div>
  );
}
