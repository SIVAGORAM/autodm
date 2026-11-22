'use client';
import React from 'react';

// ─── HeyLaunch design tokens ────────────────────────────────────────────────
// Every value points at a CSS variable defined in globals.css (:root + .dark),
// so the whole system re-themes with the light/dark/system engine. No hardcoded
// colors live here anymore. Premium neutral surfaces + a signature lime accent.
export const RL = {
  bg: 'var(--bg)', surface: 'var(--surface)', soft: 'var(--card-hover)', softer: 'var(--nav-selected)',
  line: 'var(--border)', lineSoft: 'var(--border-soft)',
  ink: 'var(--text)', ink2: 'var(--text)', muted: 'var(--text-muted)', faint: 'var(--text-faint)',
  // "teal"/"coral" names are kept for API compatibility with existing pages, but
  // now resolve to neutral primary + selected surfaces. Lime is introduced
  // deliberately (Btn `accent`, Pill `lime`), never as a blanket swap.
  teal: 'var(--btn-primary)', tealD: 'var(--btn-primary-hover)', tealSoft: 'var(--nav-selected)',
  coral: 'var(--btn-primary)', coralSoft: 'var(--nav-selected)',
  green: 'var(--success)', greenSoft: 'var(--success-soft)',
  amber: 'var(--warning)', amberSoft: 'var(--warning-soft)',
  red: 'var(--error)', redSoft: 'var(--error-soft)',
  // new, explicit brand tokens for deliberate use
  lime: 'var(--lime)', onLime: 'var(--on-lime)', violet: 'var(--violet)',
};

// ─── Card ───────────────────────────────────────────────────────────────────
export function Card({ children, style, pad = 20, hover, onClick, className }: {
    children: React.ReactNode; style?: React.CSSProperties; pad?: number; hover?: boolean; onClick?: () => void; className?: string;
}) {
  return (
      <div onClick={onClick} className={[hover || onClick ? 'rl-card' : '', className].filter(Boolean).join(' ') || undefined}
      style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', padding: pad, boxShadow: 'var(--shadow-sm)', cursor: onClick ? 'pointer' : undefined, ...style }}>
      {children}
    </div>
  );
}

// ─── Page header ─────────────────────────────────────────────────────────────
export function PageHead({ title, sub, action }: { title: string; sub?: string; action?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 28, flexWrap: 'wrap' }}>
      <div>
        <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-.8px', color: 'var(--text)', margin: 0 }}>{title}</h1>
        {sub && <p style={{ color: 'var(--text-muted)', fontSize: 14.5, marginTop: 6, maxWidth: 560, lineHeight: 1.55 }}>{sub}</p>}
      </div>
      {action}
    </div>
  );
}

// ─── Button ──────────────────────────────────────────────────────────────────
type BtnVariant = 'primary' | 'accent' | 'ghost' | 'danger' | 'dark';
export function Btn({ children, variant = 'primary', onClick, href, type, disabled, loading, style, full }: {
  children: React.ReactNode; variant?: BtnVariant; onClick?: () => void; href?: string;
  type?: 'button' | 'submit'; disabled?: boolean; loading?: boolean; style?: React.CSSProperties; full?: boolean;
}) {
  const v: Record<BtnVariant, React.CSSProperties> = {
    // neutral primary — black in light, white in dark
    primary: { background: 'var(--btn-primary)', color: 'var(--btn-primary-text)', border: '1px solid var(--btn-primary)' },
    dark: { background: 'var(--btn-primary)', color: 'var(--btn-primary-text)', border: '1px solid var(--btn-primary)' },
    // signature lime — reserved for high-priority / growth actions; dark text for contrast
    accent: { background: 'var(--lime)', color: 'var(--on-lime)', border: '1px solid var(--lime)' },
    // secondary / outline
    ghost: { background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)' },
    // destructive — accessible soft treatment
    danger: { background: 'var(--error-soft)', color: 'var(--error)', border: '1px solid var(--error-soft)' },
  };
  const isOff = disabled || loading;
  const base: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 40, padding: '0 18px', borderRadius: 10, fontWeight: 600, fontSize: 14, textDecoration: 'none',
    cursor: isOff ? 'not-allowed' : 'pointer', opacity: isOff ? 0.55 : 1, width: full ? '100%' : undefined,
    whiteSpace: 'nowrap', ...v[variant], ...style,
  };
  const inner = <>{loading && <span className="rl-spin" style={{ width: 15, height: 15, borderRadius: '50%', border: '2px solid currentColor', borderTopColor: 'transparent', opacity: 0.9 }} aria-hidden />}{children}</>;
  if (href && !isOff) return <a href={href} className="rl-b" style={base}>{inner}</a>;
  return <button type={type ?? 'button'} onClick={onClick} disabled={isOff} aria-busy={loading || undefined} className="rl-b" style={base}>{inner}</button>;
}

