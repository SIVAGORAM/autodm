'use client';

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          background: '#FAFAFA',
          color: '#17171B',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          padding: 20,
        }}
      >
        <div
          style={{
            maxWidth: 440,
            width: '100%',
            padding: '36px 28px',
            textAlign: 'center',
            background: '#FFFFFF',
            borderRadius: 20,
            border: '1px solid #E5E7EB',
            boxShadow: '0 8px 30px rgba(0,0,0,0.06)',
          }}
        >
          <div
            style={{
              width: 50,
              height: 50,
              borderRadius: 14,
              background: '#FBEAEA',
              color: '#C81E1E',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 24,
              marginBottom: 16,
              fontWeight: 700,
            }}
          >
            !
          </div>

          <h2
            style={{
              fontSize: 22,
              fontWeight: 800,
              margin: '0 0 10px',
              letterSpacing: '-0.5px',
              color: '#17171B',
            }}
          >
            Application Error
          </h2>

          <p
            style={{
              fontSize: 14,
              color: '#667085',
              margin: '0 0 24px',
              lineHeight: 1.6,
            }}
          >
            An unexpected error occurred. Please refresh or try again.
          </p>

          <button
            onClick={() => reset()}
            style={{
              background: '#17171B',
              color: '#FFFFFF',
              border: 0,
              padding: '12px 24px',
              borderRadius: 12,
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
            }}
          >
            Reload application
          </button>
        </div>
      </body>
    </html>
  );
}
