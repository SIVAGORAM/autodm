'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import { api, authApi } from '../../services/api';
import { LEGAL_POLICIES_APPROVED, PRIVACY_VERSION, TERMS_VERSION } from '../../lib/legal-policy';
import { RLStyles, Spinner } from '../../components/rl-kit';
import { TrialBanner } from '../../components/trial-banner';
import { ThemeToggle } from '../../components/theme-toggle';
import { NotificationBell } from '../../components/notification-bell';
import type { LucideIcon } from 'lucide-react';
import { LayoutDashboard, Send, Instagram, BarChart2, FileText, CreditCard, Settings, Bell, HelpCircle, LogOut, ChevronRight, Menu, X, Sparkles, UsersRound, ShieldAlert, LifeBuoy, Mail, MessageSquareText, Link2 } from 'lucide-react';

type AdminPermission = 'SUPPORT_MANAGE' | 'PROFILE_MODERATE' | 'CONTACT_MANAGE' | 'MAIL_READ' | 'OPERATIONS_READ';
const nav: Array<{ href: string; label: string; icon: LucideIcon; adminOnly?: boolean; superAdminOnly?: boolean; permission?: AdminPermission }> = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/dashboard/automations', label: 'Automations', icon: Send },
  { href: '/dashboard/profile', label: 'Public profile', icon: Link2 },
  { href: '/dashboard/contacts', label: 'Contacts', icon: UsersRound },
  { href: '/dashboard/instagram', label: 'Instagram', icon: Instagram },
  { href: '/dashboard/analytics', label: 'Analytics', icon: BarChart2 },
  { href: '/dashboard/logs', label: 'DM Logs', icon: FileText },
  { href: '/dashboard/billing', label: 'Billing', icon: CreditCard },
  { href: '/dashboard/notifications', label: 'Notifications', icon: Bell },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
  { href: '/dashboard/admin/webhooks', label: 'Operations', icon: ShieldAlert, adminOnly: true, permission: 'OPERATIONS_READ' },
  { href: '/dashboard/admin/mail', label: 'Mail delivery', icon: Mail, adminOnly: true, permission: 'MAIL_READ' },
  { href: '/dashboard/admin/support', label: 'Support inbox', icon: LifeBuoy, adminOnly: true, permission: 'SUPPORT_MANAGE' },
  { href: '/dashboard/admin/profile-reports', label: 'Profile reports', icon: ShieldAlert, adminOnly: true, permission: 'PROFILE_MODERATE' },
  { href: '/dashboard/admin/enquiries', label: 'Contact enquiries', icon: MessageSquareText, adminOnly: true, permission: 'CONTACT_MANAGE' },
  { href: '/dashboard/admin', label: 'Command center', icon: LayoutDashboard, superAdminOnly: true },
  { href: '/dashboard/admin/team', label: 'Admin team', icon: UsersRound, superAdminOnly: true },
  { href: '/dashboard/admin/customers', label: 'Customers', icon: UsersRound, superAdminOnly: true },
  { href: '/dashboard/admin/billing', label: 'Billing ledger', icon: CreditCard, superAdminOnly: true },
];

const crumbs: Record<string, string> = {
  '/dashboard': 'Overview', '/dashboard/automations': 'Automations', '/dashboard/instagram': 'Instagram',
  '/dashboard/profile': 'Public profile',
  '/dashboard/analytics': 'Analytics', '/dashboard/contacts': 'Contacts', '/dashboard/logs': 'DM Logs', '/dashboard/billing': 'Billing',
  '/dashboard/notifications': 'Notifications', '/dashboard/settings': 'Settings',
  '/dashboard/admin/webhooks': 'Webhook operations',
  '/dashboard/admin/mail': 'Mail delivery',
  '/dashboard/admin/support': 'Support inbox',
  '/dashboard/admin/profile-reports': 'Profile reports',
  '/dashboard/admin/enquiries': 'Contact enquiries',
  '/dashboard/admin': 'Command center',
  '/dashboard/admin/team': 'Admin team',
  '/dashboard/admin/customers': 'Customers',
  '/dashboard/admin/billing': 'Billing ledger',
  '/dashboard/help': 'Help', '/dashboard/feedback': 'Feedback',
};

