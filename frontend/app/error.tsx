'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { AlertCircle, RotateCcw, LayoutDashboard } from 'lucide-react';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log safe error metadata in development
    console.error('Unhandled app error:', error?.message);
  }, [error]);

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 20px',
        background: 'var(--bg, #FAFAFA)',
        fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        color: 'var(--text, #17171B)',
      }}
    >
      <div
        style={{
          maxWidth: 460,
          width: '100%',
          background: 'var(--surface, #FFFFFF)',
          border: '1px solid var(--border, #E5E7EB)',
          borderRadius: 20,
          padding: '40px 32px',
          textAlign: 'center',
          boxShadow: '0 8px 30px rgba(0, 0, 0, 0.04), 0 1px 3px rgba(0, 0, 0, 0.02)',
        }}
      >
        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
          <Image
            src="/heylaunch-logo.png"
            alt="HeyLaunch"
            width={130}
            height={26}
            style={{ height: 'auto', width: 'auto' }}
            priority
          />
        </div>

        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: 14,
            background: 'var(--error-soft, #FBEAEA)',
            color: 'var(--error, #C81E1E)',
            display: 'grid',
            placeItems: 'center',
            margin: '0 auto 18px',
          }}
        >
          <AlertCircle size={26} />
        </div>

        <h1
          style={{
            fontSize: 22,
            fontWeight: 800,
            margin: '0 0 10px',
            letterSpacing: '-0.5px',
            color: 'var(--text, #17171B)',
          }}
        >
          Something went wrong
        </h1>

        <p
          style={{
            fontSize: 14,
            color: 'var(--text-muted, #667085)',
            lineHeight: 1.6,
            margin: '0 auto 28px',
            maxWidth: 380,
          }}
        >
          {error?.message && !error.message.includes('fetch')
            ? error.message
            : 'A momentary connection glitch occurred. Click try again to reload or return to dashboard.'}
        </p>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button
            onClick={() => reset()}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              background: 'var(--btn-primary, #17171B)',
              color: 'var(--btn-primary-text, #FFFFFF)',
              border: 0,
              padding: '12px 20px',
              borderRadius: 12,
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
              transition: 'opacity 0.15s ease',
            }}
          >
            <RotateCcw size={15} /> Try again
          </button>

          <Link
            href="/dashboard"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              background: 'transparent',
              color: 'var(--text, #17171B)',
              border: '1px solid var(--border, #E5E7EB)',
              padding: '12px 20px',
              borderRadius: 12,
              fontSize: 14,
              fontWeight: 600,
              textDecoration: 'none',
              transition: 'background 0.15s ease',
            }}
          >
            <LayoutDashboard size={15} /> Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
