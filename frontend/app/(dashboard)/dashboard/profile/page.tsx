'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  ArrowDown,
  ArrowUp,
  Camera,
  CheckCircle,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  ImagePlus,
  Laptop,
  Link2,
  Loader2,
  Plus,
  Smartphone,
  Tablet,
  Trash2,
} from 'lucide-react';
import { userApi } from '../../../../services/api';
import { useAuthStore } from '../../../../store/authStore';
import { Btn, Card, PageHead, RL } from '../../../../components/rl-kit';
import { ProfileFavicon } from '../../../../components/profile-favicon';
import { ProfileAvatar } from '../../../../components/profile-avatar';
import { SocialIcon } from '../../../../components/social-icons';

type SocialPlatform =
  | 'instagram'
  | 'youtube'
  | 'linkedin'
  | 'x'
  | 'facebook'
  | 'tiktok'
  | 'github'
  | 'whatsapp'
  | 'telegram'
  | 'pinterest'
  | 'website';

type SocialLink = {
  id?: string;
  platform: SocialPlatform;
  title: string;
  url: string;
  sortOrder: number;
  isVisible: boolean;
};

type CustomLink = {
  id?: string;
  title: string;
  url: string;
  description: string | null;
  sortOrder: number;
  isVisible: boolean;
};

type ProfileDraft = {
  username: string;
  displayName: string;
  bio: string;
  visibility: 'PRIVATE' | 'PUBLIC';
  appearance: 'LIGHT' | 'DARK' | 'NEUTRAL';
  avatarUrl: string | null;
  socialLinks: SocialLink[];
  customLinks: CustomLink[];
};

type Availability = { available: boolean; reason: string | null } | null;

const platforms: Array<{ value: SocialPlatform; label: string; placeholder: string; prefix?: string }> = [
  { value: 'instagram', label: 'Instagram', placeholder: 'username or instagram.com/username' },
  { value: 'youtube', label: 'YouTube', placeholder: '@channel or youtube.com/@channel' },
  { value: 'x', label: 'X (Twitter)', placeholder: 'username or x.com/username' },
  { value: 'linkedin', label: 'LinkedIn', placeholder: 'username or linkedin.com/in/username' },
  { value: 'github', label: 'GitHub', placeholder: 'username or github.com/username' },
  { value: 'tiktok', label: 'TikTok', placeholder: '@username or tiktok.com/@username' },
  { value: 'whatsapp', label: 'WhatsApp', placeholder: '+1234567890 or wa.me/number' },
  { value: 'telegram', label: 'Telegram', placeholder: 'username or t.me/username' },
  { value: 'facebook', label: 'Facebook', placeholder: 'username or facebook.com/username' },
  { value: 'pinterest', label: 'Pinterest', placeholder: 'username or pinterest.com/username' },
  { value: 'website', label: 'Website', placeholder: 'https://yourwebsite.com' },
];

