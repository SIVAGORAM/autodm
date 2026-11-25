'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertCircle, RotateCcw, Home } from 'lucide-react';

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
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      background: 'var(--bg, #fbfcfc)',
      fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      color: 'var(--text, #152024)',
    }}>
      <div style={{
        maxWidth: 440,
        width: '100%',
        background: 'var(--surface, #ffffff)',
        border: '1px solid var(--border, #e2eaed)',
        borderRadius: 16,
        padding: '36px 28px',
        textAlign: 'center',
        boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
      }}>
        <div style={{
          width: 52,
          height: 52,
          borderRadius: 14,
          background: '#fde7e0',
          color: '#b4411f',
          display: 'grid',
          placeItems: 'center',
          margin: '0 auto 18px',
        }}>
          <AlertCircle size={28} />
        </div>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 8px', letterSpacing: '-0.4px' }}>
          Something went wrong
        </h1>
        <p style={{
          fontSize: 14,
          color: 'var(--text-muted, #5E707A)',
          lineHeight: 1.55,
          margin: '0 0 24px',
        }}>
          {error?.message && !error.message.includes('fetch')
            ? error.message
            : 'A momentary connection glitch occurred. Click try again to reload the page.'}
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button
            onClick={() => reset()}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              background: '#17827E',
              color: '#ffffff',
              border: 0,
              padding: '11px 20px',
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'opacity 0.15s ease',
            }}
          >
            <RotateCcw size={16} /> Try again
          </button>
          <Link
            href="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              background: 'transparent',
              color: 'var(--text, #152024)',
              border: '1px solid var(--border, #e2eaed)',
              padding: '11px 18px',
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            <Home size={16} /> Home
          </Link>
        </div>
      </div>
    </div>
  );
}
