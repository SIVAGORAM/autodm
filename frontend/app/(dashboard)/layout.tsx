'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '../../store/authStore';
import { RL, RLStyles, Spinner } from '../../components/rl-kit';
import { LayoutDashboard, Send, Instagram, BarChart2, FileText, CreditCard, Settings, Bell, HelpCircle, LogOut, ChevronRight } from 'lucide-react';

const nav = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/dashboard/automations', label: 'Automations', icon: Send },
  { href: '/dashboard/instagram', label: 'Instagram', icon: Instagram },
  { href: '/dashboard/analytics', label: 'Analytics', icon: BarChart2 },
  { href: '/dashboard/logs', label: 'DM Logs', icon: FileText },
  { href: '/dashboard/billing', label: 'Billing', icon: CreditCard },
  { href: '/dashboard/notifications', label: 'Notifications', icon: Bell },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
];

const crumbs: Record<string, string> = {
  '/dashboard': 'Overview', '/dashboard/automations': 'Automations', '/dashboard/instagram': 'Instagram',
  '/dashboard/analytics': 'Analytics', '/dashboard/logs': 'DM Logs', '/dashboard/billing': 'Billing',
  '/dashboard/notifications': 'Notifications', '/dashboard/settings': 'Settings',
  '/dashboard/help': 'Help', '/dashboard/feedback': 'Feedback',
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, isLoading, isFetched, fetchMe, logout } = useAuthStore();
  const [menu, setMenu] = useState(false);

  useEffect(() => { fetchMe().catch(() => router.push('/login')); }, []);
  useEffect(() => {
    if (isFetched && user && user.isVerified === false) router.push('/verify');
  }, [isFetched, user, router]);

  if (!isAuthenticated && isLoading) {
    return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: RL.bg }}><Spinner /></div>;
  }
  if (!isAuthenticated) return null;

  const current = crumbs[pathname] ?? (pathname.includes('/automations/') ? 'Automations' : 'Overview');
  const initial = user?.name?.[0]?.toUpperCase() || 'U';

  return (
    <div style={{ display: 'flex', height: '100vh', background: RL.bg, color: RL.ink, fontFamily: 'Inter, system-ui, sans-serif' }}>
      <RLStyles />
      {/* ─── Sidebar ─────────────────────────────────────────── */}
      <aside style={{ width: 248, background: RL.surface, borderRight: `1px solid ${RL.line}`, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', flexShrink: 0 }}>
        <div>
          <div style={{ padding: '22px 24px', display: 'flex', alignItems: 'center', gap: 11 }}>
            <span style={{ width: 24, height: 24, borderRadius: '50%', border: `2.5px solid ${RL.teal}`, display: 'grid', placeItems: 'center' }}>
              <span className="rl-live" style={{ width: 8, height: 8, borderRadius: '50%', background: RL.coral }} />
            </span>
            <span style={{ fontWeight: 700, fontSize: 20, letterSpacing: '-.5px', color: RL.teal }}>relayo</span>
          </div>
          <nav style={{ padding: '8px 14px', display: 'grid', gap: 3 }}>
            {nav.map((item) => {
              const active = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link key={item.href} href={item.href} className="rl-nav"
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 13px', borderRadius: 11, fontSize: 14.5, fontWeight: active ? 650 : 500, textDecoration: 'none',
                    color: active ? RL.teal : RL.muted, background: active ? RL.tealSoft : 'transparent' }}>
                  <Icon style={{ width: 18, height: 18 }} /> {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div style={{ padding: '14px 14px 18px', borderTop: `1px solid ${RL.lineSoft}`, display: 'grid', gap: 2 }}>
          <Link href="/dashboard/help" className="rl-nav" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 13px', borderRadius: 11, fontSize: 13.5, fontWeight: 500, color: RL.muted, textDecoration: 'none' }}>
            <HelpCircle style={{ width: 17, height: 17 }} /> Help Center
          </Link>
          <button onClick={logout} className="rl-nav" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 13px', borderRadius: 11, fontSize: 13.5, fontWeight: 500, color: RL.red, background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%' }}>
            <LogOut style={{ width: 17, height: 17 }} /> Log out
          </button>
        </div>
      </aside>

      {/* ─── Main ─────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
        <header style={{ height: 62, borderBottom: `1px solid ${RL.line}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 28px', background: '#ffffffcc', backdropFilter: 'blur(10px)', flexShrink: 0 }}>
          <div style={{ fontSize: 14, color: RL.muted, display: 'flex', alignItems: 'center', gap: 7 }}>
            Dashboard <ChevronRight style={{ width: 14, height: 14, color: RL.faint }} /> <span style={{ color: RL.ink, fontWeight: 600 }}>{current}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <Link href="/dashboard/billing" className="rl-b" style={{ background: RL.coral, color: '#fff', padding: '8px 16px', borderRadius: 999, fontSize: 13, fontWeight: 600, textDecoration: 'none', boxShadow: '0 8px 18px -10px rgba(241,95,44,.55)' }}>Upgrade</Link>
            <Link href="/dashboard/notifications" style={{ position: 'relative', color: RL.muted, padding: 7, borderRadius: 10, display: 'grid', placeItems: 'center' }}>
              <Bell style={{ width: 18, height: 18 }} />
              <span className="rl-live" style={{ position: 'absolute', top: 5, right: 5, width: 7, height: 7, borderRadius: '50%', background: RL.coral }} />
            </Link>
            <div style={{ position: 'relative' }}>
              <button onClick={() => setMenu((m) => !m)} style={{ width: 34, height: 34, borderRadius: '50%', background: `linear-gradient(135deg, ${RL.teal}, ${RL.tealD})`, color: '#fff', fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer' }}>{initial}</button>
              {menu && (
                <>
                  <div onClick={() => setMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
                  <div style={{ position: 'absolute', right: 0, top: 44, width: 220, background: '#fff', border: `1px solid ${RL.line}`, borderRadius: 14, boxShadow: '0 20px 48px -18px rgba(12,29,26,.25)', padding: 8, zIndex: 50 }}>
                    <div style={{ padding: '8px 12px 10px', borderBottom: `1px solid ${RL.lineSoft}`, marginBottom: 6 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: RL.ink }}>{user?.name || 'Account'}</div>
                      <div style={{ fontSize: 12.5, color: RL.muted, overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.email}</div>
                    </div>
                    <Link href="/dashboard/settings" onClick={() => setMenu(false)} style={{ display: 'block', padding: '9px 12px', borderRadius: 9, fontSize: 14, color: RL.ink, textDecoration: 'none' }} className="rl-nav">Settings</Link>
                    <Link href="/dashboard/billing" onClick={() => setMenu(false)} style={{ display: 'block', padding: '9px 12px', borderRadius: 9, fontSize: 14, color: RL.ink, textDecoration: 'none' }} className="rl-nav">Billing</Link>
                    <button onClick={() => { setMenu(false); logout(); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 12px', borderRadius: 9, fontSize: 14, color: RL.red, background: 'none', border: 'none', cursor: 'pointer' }} className="rl-nav">Log out</button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>
        <main style={{ flex: 1, overflowY: 'auto', padding: '32px 36px', maxWidth: 1280, width: '100%', margin: '0 auto' }}>
          {children}
        </main>
      </div>
    </div>
  );
}
