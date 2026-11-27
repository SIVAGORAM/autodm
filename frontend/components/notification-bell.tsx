'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { automationApi, healthApi, instagramApi } from '../services/api';
import {
  Bell,
  CheckCircle2,
  AlertTriangle,
  Instagram,
  Send,
  X,
  ExternalLink,
  CheckCheck,
  ChevronRight,
  Clock,
  Sparkles,
} from 'lucide-react';

export type NotificationItem = {
  id: string;
  title: string;
  body: string;
  href: string;
  tone: 'coral' | 'amber' | 'green' | 'blue';
  iconType: 'instagram' | 'alert' | 'send' | 'check' | 'sparkles';
  createdAt: number; // timestamp ms
  isRead: boolean;
};

type Automation = {
  id: string;
  name: string;
  status: string;
  health?: { level: string; label: string; reason?: string };
  _count?: { runs: number };
};

type IgAccount = {
  id: string;
  username: string;
  isActive: boolean;
  tokenExpiresAt?: string;
  webhookSubscribedAt?: string | null;
  lastWebhookAt?: string | null;
};

type WorkerStatus = {
  status: 'ok' | 'stale' | 'unavailable';
  lastHeartbeatAt: string | null;
};

type Run = {
  id: string;
  status: string;
  error?: string | null;
  createdAt: string;
  sentAt?: string | null;
  username?: string | null;
};

