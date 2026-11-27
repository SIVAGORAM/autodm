'use client';
// app/providers.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { useEffect, useState } from 'react';

function PrewarmKeepAlive() {
  useEffect(() => {
    // Only pre-warm in production; in local dev, avoid proxy error spam if backend isn't started yet
    if (process.env.NODE_ENV !== 'production') return;

    // 1. Immediately ping the backend to pre-warm container and database pool
    const warm = () => {
      fetch('/api/version', { cache: 'no-store' }).catch(() => {});
    };
    warm();

    // 2. Keep backend warm every 4 minutes while browser tab is active
    const interval = setInterval(warm, 4 * 60 * 1000);

    // 3. Pre-warm when user switches back to the tab
    const onFocus = () => warm();
    window.addEventListener('focus', onFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() =>
    new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 15 * 1000,
          refetchOnWindowFocus: true,
          refetchOnReconnect: true,
          retry: (failureCount, error: any) => {
            if (error?.response?.status === 401) return false;
            return failureCount < 2;
          },
        },
      },
    })
  );

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>
        <PrewarmKeepAlive />
        {children}
      </QueryClientProvider>
    </ThemeProvider>
  );
}
