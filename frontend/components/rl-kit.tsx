'use client';
import React from 'react';

// ─── Relayo design tokens (matches marketing site + auth) ───────────────
export const RL = {
  bg: '#F5F9F8', surface: '#ffffff', soft: '#F5F9F8', softer: '#ECF3F1',
  line: '#E4ECEA', lineSoft: '#EEF3F2',
  ink: '#0C1D1A', ink2: '#15302B', muted: '#5C7872', faint: '#8AA39D',
  teal: '#12807A', tealD: '#0C5F5A', tealSoft: '#E1F1EF',
  coral: '#F15F2C', coralSoft: '#FDECE4',
  green: '#16936A', greenSoft: '#E7F5EE', amber: '#C9820C', amberSoft: '#FBF2DE',
  red: '#DB4A3D', redSoft: '#FBEAE8',
};

// ─── Card ───────────────────────────────────────────────────────────────
export function Card({ children, style, pad = 20, hover, onClick }: {
  children: React.ReactNode; style?: React.CSSProperties; pad?: number; hover?: boolean; onClick?: () => void;
}) {
  return (
    <div onClick={onClick} className={hover ? 'rl-card' : undefined}
      style={{ background: RL.surface, border: `1px solid ${RL.line}`, borderRadius: 16, padding: pad, boxShadow: '0 1px 3px rgba(12,29,26,.04)', cursor: onClick ? 'pointer' : undefined, ...style }}>
      {children}
    </div>
  );
}

// ─── Page header ──────────────────────────────────────────────────────────
export function PageHead({ title, sub, action }: { title: string; sub?: string; action?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 28, flexWrap: 'wrap' }}>
      <div>
        <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-1px', color: RL.ink, margin: 0 }}>{title}</h1>
        {sub && <p style={{ color: RL.muted, fontSize: 15, marginTop: 6, maxWidth: 560, lineHeight: 1.55 }}>{sub}</p>}
      </div>
      {action}
    </div>
  );
}

// ─── Button ───────────────────────────────────────────────────────────────
type BtnVariant = 'primary' | 'accent' | 'ghost' | 'danger' | 'dark';
export function Btn({ children, variant = 'primary', onClick, href, type, disabled, style, full }: {
  children: React.ReactNode; variant?: BtnVariant; onClick?: () => void; href?: string;
  type?: 'button' | 'submit'; disabled?: boolean; style?: React.CSSProperties; full?: boolean;
}) {
  const v: Record<BtnVariant, React.CSSProperties> = {
    primary: { background: RL.teal, color: '#fff', border: `1px solid ${RL.teal}` },
    accent: { background: RL.coral, color: '#fff', border: `1px solid ${RL.coral}`, boxShadow: '0 10px 22px -12px rgba(241,95,44,.55)' },
    dark: { background: RL.ink, color: '#fff', border: `1px solid ${RL.ink}` },
    ghost: { background: '#fff', color: RL.ink, border: `1px solid ${RL.line}` },
    danger: { background: RL.redSoft, color: RL.red, border: `1px solid ${RL.redSoft}` },
  };
  const base: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    padding: '11px 18px', borderRadius: 11, fontWeight: 600, fontSize: 14.5, textDecoration: 'none',
    cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.55 : 1, width: full ? '100%' : undefined,
    whiteSpace: 'nowrap', ...v[variant], ...style,
  };
  if (href) return <a href={href} className="rl-b" style={base}>{children}</a>;
  return <button type={type ?? 'button'} onClick={onClick} disabled={disabled} className="rl-b" style={base}>{children}</button>;
}