function formatPlatformUrl(platform: SocialPlatform, raw: string): string {
  let val = (raw || '').trim();
  if (!val) return '';

  // Already a full valid HTTP/HTTPS URL
  if (/^https?:\/\//i.test(val)) return val;

  // Clean leading @
  const clean = val.replace(/^@/, '');

  switch (platform) {
    case 'instagram':
      if (clean.toLowerCase().startsWith('instagram.com/')) return `https://${clean}`;
      return `https://instagram.com/${clean}`;
    case 'youtube':
      if (clean.toLowerCase().startsWith('youtube.com/')) return `https://${clean}`;
      return `https://youtube.com/@${clean}`;
    case 'x':
      if (clean.toLowerCase().startsWith('x.com/') || clean.toLowerCase().startsWith('twitter.com/')) return `https://${clean}`;
      return `https://x.com/${clean}`;
    case 'linkedin':
      if (clean.toLowerCase().startsWith('linkedin.com/')) return `https://${clean}`;
      return `https://linkedin.com/in/${clean}`;
    case 'github':
      if (clean.toLowerCase().startsWith('github.com/')) return `https://${clean}`;
      return `https://github.com/${clean}`;
    case 'tiktok':
      if (clean.toLowerCase().startsWith('tiktok.com/')) return `https://${clean}`;
      return `https://tiktok.com/@${clean}`;
    case 'whatsapp':
      if (clean.toLowerCase().startsWith('wa.me/')) return `https://${clean}`;
      return `https://wa.me/${clean.replace(/[^0-9]/g, '')}`;
    case 'telegram':
      if (clean.toLowerCase().startsWith('t.me/')) return `https://${clean}`;
      return `https://t.me/${clean}`;
    case 'facebook':
      if (clean.toLowerCase().startsWith('facebook.com/')) return `https://${clean}`;
      return `https://facebook.com/${clean}`;
    case 'pinterest':
      if (clean.toLowerCase().startsWith('pinterest.com/')) return `https://${clean}`;
      return `https://pinterest.com/${clean}`;
    default:
      return `https://${clean}`;
  }
}

const blank: ProfileDraft = {
  username: '',
  displayName: '',
  bio: '',
  visibility: 'PRIVATE',
  appearance: 'NEUTRAL',
  avatarUrl: null,
  socialLinks: [],
  customLinks: [],
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  minWidth: 0,
  height: 42,
  padding: '0 13px',
  border: '1px solid var(--border)',
  borderRadius: 10,
  color: 'var(--text)',
  background: 'var(--surface)',
  font: 'inherit',
  fontSize: 13.5,
  transition: 'border-color .15s ease, box-shadow .15s ease',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  marginBottom: 6,
  color: 'var(--text)',
  fontSize: 12.5,
  fontWeight: 650,
};

function sortLinks<T extends { sortOrder: number }>(items: T[]) {
  return items.map((item, i) => ({ ...item, sortOrder: i }));
}

function PhonePreview({ draft, viewMode }: { draft: ProfileDraft; viewMode: 'mobile' | 'tablet' | 'desktop' }) {
  const appearance = draft.appearance.toLowerCase();
  const visibleSocials = draft.socialLinks.filter((item) => item.isVisible && item.url.trim());
  const visibleCustom = draft.customLinks.filter((item) => item.isVisible && item.url.trim());

  return (
    <div className={`hl-phone-frame ${viewMode}`}>
      {/* Smartphone Hardware Notch / Dynamic Island */}
      {viewMode === 'mobile' && (
        <div className="hl-phone-notch-bar">
          <div className="hl-phone-island" />
        </div>
      )}

      {/* Screen Canvas */}
      <div className={`hl-phone-screen ${appearance}`}>
        <div className="hl-screen-content">
          {/* Header */}
          <div className="hl-screen-header">
            <div className="hl-avatar-wrap">
              <ProfileAvatar
                src={draft.avatarUrl}
                name={draft.displayName || draft.username || 'HeyLaunch'}
                className="hl-screen-avatar"
                width={88}
                height={88}
              />
            </div>

            <div className="hl-screen-title-row">
              <h3>{draft.displayName || 'Your Display Name'}</h3>
              <CheckCircle size={17} fill="#bbf444" stroke="#090d16" className="hl-badge-icon" />
            </div>

            <div className="hl-screen-handle">@{draft.username || 'username'}</div>

            {draft.bio && <p className="hl-screen-bio">{draft.bio}</p>}
          </div>

          {/* Social Dock */}
          {visibleSocials.length > 0 && (
            <div className="hl-screen-socials">
              {visibleSocials.map((link, idx) => (
                <div key={link.id ?? idx} className="hl-screen-social-chip" title={link.title}>
                  <SocialIcon platform={link.platform || link.title} size={16} />
                </div>
              ))}
            </div>
          )}

          {/* Custom Link Cards */}
          {visibleCustom.length > 0 ? (
            <div className="hl-screen-links">
              {visibleCustom.map((item, idx) => (
                <div key={item.id ?? idx} className="hl-screen-card">
                  <div className="hl-screen-card-icon">
                    <ProfileFavicon url={item.url} />
                  </div>
                  <div className="hl-screen-card-copy">
                    <strong>{item.title || 'Untitled Link'}</strong>
                    {item.description && <small>{item.description}</small>}
                  </div>
                  <ExternalLink size={14} className="hl-screen-card-arrow" />
                </div>
              ))}
            </div>
          ) : (
            <div className="hl-screen-empty">
              <Link2 size={18} />
              <span>Your links will appear here</span>
            </div>
          )}

          {/* Footer badge */}
          <div className="hl-screen-footer">
            <span>Powered by <b>HeyLaunch</b></span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PublicProfileEditorPage() {
  const user = useAuthStore((state) => state.user);
  const [draft, setDraft] = useState<ProfileDraft>({ ...blank, displayName: user?.name ?? '' });
  const [availability, setAvailability] = useState<Availability>(null);
  const [checking, setChecking] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadPercent, setUploadPercent] = useState(0);
  const [viewMode, setViewMode] = useState<'mobile' | 'tablet' | 'desktop'>('mobile');

  useEffect(() => {
    let live = true;
    userApi
      .publicProfile()
      .then(({ data }) => {
        if (!live) return;
        const value = data?.profile;
        if (value) {
          setDraft({
            username: value.username ?? '',
            displayName: value.displayName ?? user?.name ?? '',
            bio: value.bio ?? '',
            visibility: value.visibility ?? 'PRIVATE',
            appearance: value.appearance ?? 'NEUTRAL',
            avatarUrl: value.avatarUrl ?? null,
            socialLinks: value.socialLinks ?? [],
            customLinks: value.customLinks ?? [],
          });
        } else {
          setDraft((current) => ({ ...current, displayName: user?.name ?? '' }));
        }
      })
      .catch(() => toast.error('Could not load your public profile.'))
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [user?.name]);

  useEffect(() => {
    if (!draft.username) {
      setAvailability(null);
      setChecking(false);
      return;
    }
    let live = true;
    setChecking(true);
    const timer = window.setTimeout(async () => {
      try {
        const { data } = await userApi.usernameAvailability(draft.username);
        if (live) setAvailability({ available: Boolean(data?.available), reason: data?.reason ?? null });
      } catch {
        if (live) setAvailability(null);
      } finally {
        if (live) setChecking(false);
      }
    }, 350);
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [draft.username]);

  const publicUrl = useMemo(
    () => (typeof window === 'undefined' || !draft.username ? '' : `${window.location.origin}/${draft.username}`),
    [draft.username],
  );

  const set = <K extends keyof ProfileDraft>(key: K, value: ProfileDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  async function saveProfile() {
    if (!draft.username.trim()) {
      return toast.error('Choose a public username before saving.');
    }
    if (!availability?.available) {
      return toast.error('Choose an available username before saving.');
    }
    if (!draft.displayName.trim()) {
      return toast.error('Please enter a display name.');
    }

    // Auto-clean and format URLs
    const formattedSocials: SocialLink[] = [];
    for (const link of draft.socialLinks) {
      const raw = link.url.trim();
      if (!raw) continue; // Skip empty unconfigured links
      const formatted = formatPlatformUrl(link.platform, raw);
      formattedSocials.push({ ...link, url: formatted });
    }

    const formattedCustom: CustomLink[] = [];
    for (const link of draft.customLinks) {
      const raw = link.url.trim();
      if (!raw) continue;
      const formatted = formatPlatformUrl('website', raw);
      formattedCustom.push({ ...link, url: formatted });
    }

    setSaving(true);
    try {
      const payload = {
        username: draft.username.trim().toLowerCase(),
        displayName: draft.displayName.trim(),
        bio: draft.bio.trim() || null,
        visibility: draft.visibility,
        appearance: draft.appearance,
        socialLinks: formattedSocials,
        customLinks: formattedCustom,
      };

      const { data } = await userApi.savePublicProfile(payload);
      const value = data?.profile;
      if (value) {
        setDraft((current) => ({
          ...current,
          username: value.username,
          displayName: value.displayName,
          bio: value.bio ?? '',
          visibility: value.visibility,
          appearance: value.appearance,
          avatarUrl: value.avatarUrl ?? null,
          socialLinks: value.socialLinks ?? [],
          customLinks: value.customLinks ?? [],
        }));
      }
      toast.success(draft.visibility === 'PUBLIC' ? 'Your public profile is published!' : 'Profile changes saved.');
    } catch (error: any) {
      const msg = error?.response?.data?.message;
      const displayMsg = Array.isArray(msg) ? msg[0] : typeof msg === 'string' ? msg : 'Could not save your profile. Please check your URLs.';
      toast.error(displayMsg);
    } finally {
      setSaving(false);
    }
  }

  async function uploadAvatar(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      return toast.error('Choose a JPEG, PNG, or WebP image smaller than 5 MB.');
    }

    // Instant local preview
    const localUrl = URL.createObjectURL(file);
    setDraft((curr) => ({ ...curr, avatarUrl: localUrl }));

    const form = new FormData();
    form.append('avatar', file);
    setUploading(true);
    setUploadPercent(0);

    try {
      const { data } = await userApi.uploadPublicProfileAvatar(form, setUploadPercent);
      if (data?.profile?.avatarUrl) {
        setDraft((current) => ({ ...current, avatarUrl: data.profile.avatarUrl }));
      }
      toast.success('Profile photo uploaded successfully!');
    } catch (error: any) {
      toast.error(error?.response?.data?.message ?? 'Could not upload that image. Try saving your profile first.');
    } finally {
      setUploading(false);
      setUploadPercent(0);
    }
  }

  async function removeAvatar() {
    try {
      await userApi.removePublicProfileAvatar();
      setDraft((current) => ({ ...current, avatarUrl: null }));
      toast.success('Profile photo removed.');
    } catch (error: any) {
      toast.error(error?.response?.data?.message ?? 'Could not remove the profile photo.');
    }
  }

  function addSocial() {
    const available = platforms.find((item) => !draft.socialLinks.some((link) => link.platform === item.value));
    if (!available) return toast.error('You have added every supported social platform.');
    set(
      'socialLinks',
      sortLinks([
        ...draft.socialLinks,
        { platform: available.value, title: available.label, url: '', sortOrder: draft.socialLinks.length, isVisible: true },
      ]),
    );
  }

  function addCustom() {
    if (draft.customLinks.length >= 20) return toast.error('You can add up to 20 custom links.');
    set(
      'customLinks',
      sortLinks([
        ...draft.customLinks,
        { title: '', url: '', description: null, sortOrder: draft.customLinks.length, isVisible: true },
      ]),
    );
  }

  function reorderSocial(index: number, delta: number) {
    const next = [...draft.socialLinks];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    set('socialLinks', sortLinks(next));
  }

  function reorderCustom(index: number, delta: number) {
    const next = [...draft.customLinks];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    set('customLinks', sortLinks(next));
  }

  async function copyLink() {
    if (!publicUrl) return;
    try {
      await navigator.clipboard.writeText(publicUrl);
      toast.success('Profile link copied to clipboard!');
    } catch {
      toast.error('Could not copy link.');
    }
  }

  const availabilityText = !draft.username
    ? 'Choose your public username'
    : checking
    ? 'Checking availability…'
    : availability?.available
    ? '✓ Username available'
    : availability?.reason === 'taken'
    ? '✗ That username is already taken'
    : availability?.reason === 'invalid'
    ? 'Use 3–30 lowercase letters, numbers, or underscores'
    : availability?.reason === 'reserved'
    ? 'That username is reserved'
    : 'Availability could not be verified';

  return (
    <div className="hl-profile-editor">
      <PageHead
        title="My Public Profile"
        sub="Build an ultra-modern, shareable link-in-bio page for your audience, products, and socials."
      />

      <style>{`
        .hl-profile-editor { max-width: 1380px; margin: 0 auto; }
        .hl-profile-grid { display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(360px, 0.85fr); gap: 28px; align-items: start; }
        .hl-profile-section { padding: 24px; margin-bottom: 20px; border-radius: 16px; border: 1px solid var(--border); background: var(--surface); box-shadow: 0 1px 3px rgba(0,0,0,0.02); }
        .hl-profile-section h2 { font-size: 16px; font-weight: 700; margin: 0; color: var(--text); letter-spacing: -0.3px; }
        .hl-profile-section p { font-size: 13px; line-height: 1.5; color: var(--text-muted); margin: 4px 0 0; }
        .hl-profile-field { margin-top: 18px; }
        .hl-profile-row { display: flex; gap: 10px; align-items: center; }
        .hl-profile-row + .hl-profile-row { margin-top: 10px; }
        .hl-profile-actions { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
        .hl-profile-note { font-size: 12px; color: var(--text-muted); line-height: 1.45; margin-top: 7px; }
        .hl-profile-status { font-size: 12px; margin-top: 6px; font-weight: 500; }
        
        /* Links list */
        .hl-profile-links { display: grid; gap: 12px; margin-top: 18px; }
        .hl-profile-link-box { border: 1px solid var(--border); background: var(--surface-2); border-radius: 14px; padding: 14px; transition: border-color 0.15s ease; }
        .hl-profile-link-box:hover { border-color: color-mix(in srgb, var(--primary) 40%, var(--border)); }
        .hl-profile-icon-button { width: 34px; height: 34px; flex-shrink: 0; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); color: var(--text-muted); display: grid; place-items: center; cursor: pointer; transition: all 0.15s ease; }
        .hl-profile-icon-button:hover { color: var(--text); border-color: var(--text-muted); background: var(--surface-2); }
        
        /* Theme Pill Selector */
        .hl-theme-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)); gap: 10px; margin-top: 10px; }
        .hl-theme-btn { border: 1px solid var(--border); border-radius: 12px; padding: 10px 14px; text-align: center; cursor: pointer; background: var(--surface); transition: all 0.2s ease; display: flex; flex-direction: column; align-items: center; gap: 6px; }
        .hl-theme-btn[aria-pressed=true] { border-color: #84cc16; background: rgba(132, 204, 22, 0.08); box-shadow: 0 0 0 2px rgba(132, 204, 22, 0.2); }
        .hl-theme-swatch { width: 32px; height: 20px; border-radius: 6px; border: 1px solid rgba(0,0,0,0.1); }
        .hl-theme-swatch.light { background: #ffffff; }
        .hl-theme-swatch.dark { background: #090d16; border-color: rgba(255,255,255,0.15); }
        .hl-theme-swatch.neutral { background: #f4f2ec; }

        /* Smartphone Preview Container */
        .hl-preview-wrapper { position: sticky; top: 20px; display: flex; flex-direction: column; align-items: center; }
        .hl-preview-controls { display: flex; justify-content: space-between; align-items: center; width: 100%; margin-bottom: 14px; padding: 0 4px; }
        .hl-view-toggle { display: flex; gap: 4px; background: var(--surface-2); border: 1px solid var(--border); padding: 3px; border-radius: 10px; }
        .hl-view-btn { border: 0; background: none; color: var(--text-muted); padding: 5px 10px; border-radius: 8px; font-size: 12px; cursor: pointer; display: flex; align-items: center; gap: 5px; transition: all 0.15s ease; }
        .hl-view-btn[aria-pressed=true] { background: var(--surface); color: var(--text); font-weight: 600; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }

        /* Phone Mockup Frame */
        .hl-phone-frame {
          width: 100%;
          max-width: 380px;
          border-radius: 44px;
          border: 10px solid #1e293b;
          background: #090d16;
          box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(255, 255, 255, 0.08);
          overflow: hidden;
          position: relative;
          transition: max-width 0.3s ease;
        }

        .hl-phone-frame.tablet {
          max-width: 480px;
          border-radius: 36px;
          border-width: 8px;
        }

        .hl-phone-frame.desktop {
          max-width: 100%;
          border-radius: 20px;
          border-width: 4px;
        }

        .hl-phone-notch-bar {
          height: 28px;
          width: 100%;
          display: flex;
          justify-content: center;
          align-items: center;
          background: transparent;
          position: absolute;
          top: 8px;
          left: 0;
          z-index: 20;
          pointer-events: none;
        }

        .hl-phone-island {
          width: 88px;
          height: 22px;
          background: #000;
          border-radius: 20px;
          box-shadow: 0 0 1px 1px rgba(255, 255, 255, 0.05);
        }

        /* Screen Canvas */
        .hl-phone-screen {
          min-height: 580px;
          max-height: 680px;
          overflow-y: auto;
          padding: 44px 18px 24px;
          display: flex;
          flex-direction: column;
          align-items: center;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          transition: background 0.3s ease;
        }

        .hl-phone-screen::-webkit-scrollbar { width: 4px; }
        .hl-phone-screen::-webkit-scrollbar-thumb { background: rgba(0, 0, 0, 0.15); border-radius: 4px; }

        .hl-phone-screen.light {
          background: radial-gradient(circle at 50% 0%, rgba(132, 204, 22, 0.15) 0%, transparent 60%), #f8fafc;
          color: #0f172a;
          --c-card: #ffffff;
          --c-border: #e2e8f0;
          --c-muted: #64748b;
        }

        .hl-phone-screen.dark {
          background: radial-gradient(ellipse at 50% -10%, #172a14 0%, transparent 60%), #090d16;
          color: #f8fafc;
          --c-card: rgba(26, 32, 44, 0.85);
          --c-border: rgba(255, 255, 255, 0.08);
          --c-muted: #94a3b8;
        }

        .hl-phone-screen.neutral {
          background: radial-gradient(circle at 50% 0%, #e2eed1 0%, transparent 55%), #f4f2ec;
          color: #1c1917;
          --c-card: #faf9f6;
          --c-border: #e7e5e0;
          --c-muted: #78716c;
        }

        .hl-screen-content { width: 100%; max-width: 340px; display: flex; flex-direction: column; align-items: center; text-align: center; margin: auto; }
        
        .hl-avatar-wrap { position: relative; margin-bottom: 12px; }
        .hl-screen-avatar { width: 84px; height: 84px; border-radius: 50%; object-fit: cover; border: 3px solid var(--c-card); box-shadow: 0 4px 14px rgba(0,0,0,0.1); }
        .hl-screen-avatar.fallback { display: grid; place-items: center; background: #bbf444; color: #090d16; font-size: 32px; font-weight: 800; }

        .hl-screen-title-row { display: flex; align-items: center; justify-content: center; gap: 5px; }
        .hl-screen-title-row h3 { font-size: 19px; font-weight: 800; letter-spacing: -0.4px; margin: 0; line-height: 1.2; }
        .hl-badge-icon { flex-shrink: 0; }
        .hl-screen-handle { font-size: 12px; color: var(--c-muted); margin-top: 4px; font-weight: 500; }
        .hl-screen-bio { font-size: 13px; line-height: 1.5; margin: 10px auto 0; max-width: 280px; white-space: pre-wrap; word-break: break-word; }

        /* Social chips inside screen */
        .hl-screen-socials { display: flex; justify-content: center; gap: 8px; margin-top: 16px; flex-wrap: wrap; }
        .hl-screen-social-chip { width: 34px; height: 34px; border-radius: 50%; border: 1px solid var(--c-border); background: var(--c-card); display: grid; place-items: center; box-shadow: 0 2px 4px rgba(0,0,0,0.03); }

        /* Links inside screen */
        .hl-screen-links { display: grid; gap: 9px; margin-top: 20px; width: 100%; }
        .hl-screen-card { min-height: 52px; padding: 10px 14px; border: 1px solid var(--c-border); border-radius: 14px; background: var(--c-card); display: flex; align-items: center; gap: 11px; text-align: left; box-shadow: 0 2px 6px rgba(0,0,0,0.03); }
        .hl-screen-card-icon { width: 32px; height: 32px; border-radius: 9px; background: rgba(132, 204, 22, 0.15); display: grid; place-items: center; flex-shrink: 0; }
        .hl-screen-card-copy { min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 2px; }
        .hl-screen-card-copy strong { font-size: 13px; font-weight: 700; overflow-wrap: anywhere; }
        .hl-screen-card-copy small { font-size: 11px; color: var(--c-muted); overflow-wrap: anywhere; }
        .hl-screen-card-arrow { color: var(--c-muted); flex-shrink: 0; }

        .hl-screen-empty { margin-top: 22px; padding: 24px 16px; border: 1.5px dashed var(--c-border); border-radius: 14px; color: var(--c-muted); display: flex; flex-direction: column; align-items: center; gap: 6px; font-size: 12px; }
        .hl-screen-footer { margin-top: 26px; font-size: 11px; color: var(--c-muted); }
        .hl-screen-footer b { font-weight: 700; color: inherit; }

        @media (max-width: 1024px) {
          .hl-profile-grid { grid-template-columns: 1fr; }
          .hl-preview-wrapper { position: static; margin-top: 24px; }
          .hl-phone-frame { max-width: 440px; }
        }
      `}</style>

      {loading ? (
        <Card style={{ padding: 32, textAlign: 'center', color: RL.muted }}>
          <Loader2 className="animate-spin inline-block mr-2" size={18} /> Loading your public profile…
        </Card>
      ) : (
        <div className="hl-profile-grid">
          {/* Left Column: Form Controls */}
          <div>
            {/* Identity Card */}
            <Card className="hl-profile-section">
              <div>
                <h2>Profile identity</h2>
                <p>Choose your custom handle, display name, and avatar seen by your audience.</p>
              </div>

              <div className="hl-profile-field">
                <label style={labelStyle} htmlFor="profile-username">
                  Public handle / link
                </label>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    border: '1px solid var(--border)',
                    borderRadius: 10,
                    background: 'var(--surface)',
                    paddingLeft: 12,
                  }}
                >
                  <span style={{ color: 'var(--text-muted)', fontSize: 13.5, fontWeight: 600 }}>@</span>
                  <input
                    id="profile-username"
                    value={draft.username}
                    maxLength={30}
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    onChange={(event) => set('username', event.target.value.trim().toLowerCase())}
                    style={{ ...inputStyle, border: 0, background: 'transparent' }}
                    placeholder="yourhandle"
                    aria-describedby="profile-username-help"
                  />
                </div>
                <div
                  id="profile-username-help"
                  className="hl-profile-status"
                  aria-live="polite"
                  style={{
                    color: checking
                      ? 'var(--text-muted)'
                      : availability?.available
                      ? '#65a30d'
                      : availability
                      ? 'var(--error)'
                      : 'var(--text-muted)',
                  }}
                >
                  {checking && <Loader2 size={12} className="animate-spin inline-block mr-1" />}
                  {availabilityText}
                </div>
                {draft.username && (
                  <div className="hl-profile-note">
                    Your public link: <strong>{publicUrl}</strong>
                  </div>
                )}
              </div>

              <div className="hl-profile-field">
                <label style={labelStyle} htmlFor="profile-display-name">
                  Display name
                </label>
                <input
                  id="profile-display-name"
                  style={inputStyle}
                  maxLength={80}
                  value={draft.displayName}
                  onChange={(event) => set('displayName', event.target.value)}
                  placeholder="e.g. Siva Goram"
                />
              </div>

              <div className="hl-profile-field">
                <label style={labelStyle} htmlFor="profile-bio">
                  Short bio
                </label>
                <textarea
                  id="profile-bio"
                  maxLength={160}
                  value={draft.bio}
                  onChange={(event) => set('bio', event.target.value)}
                  rows={3}
                  placeholder="Tell visitors what you do, build, or share…"
                  style={{ ...inputStyle, height: 'auto', minHeight: 80, padding: '10px 12px', resize: 'vertical' }}
                />
                <div className="hl-profile-note" style={{ textAlign: 'right' }}>
                  {draft.bio.length}/160
                </div>
              </div>

              {/* Avatar Upload */}
              <div className="hl-profile-field">
                <label style={labelStyle}>Profile photo</label>
                <div className="hl-profile-row" style={{ gap: 14 }}>
                  {draft.avatarUrl ? (
                    <ProfileAvatar
                      src={draft.avatarUrl}
                      name={draft.displayName || draft.username || 'HeyLaunch'}
                      className="hl-screen-avatar"
                      width={64}
                      height={64}
                      style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover' }}
                      fallbackStyle={{
                        width: 64,
                        height: 64,
                        borderRadius: '50%',
                        display: 'grid',
                        placeItems: 'center',
                        background: 'var(--surface-2)',
                        color: 'var(--text-muted)',
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 64,
                        height: 64,
                        borderRadius: '50%',
                        display: 'grid',
                        placeItems: 'center',
                        background: 'var(--surface-2)',
                        color: 'var(--text-muted)',
                        border: '1.5px dashed var(--border)',
                      }}
                    >
                      <Camera size={22} />
                    </div>
                  )}

                  <div style={{ display: 'grid', gap: 6 }}>
                    <label
                      className="rl-b"
                      style={{
                        height: 38,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '0 14px',
                        border: '1px solid var(--border)',
                        borderRadius: 10,
                        cursor: uploading ? 'not-allowed' : 'pointer',
                        background: 'var(--surface)',
                        color: 'var(--text)',
                        fontSize: 13,
                        fontWeight: 600,
                      }}
                    >
                      <ImagePlus size={16} />
                      {uploading ? `Uploading ${uploadPercent}%…` : draft.avatarUrl ? 'Change photo' : 'Upload photo'}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={uploadAvatar}
                        disabled={uploading}
                        style={{ display: 'none' }}
                      />
                    </label>

                    {draft.avatarUrl && (
                      <button
                        type="button"
                        onClick={removeAvatar}
                        style={{
                          border: 0,
                          background: 'none',
                          padding: 0,
                          color: 'var(--error)',
                          fontSize: 12,
                          cursor: 'pointer',
                          textAlign: 'left',
                        }}
                      >
                        Remove photo
                      </button>
                    )}
                  </div>
                </div>
                <div className="hl-profile-note">
                  Supports JPEG, PNG, or WebP up to 5 MB. Automatically resized & optimized for speed.
                </div>
              </div>
            </Card>

            {/* Social Accounts Card */}
            <Card className="hl-profile-section">
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                <div>
                  <h2>Social accounts</h2>
                  <p>Display your official social handles with branded clickable icons.</p>
                </div>
                <button
                  type="button"
                  onClick={addSocial}
                  style={{
                    height: 34,
                    border: '1px solid var(--border)',
                    borderRadius: 9,
                    background: 'var(--surface)',
                    color: 'var(--text)',
                    padding: '0 12px',
                    display: 'inline-flex',
                    gap: 6,
                    alignItems: 'center',
                    cursor: 'pointer',
                    fontSize: 12.5,
                    fontWeight: 600,
                  }}
                >
                  <Plus size={15} /> Add social
                </button>
              </div>

              <div className="hl-profile-links">
                {draft.socialLinks.map((link, index) => {
                  const cfg = platforms.find((p) => p.value === link.platform);
                  return (
                    <div className="hl-profile-link-box" key={link.id ?? `${link.platform}-${index}`}>
                      <div className="hl-profile-row" style={{ flexWrap: 'wrap' }}>
                        {/* Platform selector */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 150 }}>
                          <span
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: 8,
                              background: 'var(--surface)',
                              display: 'grid',
                              placeItems: 'center',
                              border: '1px solid var(--border)',
                              color: 'var(--text)',
                            }}
                          >
                            <SocialIcon platform={link.platform} size={17} />
                          </span>
                          <select
                            aria-label="Social platform"
                            value={link.platform}
                            onChange={(event) => {
                              const next = [...draft.socialLinks];
                              const platform = event.target.value as SocialPlatform;
                              next[index] = {
                                ...link,
                                platform,
                                title: platforms.find((p) => p.value === platform)?.label ?? platform,
                              };
                              set('socialLinks', next);
                            }}
                            style={{ ...inputStyle, height: 36, padding: '0 8px', fontSize: 13 }}
                          >
                            {platforms.map((item) => (
                              <option key={item.value} value={item.value}>
                                {item.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* URL or handle input with auto-formatting on blur */}
                        <div style={{ flex: 1, minWidth: 200 }}>
                          <input
                            aria-label={`${link.title} profile link or handle`}
                            type="text"
                            placeholder={cfg?.placeholder ?? 'URL or @username'}
                            value={link.url}
                            onBlur={(e) => {
                              const formatted = formatPlatformUrl(link.platform, e.target.value);
                              const next = [...draft.socialLinks];
                              next[index] = { ...link, url: formatted };
                              set('socialLinks', next);
                            }}
                            onChange={(event) => {
                              const next = [...draft.socialLinks];
                              next[index] = { ...link, url: event.target.value };
                              set('socialLinks', next);
                            }}
                            style={{ ...inputStyle, height: 36 }}
                          />
                        </div>

                        {/* Reorder and Delete controls */}
                        <div className="hl-profile-actions">
                          <button
                            type="button"
                            className="hl-profile-icon-button"
                            title="Move up"
                            onClick={() => reorderSocial(index, -1)}
                          >
                            <ArrowUp size={14} />
                          </button>
                          <button
                            type="button"
                            className="hl-profile-icon-button"
                            title="Move down"
                            onClick={() => reorderSocial(index, 1)}
                          >
                            <ArrowDown size={14} />
                          </button>
                          <button
                            type="button"
                            className="hl-profile-icon-button"
                            title={link.isVisible ? 'Hide' : 'Show'}
                            onClick={() => {
                              const next = [...draft.socialLinks];
                              next[index] = { ...link, isVisible: !link.isVisible };
                              set('socialLinks', next);
                            }}
                          >
                            {link.isVisible ? <Eye size={14} /> : <EyeOff size={14} />}
                          </button>
                          <button
                            type="button"
                            className="hl-profile-icon-button"
                            title="Delete"
                            onClick={() =>
                              set(
                                'socialLinks',
                                sortLinks(draft.socialLinks.filter((_, i) => i !== index)),
                              )
                            }
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                      <div className="hl-profile-note" style={{ fontSize: 11, marginTop: 4 }}>
                        Accepts either your handle (e.g. <code>@siva</code>) or complete URL (<code>https://...</code>).
                      </div>
                    </div>
                  );
                })}

                {draft.socialLinks.length === 0 && (
                  <div className="hl-profile-note">No social accounts added yet. Tap &quot;Add social&quot; to connect Instagram, YouTube, X, etc.</div>
                )}
              </div>
            </Card>

            {/* Custom Links Card */}
            <Card className="hl-profile-section">
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                <div>
                  <h2>Custom links</h2>
                  <p>Feature your website, store, portfolio, courses, or latest content.</p>
                </div>
                <button
                  type="button"
                  onClick={addCustom}
                  style={{
                    height: 34,
                    border: '1px solid var(--border)',
                    borderRadius: 9,
                    background: 'var(--surface)',
                    color: 'var(--text)',
                    padding: '0 12px',
                    display: 'inline-flex',
                    gap: 6,
                    alignItems: 'center',
                    cursor: 'pointer',
                    fontSize: 12.5,
                    fontWeight: 600,
                  }}
                >
                  <Plus size={15} /> Add link
                </button>
              </div>

              <div className="hl-profile-links">
                {draft.customLinks.map((link, index) => (
                  <div className="hl-profile-link-box" key={link.id ?? `custom-${index}`}>
                    <div className="hl-profile-row" style={{ flexWrap: 'wrap' }}>
                      <input
                        aria-label="Link title"
                        maxLength={80}
                        placeholder="Link title (e.g. My Portfolio, Buy My Guide)"
                        value={link.title}
                        onChange={(event) => {
                          const next = [...draft.customLinks];
                          next[index] = { ...link, title: event.target.value };
                          set('customLinks', next);
                        }}
                        style={{ ...inputStyle, flex: 1, minWidth: 160 }}
                      />
                      <input
                        aria-label="Destination URL"
                        type="text"
                        placeholder="example.com or https://example.com"
                        value={link.url}
                        onBlur={(e) => {
                          const formatted = formatPlatformUrl('website', e.target.value);
                          const next = [...draft.customLinks];
                          next[index] = { ...link, url: formatted };
                          set('customLinks', next);
                        }}
                        onChange={(event) => {
                          const next = [...draft.customLinks];
                          next[index] = { ...link, url: event.target.value };
                          set('customLinks', next);
                        }}
                        style={{ ...inputStyle, flex: 1.3, minWidth: 180 }}
                      />
                    </div>

                    <div className="hl-profile-row" style={{ marginTop: 8 }}>
                      <input
                        aria-label="Optional short description"
                        maxLength={200}
                        placeholder="Optional description (e.g. 50% discount this week)"
                        value={link.description ?? ''}
                        onChange={(event) => {
                          const next = [...draft.customLinks];
                          next[index] = { ...link, description: event.target.value || null };
                          set('customLinks', next);
                        }}
                        style={{ ...inputStyle, height: 36, fontSize: 12.5 }}
                      />
                    </div>

                    <div
                      className="hl-profile-row"
                      style={{ justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}
                    >
                      <div className="hl-profile-note" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <ProfileFavicon url={link.url} />
                        <span>{link.url ? 'Favicon preview ready' : 'Enter a URL to preview site favicon'}</span>
                      </div>

                      <div className="hl-profile-actions">
                        <button
                          type="button"
                          className="hl-profile-icon-button"
                          title="Move up"
                          onClick={() => reorderCustom(index, -1)}
                        >
                          <ArrowUp size={14} />
                        </button>
                        <button
                          type="button"
                          className="hl-profile-icon-button"
                          title="Move down"
                          onClick={() => reorderCustom(index, 1)}
                        >
                          <ArrowDown size={14} />
                        </button>
                        <button
                          type="button"
                          className="hl-profile-icon-button"
                          title={link.isVisible ? 'Hide' : 'Show'}
                          onClick={() => {
                            const next = [...draft.customLinks];
                            next[index] = { ...link, isVisible: !link.isVisible };
                            set('customLinks', next);
                          }}
                        >
                          {link.isVisible ? <Eye size={14} /> : <EyeOff size={14} />}
                        </button>
                        <button
                          type="button"
                          className="hl-profile-icon-button"
                          title="Delete"
                          onClick={() =>
                            set(
                              'customLinks',
                              sortLinks(draft.customLinks.filter((_, i) => i !== index)),
                            )
                          }
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

                {draft.customLinks.length === 0 && (
                  <div className="hl-profile-note">No custom links added yet. Tap &quot;Add link&quot; to showcase your shop, content, or projects.</div>
                )}
              </div>
            </Card>

            {/* Appearance & Visibility Card */}
            <Card className="hl-profile-section">
              <div>
                <h2>Appearance and publishing</h2>
                <p>Customize the visual theme and toggle public availability.</p>
              </div>

              {/* Theme Selector */}
              <div className="hl-profile-field">
                <label style={labelStyle}>Design Theme</label>
                <div className="hl-theme-grid">
                  <button
                    type="button"
                    className="hl-theme-btn"
                    aria-pressed={draft.appearance === 'LIGHT'}
                    onClick={() => set('appearance', 'LIGHT')}
                  >
                    <div className="hl-theme-swatch light" />
                    <span style={{ fontSize: 12.5, fontWeight: 600 }}>Light</span>
                  </button>
                  <button
                    type="button"
                    className="hl-theme-btn"
                    aria-pressed={draft.appearance === 'DARK'}
                    onClick={() => set('appearance', 'DARK')}
                  >
                    <div className="hl-theme-swatch dark" />
                    <span style={{ fontSize: 12.5, fontWeight: 600 }}>Dark</span>
                  </button>
                  <button
                    type="button"
                    className="hl-theme-btn"
                    aria-pressed={draft.appearance === 'NEUTRAL'}
                    onClick={() => set('appearance', 'NEUTRAL')}
                  >
                    <div className="hl-theme-swatch neutral" />
                    <span style={{ fontSize: 12.5, fontWeight: 600 }}>Neutral</span>
                  </button>
                </div>
              </div>

              {/* Visibility Switch */}
              <div className="hl-profile-field">
                <label style={labelStyle}>Page Visibility</label>
                <button
                  type="button"
                  aria-pressed={draft.visibility === 'PUBLIC'}
                  onClick={() => set('visibility', draft.visibility === 'PUBLIC' ? 'PRIVATE' : 'PUBLIC')}
                  style={{
                    display: 'flex',
                    gap: 12,
                    alignItems: 'center',
                    width: '100%',
                    textAlign: 'left',
                    padding: '14px 16px',
                    border: '1px solid var(--border)',
                    borderRadius: 12,
                    background: draft.visibility === 'PUBLIC' ? 'rgba(132, 204, 22, 0.08)' : 'var(--surface)',
                    color: 'var(--text)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      background: draft.visibility === 'PUBLIC' ? '#84cc16' : 'var(--surface-2)',
                      color: draft.visibility === 'PUBLIC' ? '#090d16' : 'var(--text-muted)',
                      display: 'grid',
                      placeItems: 'center',
                    }}
                  >
                    {draft.visibility === 'PUBLIC' ? <Eye size={18} /> : <EyeOff size={18} />}
                  </div>
                  <div>
                    <strong style={{ fontSize: 13.5, display: 'block' }}>
                      {draft.visibility === 'PUBLIC' ? 'Published (Live)' : 'Private (Draft Mode)'}
                    </strong>
                    <span style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                      {draft.visibility === 'PUBLIC'
                        ? 'Anyone with your link can view your page.'
                        : 'Only visible inside this editor.'}
                    </span>
                  </div>
                </button>
              </div>

              {/* Publish / Action Buttons */}
              <div className="hl-profile-field hl-profile-actions" style={{ marginTop: 24 }}>
                <Btn
                  onClick={saveProfile}
                  disabled={saving || checking || !availability?.available || !draft.displayName.trim()}
                  style={{ minWidth: 140, height: 42, fontWeight: 700 }}
                >
                  {saving ? (
                    <>
                      <Loader2 className="animate-spin mr-1.5" size={15} /> Saving…
                    </>
                  ) : draft.visibility === 'PUBLIC' ? (
                    'Save and publish'
                  ) : (
                    'Save profile'
                  )}
                </Btn>

                {draft.visibility === 'PUBLIC' && draft.username && (
                  <>
                    <button
                      type="button"
                      onClick={copyLink}
                      style={{
                        height: 42,
                        padding: '0 14px',
                        borderRadius: 10,
                        border: '1px solid var(--border)',
                        background: 'var(--surface)',
                        color: 'var(--text)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 7,
                        cursor: 'pointer',
                        fontSize: 13,
                        fontWeight: 600,
                      }}
                    >
                      <Copy size={15} /> Copy link
                    </button>
                    <Link
                      href={`/${draft.username}`}
                      target="_blank"
                      style={{
                        height: 42,
                        padding: '0 14px',
                        borderRadius: 10,
                        border: '1px solid var(--border)',
                        background: 'var(--surface)',
                        color: 'var(--text)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 7,
                        textDecoration: 'none',
                        fontSize: 13,
                        fontWeight: 600,
                      }}
                    >
                      Open page <ExternalLink size={15} />
                    </Link>
                  </>
                )}
              </div>
            </Card>
          </div>

          {/* Right Column: Live Device Canvas */}
          <div className="hl-preview-wrapper">
            <div className="hl-preview-controls">
              <div>
                <div style={{ color: 'var(--text)', fontWeight: 700, fontSize: 13.5 }}>Live device preview</div>
                <div style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 2 }}>Interactive real-time mockup</div>
              </div>

              <div className="hl-view-toggle" role="group" aria-label="Device view">
                <button
                  type="button"
                  className="hl-view-btn"
                  aria-pressed={viewMode === 'mobile'}
                  onClick={() => setViewMode('mobile')}
                >
                  <Smartphone size={14} /> Phone
                </button>
                <button
                  type="button"
                  className="hl-view-btn"
                  aria-pressed={viewMode === 'tablet'}
                  onClick={() => setViewMode('tablet')}
                >
                  <Tablet size={14} /> Tablet
                </button>
                <button
                  type="button"
                  className="hl-view-btn"
                  aria-pressed={viewMode === 'desktop'}
                  onClick={() => setViewMode('desktop')}
                >
                  <Laptop size={14} /> Full
                </button>
              </div>
            </div>

            {/* Phone Screen Mockup */}
            <PhonePreview draft={draft} viewMode={viewMode} />

            <div className="hl-profile-note" style={{ textAlign: 'center', marginTop: 12 }}>
              A private profile returns a not-found page to visitors. Only visible links are published.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
