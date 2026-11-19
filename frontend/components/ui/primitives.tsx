'use client';

import * as React from 'react';
import { cn } from '../../lib/cn';
import { Loader2, Lock, Check } from 'lucide-react';

// ─── Button ───────────────────────────────────────────────────
type Variant = 'primary' | 'accent' | 'secondary' | 'ghost' | 'danger' | 'locked';
const variants: Record<Variant, string> = {
  primary: 'bg-primary text-primary-foreground hover:opacity-90',
  accent: 'bg-accent text-accent-foreground hover:opacity-90',
  secondary: 'bg-secondary text-secondary-foreground hover:bg-muted',
  ghost: 'bg-transparent text-foreground hover:bg-muted',
  danger: 'bg-destructive text-destructive-foreground hover:opacity-90',
  locked: 'bg-muted text-muted-foreground cursor-not-allowed',
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  loading?: boolean;
}
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', loading, disabled, children, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading || variant === 'locked'}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-md px-4 h-10 text-sm font-semibold',
        'transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        'disabled:opacity-60 disabled:pointer-events-none',
        variants[variant],
        className,
      )}
      {...props}
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin" aria-hidden />}
      {variant === 'locked' && <Lock className="w-3.5 h-3.5" aria-hidden />}
      {children}
    </button>
  ),
);
Button.displayName = 'Button';

// ─── Card ─────────────────────────────────────────────────────
export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-xl border border-border bg-card text-card-foreground', className)} {...props} />;
}

// ─── Badge / status pill ──────────────────────────────────────
type Tone = 'primary' | 'success' | 'warning' | 'muted' | 'danger';
const tones: Record<Tone, string> = {
  primary: 'bg-primary/10 text-primary border-primary/20',
  success: 'bg-success/10 text-success border-success/20',
  warning: 'bg-warning/10 text-warning border-warning/20',
  muted: 'bg-muted text-muted-foreground border-border',
  danger: 'bg-destructive/10 text-destructive border-destructive/20',
};
export function Badge({ tone = 'muted', className, ...props }: { tone?: Tone } & React.HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn('inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium', tones[tone], className)} {...props} />;
}

// ─── Toggle ───────────────────────────────────────────────────
export function Toggle({ checked, onChange, disabled, label, locked }: {
  checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; label?: string; locked?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled || locked}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        checked ? 'bg-primary' : 'bg-muted',
        (disabled || locked) && 'opacity-60 cursor-not-allowed',
      )}
    >
      {locked && <Lock className="absolute left-1 w-3 h-3 text-muted-foreground" aria-hidden />}
      <span className={cn('inline-block h-4 w-4 transform rounded-full bg-background transition-transform', checked ? 'translate-x-6' : 'translate-x-1')} />
    </button>
  );
}

// ─── Stepper ──────────────────────────────────────────────────
export function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="flex items-center gap-2" aria-label="Progress">
      {steps.map((label, i) => {
        const done = i < current, active = i === current;
        return (
          <li key={label} className="flex items-center gap-2">
            <span className={cn(
              'flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold',
              done ? 'bg-primary text-primary-foreground' : active ? 'bg-primary/15 text-primary ring-2 ring-primary' : 'bg-muted text-muted-foreground',
            )}>
              {done ? <Check className="w-4 h-4" aria-hidden /> : i + 1}
            </span>
            <span className={cn('text-xs font-medium hidden sm:inline', active ? 'text-foreground' : 'text-muted-foreground')}>{label}</span>
            {i < steps.length - 1 && <span className="mx-1 h-px w-6 bg-border" aria-hidden />}
          </li>
        );
      })}
    </ol>
  );
}

// ─── Keyword tag input ────────────────────────────────────────
export function TagInput({ tags, onChange, max, placeholder }: {
  tags: string[]; onChange: (t: string[]) => void; max?: number; placeholder?: string;
}) {
  const [val, setVal] = React.useState('');
  const atCap = max !== undefined && tags.length >= max;
  const add = () => {
    const t = val.trim();
    if (t && !tags.includes(t) && !atCap) { onChange([...tags, t]); setVal(''); }
  };
  return (
    <div>
      <div className="flex flex-wrap gap-2 rounded-md border border-input bg-background p-2 focus-within:ring-2 focus-within:ring-ring">
        {tags.map((t) => (
          <span key={t} className="inline-flex items-center gap-1 rounded bg-primary/10 px-2 py-0.5 text-sm text-primary">
            {t}
            <button type="button" aria-label={`Remove ${t}`} onClick={() => onChange(tags.filter((x) => x !== t))} className="hover:text-foreground">×</button>
          </span>
        ))}
        {!atCap && (
          <input
            value={val}
            onChange={(e) => setVal(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(); } }}
            onBlur={add}
            placeholder={placeholder ?? 'Type a keyword, press Enter'}
            className="flex-1 min-w-[8rem] bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        )}
      </div>
      {atCap && <p className="mt-1 text-xs text-muted-foreground">Keyword limit reached on your plan.</p>}
    </div>
  );
}

// ─── Input / Textarea / Label ─────────────────────────────────
export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input ref={ref} className={cn('flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', className)} {...props} />
  ),
);
Input.displayName = 'Input';

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea ref={ref} className={cn('flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', className)} {...props} />
  ),
);
Textarea.displayName = 'Textarea';

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn('text-sm font-medium text-foreground', className)} {...props} />;
}

// ─── Skeleton ─────────────────────────────────────────────────
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-muted', className)} aria-hidden />;
}

// ─── Stat tile ────────────────────────────────────────────────
export function StatTile({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Card className="p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-3xl font-semibold tabular-nums">{value}</p>
    </Card>
  );
}
