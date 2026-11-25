'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw, LayoutDashboard } from 'lucide-react';
import { Card, Btn } from '../../components/rl-kit';

export default function DashboardErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Dashboard error:', error?.message);
  }, [error]);

  return (
    <div style={{ padding: '40px 20px', maxWidth: 520, margin: '0 auto', textAlign: 'center' }}>
      <Card style={{ padding: '36px 24px' }}>
        <div style={{
          width: 48,
          height: 48,
          borderRadius: 12,
          background: 'var(--amber-soft, #fef3e6)',
          color: 'var(--warning, #b46b0a)',
          display: 'grid',
          placeItems: 'center',
          margin: '0 auto 16px',
        }}>
          <AlertTriangle size={24} />
        </div>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 8px', color: 'var(--text)' }}>
          Could not load this page
        </h2>
        <p style={{
          fontSize: 13.5,
          color: 'var(--text-muted)',
          lineHeight: 1.55,
          margin: '0 auto 24px',
          maxWidth: 380,
        }}>
          {error?.message && !error.message.includes('fetch')
            ? error.message
            : 'The service is taking longer than usual to respond. Try refreshing or return to your overview.'}
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <Btn variant="primary" onClick={() => reset()}>
            <RefreshCw size={15} /> Try again
          </Btn>
          <Btn variant="ghost" href="/dashboard">
            <LayoutDashboard size={15} /> Overview
          </Btn>
        </div>
      </Card>
    </div>
  );
}