// ─── Pill / badge ───────────────────────────────────────────────────────────
type Tone = 'teal' | 'green' | 'coral' | 'amber' | 'red' | 'muted';
export function Pill({ children, tone = 'muted', dot }: { children: React.ReactNode; tone?: Tone; dot?: boolean }) {
  const map: Record<Tone, [string, string]> = {
    teal: [RL.tealSoft, RL.teal], green: [RL.greenSoft, RL.green], coral: [RL.coralSoft, RL.coral],
    amber: [RL.amberSoft, RL.amber], red: [RL.redSoft, RL.red], muted: ['#EEF2F1', RL.muted],
  };
  const [bg, fg] = map[tone];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: bg, color: fg, fontSize: 12.5, fontWeight: 600, padding: '4px 11px', borderRadius: 999, whiteSpace: 'nowrap' }}>
      {dot && <span style={{ width: 6, height: 6, borderRadius: '50%', background: fg }} />}{children}
    </span>
  );
}

// ─── Stat tile ────────────────────────────────────────────────────────────
export function Stat({ label, value, delta, icon }: { label: string; value: React.ReactNode; delta?: string; icon?: React.ReactNode }) {
  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: RL.muted }}>{label}</span>
        {icon && <span style={{ color: RL.faint }}>{icon}</span>}
      </div>
      <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-1px', color: RL.ink, marginTop: 10 }}>{value}</div>
      {delta && <div style={{ fontSize: 12.5, color: RL.green, marginTop: 4, fontWeight: 500 }}>{delta}</div>}
    </Card>
  );
}

// ─── Empty state ────────────────────────────────────────────────────────────
export function Empty({ icon, title, sub, action }: { icon?: React.ReactNode; title: string; sub?: string; action?: React.ReactNode }) {
  return (
    <Card pad={48} style={{ textAlign: 'center' }}>
      {icon && <div style={{ width: 52, height: 52, borderRadius: 15, background: RL.tealSoft, color: RL.teal, display: 'grid', placeItems: 'center', margin: '0 auto 18px' }}>{icon}</div>}
      <h3 style={{ fontSize: 20, fontWeight: 700, color: RL.ink, margin: 0, letterSpacing: '-.4px' }}>{title}</h3>
      {sub && <p style={{ color: RL.muted, fontSize: 14.5, margin: '10px auto 0', maxWidth: 380, lineHeight: 1.6 }}>{sub}</p>}
      {action && <div style={{ marginTop: 22, display: 'flex', justifyContent: 'center' }}>{action}</div>}
    </Card>
  );
}

// ─── Spinner ────────────────────────────────────────────────────────────────
export function Spinner({ size = 28 }: { size?: number }) {
  return <div className="rl-spin" style={{ width: size, height: size, borderRadius: '50%', border: `3px solid ${RL.tealSoft}`, borderTopColor: RL.teal }} />;
}

// ─── Skeleton ───────────────────────────────────────────────────────────────
export function Skel({ h = 72, w = '100%', r = 12 }: { h?: number; w?: number | string; r?: number }) {
  return <div className="rl-sk" style={{ height: h, width: w, borderRadius: r, background: RL.softer }} />;
}

// ─── shared keyframes/utility styles for the dashboard ──────────────────────
export function RLStyles() {
  return (
    <style>{`
      @keyframes rlspin{to{transform:rotate(360deg)}}
      .rl-spin{animation:rlspin .7s linear infinite}
      @keyframes rlpulse{0%,100%{opacity:.45}50%{opacity:1}}
      .rl-live{animation:rlpulse 2.2s ease-in-out infinite}
      @keyframes rlsk{0%{opacity:.55}50%{opacity:1}100%{opacity:.55}}
      .rl-sk{animation:rlsk 1.3s ease-in-out infinite}
      .rl-b{transition:filter .14s ease, transform .14s ease}
      .rl-b:hover{filter:brightness(1.05);transform:translateY(-1px)}
      .rl-card{transition:transform .18s ease, box-shadow .18s ease}
      .rl-card:hover{transform:translateY(-3px);box-shadow:0 18px 40px -22px rgba(12,29,26,.2)}
      .rl-nav{transition:background .14s, color .14s}
      input::placeholder,textarea::placeholder{color:${RL.faint}}
    `}</style>
  );
}
