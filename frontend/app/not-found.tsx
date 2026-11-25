import Link from 'next/link';
import Image from 'next/image';
import { Home, LayoutDashboard } from 'lucide-react';

export default function NotFound() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 20px',
        background: 'var(--bg, #FAFAFA)',
        color: 'var(--text, #17171B)',
        fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      <div
        style={{
          maxWidth: 480,
          width: '100%',
          textAlign: 'center',
          background: 'var(--surface, #FFFFFF)',
          border: '1px solid var(--border, #E5E7EB)',
          borderRadius: 20,
          padding: '44px 32px',
          boxShadow: '0 8px 30px rgba(0, 0, 0, 0.04), 0 1px 3px rgba(0, 0, 0, 0.02)',
        }}
      >
        {/* Brand Header */}
        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 28 }}>
          <Image
            src="/heylaunch-logo.png"
            alt="HeyLaunch"
            width={140}
            height={28}
            style={{ height: 'auto', width: 'auto', maxWidth: 160 }}
            priority
          />
        </div>

        {/* 404 Visual Pill */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 14px',
            borderRadius: 999,
            background: 'var(--nav-selected, #F3F4F6)',
            border: '1px solid var(--border, #E5E7EB)',
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--text-muted, #667085)',
            marginBottom: 20,
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: '#B9F500',
              boxShadow: '0 0 8px rgba(185, 245, 0, 0.6)',
              display: 'inline-block',
            }}
          />
          Error 404 &bull; Not Found
        </div>

        {/* Large Typography */}
        <h1
          style={{
            fontSize: 32,
            fontWeight: 800,
            letterSpacing: '-0.8px',
            margin: '0 0 10px',
            color: 'var(--text, #17171B)',
            lineHeight: 1.2,
          }}
        >
          Page not found
        </h1>

        <p
          style={{
            color: 'var(--text-muted, #667085)',
            fontSize: 15,
            lineHeight: 1.6,
            margin: '0 auto 32px',
            maxWidth: 380,
          }}
        >
          The page or creator profile you are looking for doesn’t exist, has been unpublished, or the link might be misspelled.
        </p>

        {/* Action Buttons */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            justifyContent: 'center',
          }}
        >
          <Link
            href="/dashboard"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              background: 'var(--btn-primary, #17171B)',
              color: 'var(--btn-primary-text, #FFFFFF)',
              padding: '13px 22px',
              borderRadius: 12,
              fontWeight: 600,
              fontSize: 14,
              textDecoration: 'none',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
              transition: 'transform 0.15s ease, opacity 0.15s ease',
            }}
          >
            <LayoutDashboard size={16} />
            Go to dashboard
          </Link>

          <Link
            href="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              background: 'transparent',
              color: 'var(--text, #17171B)',
              border: '1px solid var(--border, #E5E7EB)',
              padding: '12px 22px',
              borderRadius: 12,
              fontWeight: 600,
              fontSize: 14,
              textDecoration: 'none',
              transition: 'background 0.15s ease',
            }}
          >
            <Home size={16} />
            Back to homepage
          </Link>
        </div>

        {/* Footer Note */}
        <div
          style={{
            marginTop: 32,
            paddingTop: 20,
            borderTop: '1px solid var(--border-soft, #F0F1F3)',
            fontSize: 12.5,
            color: 'var(--text-faint, #6B7280)',
          }}
        >
          Powered by <strong style={{ color: 'var(--text, #17171B)' }}>Hey Launch</strong> &bull; Instagram Automation & Bio Pages
        </div>
      </div>
    </div>
  );
}
