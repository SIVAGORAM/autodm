'use client';

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{
        margin: 0,
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        background: '#fbfcfc',
        color: '#152024',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
      }}>
        <div style={{
          maxWidth: 440,
          padding: 32,
          textAlign: 'center',
          background: '#ffffff',
          borderRadius: 16,
          border: '1px solid #e2eaed',
          boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
        }}>
          <h2 style={{ fontSize: 20, margin: '0 0 10px' }}>Application Error</h2>
          <p style={{ fontSize: 14, color: '#5E707A', margin: '0 0 20px' }}>
            An unexpected error occurred. Please refresh or try again.
          </p>
          <button
            onClick={() => reset()}
            style={{
              background: '#17827E',
              color: '#ffffff',
              border: 0,
              padding: '10px 20px',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
