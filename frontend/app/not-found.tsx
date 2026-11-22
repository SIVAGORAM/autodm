import Link from 'next/link';
import Image from 'next/image';
export default function NotFound() {
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#F5F9F8', fontFamily: 'Inter, system-ui, sans-serif', padding: 24 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, color: '#12807A', fontWeight: 700, fontSize: 22, marginBottom: 20 }}>
          <Image src="/heylaunch-logo.png" alt="HeyLaunch" width={150} height={30} />
        </div>
        <div style={{ fontSize: 64, fontWeight: 800, letterSpacing: '-2px', color: '#0C1D1A' }}>404</div>
        <p style={{ color: '#5C7872', fontSize: 16, margin: '8px 0 24px' }}>This page doesn’t exist.</p>
        <Link href="/dashboard" style={{ background: '#12807A', color: '#fff', padding: '12px 24px', borderRadius: 12, fontWeight: 600, textDecoration: 'none' }}>Back to dashboard</Link>
      </div>
    </div>
  );
}