const eventQueryKeys: Record<string, string[]> = {
  automation: ['automations', 'automation', 'automation-stats', 'automation-runs'],
  delivery: ['automations', 'automation-stats', 'automation-runs', 'runs', 'contacts', 'subscription', 'creator-worker-status', 'admin'],
  instagram: ['ig-accounts', 'automations', 'automation-stats', 'automation-runs', 'runs', 'contacts', 'creator-worker-status'],
  billing: ['subscription', 'admin'],
  contacts: ['contacts', 'admin'],
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, isLoading, isFetched, fetchMe, logout } = useAuthStore();
  const queryClient = useQueryClient();
  const [menu, setMenu] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [sessionCheckFailed, setSessionCheckFailed] = useState(false);

  const verifySession = useCallback(() => {
    setSessionCheckFailed(false);
    return fetchMe().then(() => undefined).catch((error: { response?: { status?: number } }) => {
      if (error?.response?.status === 401) {
        router.replace('/login');
      } else if (!user) {
        setSessionCheckFailed(true);
      }
    });
  }, [fetchMe, router, user]);

  useEffect(() => { void verifySession(); }, [verifySession]);
  useEffect(() => {
    if (!isAuthenticated || !user?.id || typeof EventSource === 'undefined' || !api.defaults.baseURL) return;
    const source = new EventSource(`${api.defaults.baseURL}/dashboard/events`, { withCredentials: true });
    let lastSessionCheckAt = 0;
    const onInvalidation = (rawEvent: Event) => {
      try {
        const event = JSON.parse((rawEvent as MessageEvent<string>).data) as { resource?: unknown };
        if (typeof event.resource !== 'string') return;
        for (const key of eventQueryKeys[event.resource] ?? []) {
          void queryClient.invalidateQueries({ queryKey: [key] });
        }
      } catch {
        // Ignore malformed advisory messages; normal query polling remains on.
      }
    };
    source.addEventListener('invalidate', onInvalidation);
    source.onerror = () => {
      // EventSource does not run the Axios 401 refresh interceptor. Check the
      // session occasionally so an expired access cookie can be rotated while
      // the browser reconnects; API polling remains the fallback if offline.
      if (Date.now() - lastSessionCheckAt < 60_000) return;
      lastSessionCheckAt = Date.now();
      void authApi.me().catch(() => undefined);
    };
    return () => {
      source.removeEventListener('invalidate', onInvalidation);
      source.close();
    };
  }, [isAuthenticated, user?.id, queryClient]);
  useEffect(() => {
    if (isFetched && user && user.isVerified === false) router.push('/verify');
  }, [isFetched, user, router]);
  useEffect(() => {
    if (LEGAL_POLICIES_APPROVED && isFetched && user?.isVerified !== false && user &&
      (user.termsVersion !== TERMS_VERSION || user.privacyVersion !== PRIVACY_VERSION)) {
      router.replace('/legal/accept');
    }
  }, [isFetched, user, router]);
  // Close the mobile drawer whenever the route changes.
  useEffect(() => { setDrawer(false); }, [pathname]);

  if (!isAuthenticated && isLoading) {
    return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--bg)' }}><Spinner /></div>;
  }
  if (!isAuthenticated && sessionCheckFailed) {
    return <main role="alert" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: 'var(--bg)', color: 'var(--text)' }}>
      <div style={{ width: 'min(100%, 420px)', textAlign: 'center' }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>We couldn’t verify your session</h1>
        <p style={{ marginTop: 8, color: 'var(--text-muted)', lineHeight: 1.6 }}>The service may be waking up or temporarily unavailable. Your account has not been signed out.</p>
        <button type="button" onClick={() => void verifySession()} style={{ marginTop: 18, minHeight: 44, padding: '0 18px', border: 0, borderRadius: 10, background: 'var(--text)', color: 'var(--bg)', font: 'inherit', fontWeight: 650, cursor: 'pointer' }}>Try again</button>
        <div style={{ marginTop: 14 }}><Link href="/login" style={{ color: 'var(--text-muted)' }}>Back to sign in</Link></div>
      </div>
    </main>;
  }
  if (!isAuthenticated) return null;

  const current = crumbs[pathname] ?? (pathname.startsWith('/dashboard/admin/enquiries/') ? 'Contact enquiry' : pathname.includes('/automations/') ? 'Automations' : 'Overview');
  const initial = user?.name?.[0]?.toUpperCase() || 'U';

  const SidebarInner = (
    <>
      <div>
        <div style={{ padding: '20px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 11 }}>
          <Link href="/dashboard" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <Image src="/heylaunch-icon.png" alt="" width={28} height={28} />
            <span style={{ fontWeight: 800, fontSize: 18.5, letterSpacing: '-.5px', color: 'var(--text)' }}>HeyLaunch</span>
          </Link>
          <button className="hl-close" onClick={() => setDrawer(false)} aria-label="Close menu"
            style={{ display: 'none', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}>
            <X style={{ width: 20, height: 20 }} />
          </button>
        </div>
        <nav style={{ padding: '6px 12px', display: 'grid', gap: 3 }} aria-label="Primary">
          {nav.filter((item) => (!item.adminOnly || user?.role === 'SUPER_ADMIN' ||
              (user?.role === 'ADMIN' && (!item.permission || user.adminPermissions?.includes(item.permission)))) &&
            (!item.superAdminOnly || user?.role === 'SUPER_ADMIN')).map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} className="rl-nav" aria-current={active ? 'page' : undefined}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 13px', borderRadius: 10, fontSize: 14.5, fontWeight: active ? 600 : 500, textDecoration: 'none',
                  color: active ? 'var(--text)' : 'var(--text-muted)', background: active ? 'var(--nav-selected)' : 'transparent' }}>
                <Icon style={{ width: 18, height: 18 }} aria-hidden /> {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
      <div style={{ padding: '14px 12px 18px', borderTop: '1px solid var(--border-soft)', display: 'grid', gap: 2 }}>
        <Link href="/dashboard/help" className="rl-nav" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 13px', borderRadius: 10, fontSize: 13.5, fontWeight: 500, color: 'var(--text-muted)', textDecoration: 'none' }}>
          <HelpCircle style={{ width: 17, height: 17 }} aria-hidden /> Help Center
        </Link>
        <button onClick={logout} className="rl-nav" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 13px', borderRadius: 10, fontSize: 13.5, fontWeight: 500, color: 'var(--error)', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%' }}>
          <LogOut style={{ width: 17, height: 17 }} aria-hidden /> Log out
        </button>
      </div>
    </>
  );

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--bg)', color: 'var(--text)', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <RLStyles />
      <ShellStyles />

      {/* Mobile drawer backdrop */}
      {drawer && <div className="hl-backdrop" onClick={() => setDrawer(false)} aria-hidden />}

      {/* Sidebar */}
      <aside className={`hl-sidebar${drawer ? ' hl-open' : ''}`}>{SidebarInner}</aside>

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', minWidth: 0 }}>
        <header className="hl-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <button className="hl-hamburger" onClick={() => setDrawer(true)} aria-label="Open menu" aria-expanded={drawer} aria-controls="hl-sidebar"
              style={{ display: 'none', background: 'transparent', border: 'none', color: 'var(--text)', cursor: 'pointer', padding: 4 }}>
              <Menu style={{ width: 22, height: 22 }} />
            </button>
            <div style={{ fontSize: 14, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
              <span className="hl-crumb-prefix" style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                Dashboard <ChevronRight style={{ width: 14, height: 14, color: 'var(--text-faint)' }} aria-hidden />
              </span>
              <span style={{ color: 'var(--text)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{current}</span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="hl-hide-sm"><ThemeToggle /></div>
            <Link href="/dashboard/billing" className="rl-b" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 34, background: 'var(--lime)', color: 'var(--on-lime)', padding: '0 15px', borderRadius: 999, fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
              <Sparkles style={{ width: 14, height: 14 }} aria-hidden /> <span className="hl-hide-xs">Upgrade</span>
            </Link>
            <NotificationBell />
            <div style={{ position: 'relative' }}>
              <button onClick={() => setMenu((m) => !m)} aria-haspopup="menu" aria-expanded={menu} aria-label="Account menu"
                style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--nav-selected)', color: 'var(--text)', fontSize: 14, fontWeight: 700, border: '1px solid var(--border)', cursor: 'pointer' }}>{initial}</button>
              {menu && (
                <>
                  <div onClick={() => setMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
                  <div role="menu" style={{ position: 'absolute', right: 0, top: 44, width: 220, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, boxShadow: 'var(--shadow-lg)', padding: 8, zIndex: 50 }}>
                    <div style={{ padding: '8px 12px 10px', borderBottom: '1px solid var(--border-soft)', marginBottom: 6 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{user?.name || 'Account'}</div>
                      <div style={{ fontSize: 12.5, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.email}</div>
                    </div>
                    <div className="hl-show-sm" style={{ display: 'none', padding: '6px 12px 8px' }}><ThemeToggle /></div>
                    <Link href="/dashboard/settings" onClick={() => setMenu(false)} style={{ display: 'block', padding: '9px 12px', borderRadius: 9, fontSize: 14, color: 'var(--text)', textDecoration: 'none' }} className="rl-nav">Settings</Link>
                    <Link href="/dashboard/billing" onClick={() => setMenu(false)} style={{ display: 'block', padding: '9px 12px', borderRadius: 9, fontSize: 14, color: 'var(--text)', textDecoration: 'none' }} className="rl-nav">Billing</Link>
                    <button onClick={() => { setMenu(false); logout(); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 12px', borderRadius: 9, fontSize: 14, color: 'var(--error)', background: 'none', border: 'none', cursor: 'pointer' }} className="rl-nav">Log out</button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>
        <TrialBanner />
        <main className="hl-main">{children}</main>
      </div>
    </div>
  );
}

// Shell-specific responsive + interaction styles (media queries need a stylesheet).
function ShellStyles() {
  return (
    <style>{`
      .hl-sidebar{width:248px;background:var(--surface);border-right:1px solid var(--border);display:flex;flex-direction:column;justify-content:space-between;flex-shrink:0}
      .hl-topbar{height:62px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;gap:12px;padding:0 24px;background:var(--surface);flex-shrink:0}
      .hl-main{flex:1;overflow-y:auto;padding:32px 36px;max-width:1280px;width:100%;margin:0 auto}
      .rl-nav:hover{background:var(--nav-hover)}
      @media (max-width:900px){
        .hl-sidebar{position:fixed;top:0;left:0;height:100%;z-index:60;transform:translateX(-100%);transition:transform .22s ease;box-shadow:var(--shadow-lg)}
        .hl-sidebar.hl-open{transform:translateX(0)}
        .hl-backdrop{position:fixed;inset:0;background:var(--overlay);z-index:55}
        .hl-hamburger{display:grid !important}
        .hl-close{display:block !important}
        .hl-crumb-prefix{display:none !important}
        .hl-main{padding:22px 18px}
        .hl-topbar{padding:0 16px}
      }
      @media (max-width:560px){
        .hl-hide-sm{display:none !important}
        .hl-show-sm{display:block !important}
      }
      @media (max-width:380px){
        .hl-hide-xs{display:none !important}
      }
    `}</style>
  );
}
