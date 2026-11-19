import Link from 'next/link';

export const AC = {
  bg: '#ffffff', soft: '#F4F8F7', line: '#E3EBE9', ink: '#0E1F1C',
  muted: '#5F7A74', teal: '#15807A', tealSoft: '#E3F2F0', coral: '#F2602F', green: '#17936A',
};

// The dark branded left panel shared by every auth screen.
export function AuthBrand() {
  return (
    <div style={{ background: `linear-gradient(165deg, #0E1F1C 0%, #103A35 100%)`, color: '#fff', padding: '48px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', position: 'relative', overflow: 'hidden' }} className="auth-brand">
      <div style={{ position: 'absolute', top: -120, right: -120, width: 320, height: 320, borderRadius: '50%', background: 'rgba(37,188,175,.14)', filter: 'blur(90px)' }} />
      <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 11, fontWeight: 700, fontSize: 21, letterSpacing: '-.4px', color: '#fff', textDecoration: 'none', position: 'relative' }}>
        <span style={{ width: 24, height: 24, borderRadius: '50%', border: `2.5px solid ${AC.teal}`, display: 'grid', placeItems: 'center' }}>
          <span style={{ width: 9, height: 9, borderRadius: '50%', background: AC.coral }} />
        </span>relayo
      </Link>
      <div style={{ position: 'relative' }}>
        <h2 style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-1px', lineHeight: 1.18, maxWidth: 360 }}>Know the second your auto-DM breaks.</h2>
        <p style={{ color: '#9fc0ba', fontSize: 15.5, lineHeight: 1.6, marginTop: 14, maxWidth: 340 }}>Live status, a delivery log, and an alert the moment a connection drops. The reliability other DM tools leave you guessing about.</p>
        <div style={{ marginTop: 28, background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 14, padding: '16px 18px', maxWidth: 340, backdropFilter: 'blur(6px)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>Free guide on my Reel</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#6ee7cf', background: 'rgba(23,147,106,.22)', padding: '4px 10px', borderRadius: 999 }}>Healthy</span>
          </div>
          <div style={{ fontSize: 12.5, color: '#8fb3ad', marginTop: 5 }}>312 sent · 0 failed · fired 2 min ago</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 18, fontSize: 12.5, color: '#8fb3ad', position: 'relative' }}>
        <span>Meta-official API</span><span>·</span><span>AES-256 encrypted tokens</span>
      </div>
    </div>
  );
}