function formatTimeAgo(timestamp: number): string {
  const diffSec = Math.floor((Date.now() - timestamp) / 1000);
  if (diffSec < 45) return 'Just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  const diffDays = Math.floor(diffSec / 86400);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'unread'>('all');
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [toasts, setToasts] = useState<NotificationItem[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const knownIdsRef = useRef<Set<string>>(new Set());
  const isInitialMount = useRef(true);

  // Initialize read notifications from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('hl_read_notifications');
      if (stored) {
        setReadIds(new Set(JSON.parse(stored)));
      }
    } catch {
      // LocalStorage unavailable or invalid
    }
  }, []);

  // Fetch automations status
  const autos = useQuery({
    queryKey: ['automations'],
    queryFn: async () => (await automationApi.list()).data.data as Automation[],
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  // Fetch Instagram accounts
  const igs = useQuery({
    queryKey: ['ig-accounts'],
    queryFn: async () => (await instagramApi.accounts()).data.data as IgAccount[],
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  // Fetch worker health status
  const worker = useQuery({
    queryKey: ['creator-worker-status'],
    queryFn: async () => (await healthApi.workerStatus()).data.data as WorkerStatus,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    retry: 2,
  });

  // Fetch recent runs for first active automation (if any)
  const firstActiveAutoId = autos.data?.find((a) => a.status === 'LIVE' || (a._count?.runs ?? 0) > 0)?.id;
  const recentRuns = useQuery({
    queryKey: ['notification-recent-runs', firstActiveAutoId],
    queryFn: async () => {
      if (!firstActiveAutoId) return [];
      const res = await automationApi.runs(firstActiveAutoId);
      return (res.data.data?.runs ?? []).slice(0, 5) as Run[];
    },
    enabled: !!firstActiveAutoId,
    refetchInterval: 20_000,
    refetchOnWindowFocus: true,
  });

  // Compute live notifications list
  const notifications: NotificationItem[] = useMemo(() => {
    const list: NotificationItem[] = [];
    const now = Date.now();

    // 1. Instagram connection alerts
    (igs.data ?? []).filter((a) => a.isActive && a.tokenExpiresAt).forEach((a) => {
      const expDate = new Date(a.tokenExpiresAt!).getTime();
      const days = Math.ceil((expDate - now) / 86400000);
      if (days <= 7) {
        const expired = days <= 0;
        list.push({
          id: `ig-token-${a.id}-${expired ? 'expired' : 'expiring'}`,
          title: expired ? `@${a.username} connection expired` : `@${a.username} token expiring`,
          body: expired
            ? 'Reconnect your Instagram account to keep automations running.'
            : `Your Instagram connection expires in ${days} day${days === 1 ? '' : 's'}. Reconnect to avoid downtime.`,
          href: '/dashboard/instagram',
          tone: expired || days <= 2 ? 'coral' : 'amber',
          iconType: 'instagram',
          createdAt: expDate,
          isRead: false,
        });
      }
    });

    // 2. Unconfirmed webhooks
    (igs.data ?? []).filter((a) => a.isActive && !a.webhookSubscribedAt).forEach((a) => {
      list.push({
        id: `ig-wh-unconfirmed-${a.id}`,
        title: `@${a.username} webhooks not confirmed`,
        body: 'Set up Instagram comment and message webhooks before relying on automations.',
        href: '/dashboard/instagram',
        tone: 'amber',
        iconType: 'instagram',
        createdAt: now - 3600000,
        isRead: false,
      });
    });

    // 3. Webhook delivery unverified
    (igs.data ?? []).filter((a) => a.isActive && a.webhookSubscribedAt && !a.lastWebhookAt).forEach((a) => {
      list.push({
        id: `ig-wh-unverified-${a.id}`,
        title: `@${a.username} delivery not verified`,
        body: 'Subscription succeeded, but no webhook event received yet. Test by commenting on your post.',
        href: '/dashboard/instagram',
        tone: 'amber',
        iconType: 'instagram',
        createdAt: now - 7200000,
        isRead: false,
      });
    });

    // 4. No Instagram accounts connected
    if ((igs.data ?? []).filter((a) => a.isActive).length === 0 && !igs.isLoading && igs.data) {
      list.push({
        id: 'ig-none-connected',
        title: 'No Instagram connected',
        body: 'Connect a professional Instagram account to start automated DMs.',
        href: '/dashboard/instagram',
        tone: 'amber',
        iconType: 'instagram',
        createdAt: now,
        isRead: false,
      });
    }

    // 5. Automation health alerts
    (autos.data ?? []).forEach((a) => {
      if (a.health?.level === 'at_risk' && a.health.reason !== 'Instagram connection expires soon.') {
        list.push({
          id: `auto-atrisk-${a.id}`,
          title: `${a.name} needs attention`,
          body: a.health.reason || a.health.label || 'Check automation settings to resume firing.',
          href: `/dashboard/automations/${a.id}`,
          tone: 'amber',
          iconType: 'alert',
          createdAt: now - 1800000,
          isRead: false,
        });
      }
    });

    // 6. Worker health alerts
    if (worker.data?.status === 'stale') {
      list.push({
        id: 'worker-stale-alert',
        title: 'DM delivery worker offline',
        body: 'Queued automations cannot run until delivery worker is back online.',
        href: '/dashboard/notifications',
        tone: 'coral',
        iconType: 'alert',
        createdAt: now,
        isRead: false,
      });
    }

    // 7. Recent delivery activity
    (recentRuns.data ?? []).forEach((run) => {
      const runTime = new Date(run.sentAt || run.createdAt).getTime();
      if (run.status === 'SENT') {
        list.push({
          id: `run-sent-${run.id}`,
          title: `DM sent to @${run.username || 'follower'}`,
          body: 'Automated direct message response delivered successfully.',
          href: '/dashboard/logs',
          tone: 'green',
          iconType: 'send',
          createdAt: runTime,
          isRead: false,
        });
      } else if (run.status === 'FAILED') {
        list.push({
          id: `run-failed-${run.id}`,
          title: `Delivery failed for @${run.username || 'follower'}`,
          body: run.error || 'Failed to deliver message. Check delivery logs for details.',
          href: '/dashboard/logs',
          tone: 'coral',
          iconType: 'alert',
          createdAt: runTime,
          isRead: false,
        });
      }
    });

    // Map read state and sort newest first
    return list
      .map((item) => ({ ...item, isRead: readIds.has(item.id) }))
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [autos.data, igs.data, igs.isLoading, worker.data, recentRuns.data, readIds]);

  // Real-time toast detector: pops a notification card when a brand-new notification appears
  useEffect(() => {
    if (isInitialMount.current) {
      // Seed initial known IDs so existing state doesn't spam toasts on initial page load
      notifications.forEach((n) => knownIdsRef.current.add(n.id));
      isInitialMount.current = false;
      return;
    }

    // Detect genuinely new notifications
    const newItems = notifications.filter(
      (n) => !knownIdsRef.current.has(n.id) && !readIds.has(n.id)
    );

    if (newItems.length > 0) {
      newItems.forEach((item) => {
        knownIdsRef.current.add(item.id);
        setToasts((prev) => [item, ...prev.slice(0, 2)]); // Keep max 3 toasts at once
      });
    }
  }, [notifications, readIds]);

  // Auto-dismiss toasts after 5 seconds
  useEffect(() => {
    if (toasts.length === 0) return;
    const timer = setTimeout(() => {
      setToasts((prev) => prev.slice(1));
    }, 5000);
    return () => clearTimeout(timer);
  }, [toasts]);

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  // Mark all as read
  const markAllAsRead = useCallback(() => {
    const updated = new Set(readIds);
    notifications.forEach((n) => updated.add(n.id));
    setReadIds(updated);
    try {
      localStorage.setItem('hl_read_notifications', JSON.stringify(Array.from(updated)));
    } catch {
      // Ignore
    }
  }, [notifications, readIds]);

  // Mark single notification as read and navigate
  const handleItemClick = (item: NotificationItem) => {
    const updated = new Set(readIds);
    updated.add(item.id);
    setReadIds(updated);
    try {
      localStorage.setItem('hl_read_notifications', JSON.stringify(Array.from(updated)));
    } catch {
      // Ignore
    }
    setOpen(false);
    router.push(item.href);
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const filteredNotifications = notifications.filter((n) =>
    activeTab === 'all' ? true : !n.isRead
  );

  const getToneStyles = (tone: NotificationItem['tone']) => {
    switch (tone) {
      case 'coral':
        return {
          bg: 'var(--error-soft)',
          color: 'var(--error)',
          dot: 'var(--error)',
          badge: 'var(--error)',
        };
      case 'amber':
        return {
          bg: 'var(--warning-soft)',
          color: 'var(--warning)',
          dot: 'var(--warning)',
          badge: 'var(--warning)',
        };
      case 'green':
        return {
          bg: 'var(--success-soft)',
          color: 'var(--success)',
          dot: 'var(--success)',
          badge: 'var(--success)',
        };
      case 'blue':
      default:
        return {
          bg: 'var(--info-soft)',
          color: 'var(--info)',
          dot: 'var(--info)',
          badge: 'var(--info)',
        };
    }
  };

  const getNotificationIcon = (type: NotificationItem['iconType'], tone: NotificationItem['tone']) => {
    const toneStyle = getToneStyles(tone);
    const iconStyle = { width: 17, height: 17, color: toneStyle.color };
    switch (type) {
      case 'instagram':
        return <Instagram style={iconStyle} />;
      case 'send':
        return <Send style={iconStyle} />;
      case 'check':
        return <CheckCircle2 style={iconStyle} />;
      case 'sparkles':
        return <Sparkles style={iconStyle} />;
      case 'alert':
      default:
        return <AlertTriangle style={iconStyle} />;
    }
  };

  return (
    <div style={{ position: 'relative' }} ref={dropdownRef}>
      {/* ─── Notification Bell Button ───────────────────────────── */}
      <button
        onClick={() => setOpen((prev) => !prev)}
        aria-label="Notifications"
        aria-expanded={open}
        aria-haspopup="true"
        className="rl-nav"
        style={{
          position: 'relative',
          color: open ? 'var(--text)' : 'var(--text-muted)',
          background: open ? 'var(--nav-selected)' : 'transparent',
          border: 'none',
          padding: 8,
          borderRadius: 10,
          display: 'grid',
          placeItems: 'center',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
        }}
      >
        <Bell style={{ width: 18, height: 18 }} aria-hidden />

        {/* Live Unread Badge */}
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: 3,
              right: 3,
              minWidth: 16,
              height: 16,
              padding: '0 4px',
              borderRadius: 999,
              background: 'var(--error)',
              color: '#FFFFFF',
              fontSize: 10,
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 0 2px var(--card)',
              lineHeight: 1,
            }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* ─── Dropdown Popover ───────────────────────────────────── */}
      {open && (
        <div
          role="dialog"
          aria-label="Notifications popover"
          style={{
            position: 'absolute',
            right: 0,
            top: 'calc(100% + 8px)',
            width: 390,
            maxWidth: 'calc(100vw - 28px)',
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 16,
            boxShadow: 'var(--shadow-lg)',
            zIndex: 100,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            animation: 'hl-popover-in 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '14px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid var(--border-soft)',
              background: 'var(--card)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
                Notifications
              </span>
              {unreadCount > 0 ? (
                <span
                  style={{
                    background: 'var(--error-soft)',
                    color: 'var(--error)',
                    padding: '2px 8px',
                    borderRadius: 999,
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                >
                  {unreadCount} new
                </span>
              ) : (
                <span
                  style={{
                    background: 'var(--success-soft)',
                    color: 'var(--success)',
                    padding: '2px 8px',
                    borderRadius: 999,
                    fontSize: 11,
                    fontWeight: 650,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <CheckCircle2 style={{ width: 11, height: 11 }} /> Caught up
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  fontSize: 12.5,
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  cursor: 'pointer',
                  padding: '4px 8px',
                  borderRadius: 6,
                }}
                className="rl-nav"
                title="Mark all as read"
              >
                <CheckCheck style={{ width: 14, height: 14 }} />
                <span>Mark all read</span>
              </button>
            )}
          </div>

          {/* Filter Tabs */}
          <div
            style={{
              display: 'flex',
              gap: 6,
              padding: '8px 16px',
              borderBottom: '1px solid var(--border-soft)',
              background: 'var(--nav-hover)',
            }}
          >
            <button
              onClick={() => setActiveTab('all')}
              style={{
                background: activeTab === 'all' ? 'var(--card)' : 'transparent',
                color: activeTab === 'all' ? 'var(--text)' : 'var(--text-muted)',
                boxShadow: activeTab === 'all' ? 'var(--shadow-sm)' : 'none',
                border: activeTab === 'all' ? '1px solid var(--border)' : '1px solid transparent',
                borderRadius: 8,
                padding: '4px 10px',
                fontSize: 12.5,
                fontWeight: activeTab === 'all' ? 700 : 500,
                cursor: 'pointer',
                transition: 'all 0.12s ease',
              }}
            >
              All ({notifications.length})
            </button>
            <button
              onClick={() => setActiveTab('unread')}
              style={{
                background: activeTab === 'unread' ? 'var(--card)' : 'transparent',
                color: activeTab === 'unread' ? 'var(--text)' : 'var(--text-muted)',
                boxShadow: activeTab === 'unread' ? 'var(--shadow-sm)' : 'none',
                border: activeTab === 'unread' ? '1px solid var(--border)' : '1px solid transparent',
                borderRadius: 8,
                padding: '4px 10px',
                fontSize: 12.5,
                fontWeight: activeTab === 'unread' ? 700 : 500,
                cursor: 'pointer',
                transition: 'all 0.12s ease',
              }}
            >
              Unread ({unreadCount})
            </button>
          </div>

          {/* Notification Items List */}
          <div
            style={{
              maxHeight: 380,
              overflowY: 'auto',
              padding: '6px 8px',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
            }}
          >
            {filteredNotifications.length === 0 ? (
              <div
                style={{
                  padding: '36px 20px',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: '50%',
                    background: 'var(--success-soft)',
                    color: 'var(--success)',
                    display: 'grid',
                    placeItems: 'center',
                  }}
                >
                  <CheckCircle2 style={{ width: 22, height: 22 }} />
                </div>
                <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--text)' }}>
                  {activeTab === 'unread' ? 'No unread notifications' : 'All clear'}
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: 'var(--text-muted)',
                    maxWidth: 240,
                    lineHeight: 1.45,
                  }}
                >
                  {activeTab === 'unread'
                    ? 'You have viewed all incoming notifications and alerts.'
                    : 'Your automations and connected accounts are running smoothly.'}
                </div>
              </div>
            ) : (
              filteredNotifications.map((item) => {
                const toneStyle = getToneStyles(item.tone);
                return (
                  <div
                    key={item.id}
                    onClick={() => handleItemClick(item)}
                    role="button"
                    tabIndex={0}
                    className="rl-nav"
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 12,
                      padding: '10px 12px',
                      borderRadius: 10,
                      cursor: 'pointer',
                      background: item.isRead ? 'transparent' : 'var(--nav-selected)',
                      border: '1px solid transparent',
                      transition: 'background 0.12s ease',
                    }}
                  >
                    {/* Icon badge */}
                    <div
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 10,
                        background: toneStyle.bg,
                        display: 'grid',
                        placeItems: 'center',
                        flexShrink: 0,
                        marginTop: 2,
                      }}
                    >
                      {getNotificationIcon(item.iconType, item.tone)}
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 6,
                        }}
                      >
                        <span
                          style={{
                            fontSize: 13.5,
                            fontWeight: item.isRead ? 600 : 750,
                            color: 'var(--text)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {item.title}
                        </span>
                        {!item.isRead && (
                          <span
                            style={{
                              width: 7,
                              height: 7,
                              borderRadius: '50%',
                              background: 'var(--info)',
                              flexShrink: 0,
                            }}
                          />
                        )}
                      </div>

                      <div
                        style={{
                          fontSize: 12.5,
                          color: 'var(--text-muted)',
                          lineHeight: 1.4,
                          marginTop: 3,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {item.body}
                      </div>

                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 5,
                          fontSize: 11.5,
                          color: 'var(--text-faint)',
                          marginTop: 5,
                        }}
                      >
                        <Clock style={{ width: 11, height: 11 }} />
                        <span>{formatTimeAgo(item.createdAt)}</span>
                      </div>
                    </div>

                    <ChevronRight
                      style={{
                        width: 14,
                        height: 14,
                        color: 'var(--text-faint)',
                        flexShrink: 0,
                        alignSelf: 'center',
                        opacity: 0.6,
                      }}
                    />
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div
            style={{
              padding: '10px 14px',
              borderTop: '1px solid var(--border-soft)',
              background: 'var(--card)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Link
              href="/dashboard/notifications"
              onClick={() => setOpen(false)}
              style={{
                fontSize: 13,
                fontWeight: 650,
                color: 'var(--text)',
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
              }}
              className="rl-nav"
            >
              <span>View all notifications</span>
              <ExternalLink style={{ width: 12, height: 12 }} />
            </Link>

            <span style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>
              Real-time sync
            </span>
          </div>
        </div>
      )}

      {/* ─── Real-Time Floating Toasts (Popups) ───────────────────── */}
      {toasts.length > 0 && (
        <div
          style={{
            position: 'fixed',
            top: 20,
            right: 20,
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            pointerEvents: 'none',
            maxWidth: 360,
            width: 'calc(100vw - 40px)',
          }}
        >
          {toasts.map((toast) => {
            const toneStyle = getToneStyles(toast.tone);
            return (
              <div
                key={toast.id}
                style={{
                  pointerEvents: 'auto',
                  background: 'var(--card)',
                  border: '1px solid var(--border)',
                  borderRadius: 14,
                  boxShadow: 'var(--shadow-lg)',
                  padding: '12px 14px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 12,
                  animation: 'hl-toast-slide 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 9,
                    background: toneStyle.bg,
                    display: 'grid',
                    placeItems: 'center',
                    flexShrink: 0,
                  }}
                >
                  {getNotificationIcon(toast.iconType, toast.tone)}
                </div>

                <div
                  style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}
                  onClick={() => {
                    dismissToast(toast.id);
                    handleItemClick(toast);
                  }}
                >
                  <div
                    style={{
                      fontSize: 13.5,
                      fontWeight: 700,
                      color: 'var(--text)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {toast.title}
                  </div>
                  <div
                    style={{
                      fontSize: 12.5,
                      color: 'var(--text-muted)',
                      lineHeight: 1.4,
                      marginTop: 2,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {toast.body}
                  </div>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    dismissToast(toast.id);
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-faint)',
                    cursor: 'pointer',
                    padding: 2,
                    borderRadius: 4,
                  }}
                  aria-label="Dismiss notification"
                >
                  <X style={{ width: 14, height: 14 }} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Popover & Toast Keyframe Animations */}
      <style jsx global>{`
        @keyframes hl-popover-in {
          from {
            opacity: 0;
            transform: translateY(-6px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @keyframes hl-toast-slide {
          from {
            opacity: 0;
            transform: translateX(16px) scale(0.96);
          }
          to {
            opacity: 1;
            transform: translateX(0) scale(1);
          }
        }
      `}</style>
    </div>
  );
}
