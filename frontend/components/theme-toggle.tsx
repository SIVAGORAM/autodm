'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';

// Segmented Light / Dark / System control. Theme-aware via CSS tokens.
// Guards against hydration mismatch by only reflecting the active theme
// after mount (next-themes requirement).
const OPTIONS = [
  { key: 'light', icon: Sun, label: 'Light' },
  { key: 'dark', icon: Moon, label: 'Dark' },
  { key: 'system', icon: Monitor, label: 'System' },
] as const;

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const active = mounted ? theme : undefined;

  return (
    <div
      role="group"
      aria-label="Theme"
      style={{
        display: 'inline-flex',
        gap: 2,
        padding: 3,
        borderRadius: 999,
        border: '1px solid var(--border)',
        background: 'var(--surface)',
      }}
    >
      {OPTIONS.map((o) => {
        const Icon = o.icon;
        const on = active === o.key;
        return (
          <button
            key={o.key}
            type="button"
            onClick={() => setTheme(o.key)}
            aria-pressed={on}
            aria-label={o.label}
            title={o.label}
            style={{
              display: 'grid',
              placeItems: 'center',
              width: 30,
              height: 28,
              borderRadius: 999,
              border: 'none',
              cursor: 'pointer',
              background: on ? 'var(--nav-selected)' : 'transparent',
              color: on ? 'var(--text)' : 'var(--text-muted)',
            }}
          >
            <Icon style={{ width: 15, height: 15 }} aria-hidden />
          </button>
        );
      })}
    </div>
  );
}