// ─── Pill / badge ─────────────────────────────────────────────────────────────
type Tone = 'teal' | 'green' | 'coral' | 'amber' | 'red' | 'muted' | 'lime' | 'violet';
export function Pill({ children, tone = 'muted', dot }: { children: React.ReactNode; tone?: Tone; dot?: boolean }) {
  const map: Record<Tone, [string, string]> = {
    // neutral (teal/coral kept for API compat)
    teal: ['var(--nav-selected)', 'var(--text)'], coral: ['var(--nav-selected)', 'var(--text)'], muted: ['var(--nav-selected)', 'var(--text-muted)'],
    // semantic
    green: ['var(--success-soft)', 'var(--success)'], amber: ['var(--warning-soft)', 'var(--warning)'], red: ['var(--error-soft)', 'var(--error)'],
    // deliberate brand accents
    lime: ['var(--lime)', 'var(--on-lime)'], violet: ['var(--info-soft)', 'var(--violet)'],
  };
  const [bg, fg] = map[tone];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: bg, color: fg, fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 999, whiteSpace: 'nowrap', lineHeight: 1.5 }}>
      {dot && <span style={{ width: 6, height: 6, borderRadius: '50%', background: fg }} />}{children}
    </span>
  );
}

// ─── Input (new, reusable) ─────────────────────────────────────────────────────
export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ style, ...props }, ref) {
    return (
      <input ref={ref} className="rl-input" style={{
        height: 40, width: '100%', padding: '0 13px', borderRadius: 10, fontSize: 14,
        background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)', outline: 'none', ...style,
      }} {...props} />
    );
  }
);

// ─── Stat tile ─────────────────────────────────────────────────────────────────
export function Stat({ label, value, delta, icon }: { label: string; value: React.ReactNode; delta?: string; icon?: React.ReactNode }) {
  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-muted)' }}>{label}</span>
        {icon && <span style={{ color: 'var(--text-faint)' }}>{icon}</span>}
      </div>
      <div style={{ fontSize: 29, fontWeight: 700, letterSpacing: '-1px', color: 'var(--text)', marginTop: 10 }}>{value}</div>
      {delta && <div style={{ fontSize: 12.5, color: 'var(--success)', marginTop: 4, fontWeight: 500 }}>{delta}</div>}
    </Card>
  );
}

// ─── Empty state ────────────────────────────────────────────────────────────────
export function Empty({ icon, title, sub, action }: { icon?: React.ReactNode; title: string; sub?: string; action?: React.ReactNode }) {
  return (
    <Card pad={48} style={{ textAlign: 'center' }}>
      {icon && <div style={{ width: 52, height: 52, borderRadius: 14, background: 'var(--nav-selected)', color: 'var(--text)', display: 'grid', placeItems: 'center', margin: '0 auto 18px' }}>{icon}</div>}
      <h3 style={{ fontSize: 19, fontWeight: 700, color: 'var(--text)', margin: 0, letterSpacing: '-.4px' }}>{title}</h3>
      {sub && <p style={{ color: 'var(--text-muted)', fontSize: 14.5, margin: '10px auto 0', maxWidth: 380, lineHeight: 1.6 }}>{sub}</p>}
      {action && <div style={{ marginTop: 22, display: 'flex', justifyContent: 'center' }}>{action}</div>}
    </Card>
  );
}

// ─── Spinner ───────────────────────────────────────────────────────────────────
export function Spinner({ size = 28 }: { size?: number }) {
  return <div className="rl-spin" style={{ width: size, height: size, borderRadius: '50%', border: '3px solid var(--border)', borderTopColor: 'var(--text)' }} />;
}

// ─── Skeleton ──────────────────────────────────────────────────────────────────
export function Skel({ h = 72, w = '100%', r = 12 }: { h?: number; w?: number | string; r?: number }) {
  return <div className="rl-sk" style={{ height: h, width: w, borderRadius: r, background: 'var(--card-hover)' }} />;
}

// ─── shared keyframes / interaction styles ──────────────────────────────────────
export function RLStyles() {
  return (
    <style>{`
      @keyframes rlspin{to{transform:rotate(360deg)}}
      .rl-spin{animation:rlspin .7s linear infinite}
      @keyframes rlpulse{0%,100%{opacity:.45}50%{opacity:1}}
      .rl-live{animation:rlpulse 2.2s ease-in-out infinite}
      @keyframes rlsk{0%{opacity:.6}50%{opacity:1}100%{opacity:.6}}
      .rl-sk{animation:rlsk 1.3s ease-in-out infinite}
      .rl-b{transition:filter .14s ease, transform .14s ease, box-shadow .14s ease}
      .rl-b:hover{filter:brightness(1.08);transform:translateY(-1px)}
      .rl-b:active{transform:translateY(0)}
      .rl-b:focus-visible{outline:2px solid var(--violet);outline-offset:2px}
      .rl-card{transition:transform .18s ease, box-shadow .18s ease, border-color .18s ease}
      .rl-card:hover{transform:translateY(-2px);box-shadow:var(--shadow-md);border-color:var(--text-faint)}
      .rl-nav{transition:background .14s, color .14s}
      .rl-nav:focus-visible,.rl-l:focus-visible{outline:2px solid var(--violet);outline-offset:2px;border-radius:8px}
      .rl-input{transition:border-color .14s, box-shadow .14s}
      .rl-input:focus-visible{border-color:var(--violet);box-shadow:0 0 0 3px color-mix(in srgb, var(--violet) 18%, transparent)}
      input::placeholder,textarea::placeholder{color:var(--text-faint)}
    `}</style>
  );
}
