'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { ArrowDown, ArrowUp, Copy, ExternalLink, Eye, EyeOff, ImagePlus, Loader2, Plus, Trash2 } from 'lucide-react';
import { userApi } from '../../../../services/api';
import { useAuthStore } from '../../../../store/authStore';
import { Btn, Card, PageHead, RL } from '../../../../components/rl-kit';
import { ProfileFavicon } from '../../../../components/profile-favicon';
import { ProfileAvatar } from '../../../../components/profile-avatar';

type SocialPlatform = 'instagram' | 'youtube' | 'linkedin' | 'x' | 'facebook' | 'tiktok' | 'github' | 'whatsapp' | 'telegram' | 'pinterest' | 'website';
type SocialLink = { id?: string; platform: SocialPlatform; title: string; url: string; sortOrder: number; isVisible: boolean };
type CustomLink = { id?: string; title: string; url: string; description: string | null; sortOrder: number; isVisible: boolean };
type ProfileDraft = { username: string; displayName: string; bio: string; visibility: 'PRIVATE' | 'PUBLIC'; appearance: 'LIGHT' | 'DARK' | 'NEUTRAL'; avatarUrl: string | null; socialLinks: SocialLink[]; customLinks: CustomLink[] };
type Availability = { available: boolean; reason: string | null } | null;

const platforms: Array<{ value: SocialPlatform; label: string }> = [
  { value: 'instagram', label: 'Instagram' }, { value: 'youtube', label: 'YouTube' },
  { value: 'linkedin', label: 'LinkedIn' }, { value: 'x', label: 'X' },
  { value: 'facebook', label: 'Facebook' }, { value: 'tiktok', label: 'TikTok' },
  { value: 'github', label: 'GitHub' }, { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'telegram', label: 'Telegram' }, { value: 'pinterest', label: 'Pinterest' },
  { value: 'website', label: 'Website' },
];
const blank: ProfileDraft = { username: '', displayName: '', bio: '', visibility: 'PRIVATE', appearance: 'NEUTRAL', avatarUrl: null, socialLinks: [], customLinks: [] };
const inputStyle: React.CSSProperties = { width: '100%', minWidth: 0, height: 42, padding: '0 12px', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', background: 'var(--surface)', font: 'inherit', fontSize: 13.5 };
const labelStyle: React.CSSProperties = { display: 'block', marginBottom: 6, color: 'var(--text)', fontSize: 12.5, fontWeight: 650 };

function sortLinks<T extends { sortOrder: number }>(items: T[]) { return items.map((item, i) => ({ ...item, sortOrder: i })); }

function Preview({ draft, compact }: { draft: ProfileDraft; compact: boolean }) {
  const appearance = draft.appearance.toLowerCase();
  const links = [
    ...draft.socialLinks.filter((item) => item.isVisible).sort((a, b) => a.sortOrder - b.sortOrder),
    ...draft.customLinks.filter((item) => item.isVisible).sort((a, b) => a.sortOrder - b.sortOrder),
  ];
  return <div className={`hl-profile-preview ${appearance}${compact ? ' compact' : ''}`}>
    <div className="hl-profile-preview-inner">
      <ProfileAvatar src={draft.avatarUrl} name={draft.displayName || draft.username || 'HeyLaunch'} className="hl-profile-avatar" width={160} height={160} />
      <h3>{draft.displayName || 'Your name'}</h3>
      <div className="hl-preview-handle">@{draft.username || 'username'}</div>
      {draft.bio && <p className="hl-preview-bio">{draft.bio}</p>}
      {links.length > 0 ? <div className="hl-preview-links">
        {links.map((item) => <a key={item.id ?? `${item.title}-${item.sortOrder}`} href={item.url} target="_blank" rel="noopener noreferrer nofollow">
          <span className="hl-preview-link-icon"><ProfileFavicon url={item.url} social={'platform' in item} /></span>
          <span className="hl-preview-link-copy"><strong>{item.title}</strong>{'description' in item && item.description && <small>{item.description}</small>}</span>
          <ExternalLink size={15} aria-hidden className="hl-preview-external" />
        </a>)}
      </div> : <div className="hl-preview-empty">Your visible links will appear here.</div>}
      <div className="hl-profile-signature">Made with <b>HeyLaunch</b></div>
    </div>
  </div>;
}

export default function PublicProfileEditorPage() {
  const user = useAuthStore((state) => state.user);
  const [draft, setDraft] = useState<ProfileDraft>({ ...blank, displayName: user?.name ?? '' });
  const [avatarStorageAvailable, setAvatarStorageAvailable] = useState(false);
  const [availability, setAvailability] = useState<Availability>(null);
  const [checking, setChecking] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadPercent, setUploadPercent] = useState(0);
  const [previewMode, setPreviewMode] = useState<'mobile' | 'desktop'>('mobile');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let live = true;
    userApi.publicProfile().then(({ data }) => {
      if (!live) return;
      const value = data?.profile;
      setAvatarStorageAvailable(Boolean(data?.avatarStorageAvailable));
      if (value) setDraft({
        username: value.username ?? '', displayName: value.displayName ?? user?.name ?? '', bio: value.bio ?? '',
        visibility: value.visibility ?? 'PRIVATE', appearance: value.appearance ?? 'NEUTRAL', avatarUrl: value.avatarUrl ?? null,
        socialLinks: value.socialLinks ?? [], customLinks: value.customLinks ?? [],
      });
      else setDraft((current) => ({ ...current, displayName: user?.name ?? '' }));
      setSaved(true);
    }).catch(() => toast.error('Could not load your public profile.')).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [user?.name]);

  useEffect(() => {
    if (!draft.username) { setAvailability(null); setChecking(false); return; }
    let live = true;
    setChecking(true);
    const timer = window.setTimeout(async () => {
      try {
        const { data } = await userApi.usernameAvailability(draft.username);
        if (live) setAvailability({ available: Boolean(data?.available), reason: data?.reason ?? null });
      } catch { if (live) setAvailability(null); }
      finally { if (live) setChecking(false); }
    }, 350);
    return () => { live = false; window.clearTimeout(timer); };
  }, [draft.username]);

  const publicUrl = useMemo(() => typeof window === 'undefined' || !draft.username ? '' : `${window.location.origin}/${draft.username}`, [draft.username]);
  const set = <K extends keyof ProfileDraft>(key: K, value: ProfileDraft[K]) => { setDraft((current) => ({ ...current, [key]: value })); setSaved(false); };

  async function saveProfile() {
    if (!availability?.available) return toast.error('Choose an available username before saving.');
    setSaving(true);
    try {
      const payload = { username: draft.username, displayName: draft.displayName, bio: draft.bio || null,
        visibility: draft.visibility, appearance: draft.appearance, socialLinks: draft.socialLinks, customLinks: draft.customLinks };
      const { data } = await userApi.savePublicProfile(payload);
      const value = data?.profile;
      if (value) setDraft((current) => ({ ...current, username: value.username, displayName: value.displayName, bio: value.bio ?? '',
        visibility: value.visibility, appearance: value.appearance, avatarUrl: value.avatarUrl ?? null,
        socialLinks: value.socialLinks ?? [], customLinks: value.customLinks ?? [] }));
      setSaved(true);
      toast.success(draft.visibility === 'PUBLIC' ? 'Your profile is published.' : 'Your profile changes are saved.');
    } catch (error: any) { toast.error(error?.response?.data?.message?.[0] ?? error?.response?.data?.message ?? 'Could not save your profile.'); }
    finally { setSaving(false); }
  }

  async function uploadAvatar(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      return toast.error('Choose a JPEG, PNG, or WebP image smaller than 5 MB.');
    }
    if (!saved) return toast.error('Save your profile before uploading a photo.');
    const form = new FormData(); form.append('avatar', file);
    setUploading(true); setUploadPercent(0);
    try {
      const { data } = await userApi.uploadPublicProfileAvatar(form, setUploadPercent);
      setAvatarStorageAvailable(Boolean(data?.avatarStorageAvailable));
      setDraft((current) => ({ ...current, avatarUrl: data?.profile?.avatarUrl ?? null }));
      toast.success('Profile photo updated.');
    } catch (error: any) { toast.error(error?.response?.data?.message ?? 'Could not upload that image.'); }
    finally { setUploading(false); setUploadPercent(0); }
  }

  async function removeAvatar() {
    try {
      const { data } = await userApi.removePublicProfileAvatar();
      setDraft((current) => ({ ...current, avatarUrl: data?.profile?.avatarUrl ?? null }));
      toast.success('Profile photo removed.');
    } catch (error: any) { toast.error(error?.response?.data?.message ?? 'Could not remove the profile photo.'); }
  }

  function addSocial() {
    const available = platforms.find((item) => !draft.socialLinks.some((link) => link.platform === item.value));
    if (!available) return toast.error('You have added every supported platform.');
    set('socialLinks', sortLinks([...draft.socialLinks, { platform: available.value, title: available.label, url: '', sortOrder: draft.socialLinks.length, isVisible: true }]));
  }
  function addCustom() {
    if (draft.customLinks.length >= 20) return toast.error('You can add up to 20 custom links.');
    set('customLinks', sortLinks([...draft.customLinks, { title: '', url: '', description: null, sortOrder: draft.customLinks.length, isVisible: true }]));
  }
  function reorderSocial(index: number, delta: number) {
    const next = [...draft.socialLinks]; const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    set('socialLinks', sortLinks(next));
  }
  function reorderCustom(index: number, delta: number) {
    const next = [...draft.customLinks]; const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    set('customLinks', sortLinks(next));
  }

  async function copyLink() {
    if (!publicUrl) return;
    try { await navigator.clipboard.writeText(publicUrl); toast.success('Profile link copied.'); }
    catch { toast.error('Could not copy the profile link.'); }
  }

  const availabilityText = !draft.username ? 'Choose your public username' : checking ? 'Checking availability…'
    : availability?.available ? 'Username available' : availability?.reason === 'reserved' ? 'That username is reserved'
      : availability?.reason === 'previously_used' ? 'You cannot reuse a previous username'
        : availability?.reason === 'invalid' ? 'Use 3–30 lowercase letters, numbers, or underscores'
          : availability?.reason === 'taken' ? 'That username is already taken' : 'Availability could not be checked';

  return <div className="hl-profile-editor">
    <PageHead title="My Public Profile" sub="Build one shareable page for your links, social accounts, and creator identity." />
    <style>{`
      .hl-profile-editor{max-width:1320px;margin:0 auto}.hl-profile-grid{display:grid;grid-template-columns:minmax(0,1.12fr) minmax(320px,.88fr);gap:22px;align-items:start}
      .hl-profile-section{padding:22px;margin-bottom:16px}.hl-profile-section h2{font-size:15px;margin:0;color:var(--text);letter-spacing:-.2px}.hl-profile-section p{font-size:12.5px;line-height:1.5;color:var(--text-muted);margin:5px 0 0}
      .hl-profile-field{margin-top:17px}.hl-profile-row{display:flex;gap:10px;align-items:flex-start}.hl-profile-row+.hl-profile-row{margin-top:10px}.hl-profile-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
      .hl-profile-note{font-size:12px;color:var(--text-muted);line-height:1.45;margin-top:7px}.hl-profile-status{font-size:12px;margin-top:6px}.hl-profile-links{display:grid;gap:10px;margin-top:16px}.hl-profile-link-box{border:1px solid var(--border);background:var(--surface-2);border-radius:12px;padding:12px}
      .hl-profile-link-box .hl-profile-row{margin-top:9px}.hl-profile-link-box .hl-profile-row:first-child{margin-top:0}.hl-profile-icon-button{width:34px;height:34px;flex:none;border:1px solid var(--border);border-radius:9px;background:var(--surface);color:var(--text-muted);display:grid;place-items:center;cursor:pointer}
      .hl-profile-preview-wrap{position:sticky;top:18px}.hl-profile-preview-toggle{display:flex;gap:6px;border:1px solid var(--border);background:var(--surface-2);padding:4px;border-radius:999px}.hl-profile-preview-toggle button{border:0;background:none;color:var(--text-muted);padding:7px 10px;border-radius:999px;font-size:11px;cursor:pointer}.hl-profile-preview-toggle button[aria-pressed=true]{background:var(--surface);color:var(--text);box-shadow:0 1px 4px #0001}
      .hl-profile-preview{min-height:520px;border:1px solid var(--border);border-radius:20px;padding:28px 18px;display:flex;justify-content:center;overflow:hidden;background:#f5f5f2;color:#191b1a}
      .hl-profile-preview.dark{background:#141615;color:#f4f5f2}.hl-profile-preview.neutral{background:#e9e9e4;color:#181a18}.hl-profile-preview-inner{width:100%;max-width:360px;text-align:center;margin:auto}.hl-profile-preview.compact .hl-profile-preview-inner{max-width:270px}
      .hl-profile-avatar{width:88px;height:88px;border-radius:50%;object-fit:cover;margin:0 auto 14px;border:3px solid #fff;box-shadow:0 4px 18px #0002}.hl-profile-avatar.fallback{display:grid;place-items:center;background:#c8f169;color:#20251c;font-size:30px;font-weight:750}
      .hl-profile-preview h3{font-size:23px;line-height:1.15;letter-spacing:-.5px;margin:0}.hl-profile-preview.compact h3{font-size:20px}.hl-preview-handle{font-size:12px;opacity:.65;margin-top:5px}.hl-preview-bio{font-size:13px;line-height:1.5;margin:13px auto 0;max-width:300px;white-space:pre-wrap;overflow-wrap:anywhere}
      .hl-preview-links{display:grid;gap:10px;margin-top:22px}.hl-preview-links a{min-height:58px;text-align:left;text-decoration:none;color:inherit;border:1px solid color-mix(in srgb,currentColor 12%,transparent);border-radius:13px;padding:10px 12px;display:flex;align-items:center;gap:11px;background:color-mix(in srgb,currentColor 4%,transparent);transition:transform .16s ease,background .16s ease}
      .hl-preview-links a:hover{transform:translateY(-1px);background:color-mix(in srgb,currentColor 8%,transparent)}.hl-preview-links a:focus-visible{outline:3px solid #9aca38;outline-offset:3px}.hl-preview-link-icon{width:28px;height:28px;border-radius:9px;display:grid;place-items:center;background:color-mix(in srgb,currentColor 8%,transparent);flex:none}
      .hl-preview-link-copy{min-width:0;display:grid;gap:3px;flex:1}.hl-preview-link-copy strong{font-size:12.5px;font-weight:650;overflow-wrap:anywhere}.hl-preview-link-copy small{font-size:11px;opacity:.65;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.hl-preview-external{opacity:.5;flex:none}
      .hl-preview-empty{margin-top:22px;padding:22px 12px;border:1px dashed color-mix(in srgb,currentColor 20%,transparent);border-radius:13px;font-size:12px;opacity:.6}.hl-profile-signature{font-size:10px;opacity:.5;margin-top:22px}.hl-profile-signature b{font-weight:750}
      @media(max-width:960px){.hl-profile-grid{grid-template-columns:1fr}.hl-profile-preview-wrap{position:static}.hl-profile-preview{min-height:470px}}
      @media(max-width:540px){.hl-profile-section{padding:17px}.hl-profile-row.stack-sm{flex-direction:column}.hl-profile-row.stack-sm>*{width:100%}.hl-profile-preview{padding:22px 14px;min-height:450px}}
      @media(prefers-reduced-motion:reduce){.hl-preview-links a{transition:none}}
    `}</style>

    {loading ? <Card style={{ padding: 28, color: RL.muted }}>Loading your profile…</Card> : <div className="hl-profile-grid">
      <div>
          <Card className="hl-profile-section">
          <div><h2>Profile identity</h2><p>This is the public name and handle visitors see.</p></div>
          <div className="hl-profile-field">
            <label style={labelStyle} htmlFor="profile-username">Public username</label>
            <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface)', paddingLeft: 12 }}>
              <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>@</span>
              <input id="profile-username" value={draft.username} maxLength={30} autoCapitalize="none" autoCorrect="off" spellCheck={false}
                onChange={(event) => set('username', event.target.value.trim().toLowerCase())}
                style={{ ...inputStyle, border: 0, background: 'transparent' }} aria-describedby="profile-username-help" />
            </div>
            <div id="profile-username-help" className="hl-profile-status" aria-live="polite" style={{ color: checking ? 'var(--text-muted)' : availability?.available ? '#4d8a26' : availability ? 'var(--error)' : 'var(--text-muted)' }}>
              {checking && <Loader2 size={12} style={{ verticalAlign: -2, marginRight: 5 }} className="animate-spin" />}{availabilityText}
            </div>
            {draft.username && <div className="hl-profile-note">Your link: <strong>{typeof window === 'undefined' ? 'heylaunch.app' : window.location.host}/{draft.username}</strong>. Handles are lowercase; retired usernames stay reserved and redirect to your current page.</div>}
          </div>
          <div className="hl-profile-field"><label style={labelStyle} htmlFor="profile-display-name">Display name</label><input id="profile-display-name" style={inputStyle} maxLength={80} value={draft.displayName} onChange={(event) => set('displayName', event.target.value)} /></div>
          <div className="hl-profile-field"><label style={labelStyle} htmlFor="profile-bio">Short bio</label><textarea id="profile-bio" maxLength={160} value={draft.bio} onChange={(event) => set('bio', event.target.value)} rows={3}
            style={{ ...inputStyle, height: 'auto', minHeight: 82, padding: '10px 12px', resize: 'vertical' }} /><div className="hl-profile-note" style={{ textAlign: 'right' }}>{draft.bio.length}/160</div></div>
          <div className="hl-profile-field"><label style={labelStyle}>Profile photo</label><div className="hl-profile-row" style={{ alignItems: 'center' }}>
            {draft.avatarUrl ? <ProfileAvatar src={draft.avatarUrl} name={draft.displayName || draft.username || 'HeyLaunch'} className="hl-profile-avatar" width={58} height={58}
              style={{ width: 58, height: 58, borderRadius: '50%', objectFit: 'cover' }}
              fallbackStyle={{ width: 58, height: 58, borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'var(--surface-2)', color: 'var(--text-muted)' }} />
              : <div style={{ width: 58, height: 58, borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'var(--surface-2)', color: 'var(--text-muted)' }}><ImagePlus size={20} /></div>}
            <div style={{ display: 'grid', gap: 5 }}>
              <label className="rl-b" style={{ height: 36, display: 'inline-flex', alignItems: 'center', gap: 7, padding: '0 12px', border: '1px solid var(--border)', borderRadius: 9, cursor: avatarStorageAvailable && saved && !uploading ? 'pointer' : 'not-allowed', opacity: avatarStorageAvailable && saved && !uploading ? 1 : .55, fontSize: 12.5 }}>
                <ImagePlus size={15} /> {uploading ? `Uploading ${uploadPercent}%` : draft.avatarUrl ? 'Replace photo' : 'Choose photo'}
                <input type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadAvatar} disabled={!avatarStorageAvailable || !saved || uploading} style={{ display: 'none' }} />
              </label>
              {draft.avatarUrl && <button type="button" onClick={removeAvatar} style={{ border: 0, background: 'none', padding: 0, color: 'var(--error)', fontSize: 12, cursor: 'pointer', textAlign: 'left' }}>Remove photo</button>}
            </div>
          </div>
          <div className="hl-profile-note">JPEG, PNG, or WebP · max 5 MB. Images are validated, resized, and stripped of metadata.</div>
          {!avatarStorageAvailable && <div role="status" className="hl-profile-note">Photo storage is not configured for this environment yet. Your profile and links can still be saved.</div>}
          {!saved && avatarStorageAvailable && <div className="hl-profile-note">Save your profile once before uploading a photo.</div>}
          {uploading && <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={uploadPercent} style={{ height: 4, background: 'var(--border)', borderRadius: 99, marginTop: 9 }}><span style={{ display: 'block', width: `${uploadPercent}%`, height: '100%', borderRadius: 99, background: '#a3d949', transition: 'width .15s' }} /></div>}
          </div>
        </Card>

        <Card className="hl-profile-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}><div><h2>Social accounts</h2><p>Show the accounts visitors can find you on.</p></div><button type="button" onClick={addSocial} className="rl-b" style={{ height: 34, border: '1px solid var(--border)', borderRadius: 9, background: 'var(--surface)', color: 'var(--text)', padding: '0 10px', display: 'inline-flex', gap: 6, alignItems: 'center', cursor: 'pointer', fontSize: 12 }}><Plus size={15} /> Add social</button></div>
          <div className="hl-profile-links">{draft.socialLinks.map((link, index) => <div className="hl-profile-link-box" key={link.id ?? `${link.platform}-${index}`}>
            <div className="hl-profile-row stack-sm">
              <select aria-label="Social platform" value={link.platform} onChange={(event) => { const next = [...draft.socialLinks]; const platform = event.target.value as SocialPlatform; next[index] = { ...link, platform, title: platforms.find((p) => p.value === platform)?.label ?? platform }; set('socialLinks', next); }} style={{ ...inputStyle, maxWidth: 145 }}>
                {platforms.filter((item) => item.value === link.platform || !draft.socialLinks.some((other) => other.platform === item.value)).map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
              <input aria-label={`${link.title} profile URL`} type="url" placeholder="https://…" value={link.url} onChange={(event) => { const next = [...draft.socialLinks]; next[index] = { ...link, url: event.target.value }; set('socialLinks', next); }} style={{ ...inputStyle, flex: 1 }} />
              <div className="hl-profile-actions">
                <button type="button" className="hl-profile-icon-button" aria-label="Move social link up" onClick={() => reorderSocial(index, -1)}><ArrowUp size={15} /></button>
                <button type="button" className="hl-profile-icon-button" aria-label="Move social link down" onClick={() => reorderSocial(index, 1)}><ArrowDown size={15} /></button>
                <button type="button" className="hl-profile-icon-button" aria-label={link.isVisible ? 'Hide social link' : 'Show social link'} onClick={() => { const next = [...draft.socialLinks]; next[index] = { ...link, isVisible: !link.isVisible }; set('socialLinks', next); }}>{link.isVisible ? <Eye size={15} /> : <EyeOff size={15} />}</button>
                <button type="button" className="hl-profile-icon-button" aria-label="Delete social link" onClick={() => set('socialLinks', sortLinks(draft.socialLinks.filter((_, i) => i !== index)))}><Trash2 size={15} /></button>
              </div>
            </div>
          </div>)}{draft.socialLinks.length === 0 && <div className="hl-profile-note">No social accounts added yet.</div>}</div>
        </Card>

        <Card className="hl-profile-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}><div><h2>Custom links</h2><p>Share your shop, latest video, newsletter, or anything else.</p></div><button type="button" onClick={addCustom} className="rl-b" style={{ height: 34, border: '1px solid var(--border)', borderRadius: 9, background: 'var(--surface)', color: 'var(--text)', padding: '0 10px', display: 'inline-flex', gap: 6, alignItems: 'center', cursor: 'pointer', fontSize: 12 }}><Plus size={15} /> Add link</button></div>
          <div className="hl-profile-links">{draft.customLinks.map((link, index) => <div className="hl-profile-link-box" key={link.id ?? `custom-${index}`}>
            <div className="hl-profile-row stack-sm"><input aria-label="Link title" maxLength={80} placeholder="Link title" value={link.title} onChange={(event) => { const next = [...draft.customLinks]; next[index] = { ...link, title: event.target.value }; set('customLinks', next); }} style={{ ...inputStyle, flex: 1 }} />
              <input aria-label="Destination URL" type="url" placeholder="https://example.com" value={link.url} onChange={(event) => { const next = [...draft.customLinks]; next[index] = { ...link, url: event.target.value }; set('customLinks', next); }} style={{ ...inputStyle, flex: 1.2 }} /></div>
            <div className="hl-profile-row"><input aria-label="Short description" maxLength={200} placeholder="Optional short description" value={link.description ?? ''} onChange={(event) => { const next = [...draft.customLinks]; next[index] = { ...link, description: event.target.value || null }; set('customLinks', next); }} style={inputStyle} /></div>
            <div className="hl-profile-row" style={{ justifyContent: 'space-between', alignItems: 'center' }}><span className="hl-profile-note" style={{ margin: 0 }}>{link.url ? <><ProfileFavicon url={link.url} /> <span style={{ marginLeft: 5 }}>Website icon loads when available</span></> : 'Add a URL to preview the website icon'}</span>
              <div className="hl-profile-actions"><button type="button" className="hl-profile-icon-button" aria-label="Move link up" onClick={() => reorderCustom(index, -1)}><ArrowUp size={15} /></button><button type="button" className="hl-profile-icon-button" aria-label="Move link down" onClick={() => reorderCustom(index, 1)}><ArrowDown size={15} /></button>
                <button type="button" className="hl-profile-icon-button" aria-label={link.isVisible ? 'Hide link' : 'Show link'} onClick={() => { const next = [...draft.customLinks]; next[index] = { ...link, isVisible: !link.isVisible }; set('customLinks', next); }}>{link.isVisible ? <Eye size={15} /> : <EyeOff size={15} />}</button><button type="button" className="hl-profile-icon-button" aria-label="Delete link" onClick={() => set('customLinks', sortLinks(draft.customLinks.filter((_, i) => i !== index)))}><Trash2 size={15} /></button></div></div>
          </div>)}{draft.customLinks.length === 0 && <div className="hl-profile-note">No custom links added yet.</div>}</div>
        </Card>

        <Card className="hl-profile-section">
          <div><h2>Appearance and publishing</h2><p>Keep it simple. Choose a look and decide when the page is visible.</p></div>
          <div className="hl-profile-field"><label style={labelStyle}>Appearance</label><div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{(['LIGHT', 'DARK', 'NEUTRAL'] as const).map((theme) => <button key={theme} type="button" aria-pressed={draft.appearance === theme} onClick={() => set('appearance', theme)} style={{ padding: '9px 13px', borderRadius: 9, border: `1px solid ${draft.appearance === theme ? '#a3d949' : 'var(--border)'}`, background: draft.appearance === theme ? 'color-mix(in srgb,#a3d949 12%,var(--surface))' : 'var(--surface)', color: 'var(--text)', cursor: 'pointer', fontSize: 12 }}>{theme[0] + theme.slice(1).toLowerCase()}</button>)}</div></div>
          <div className="hl-profile-field"><label style={labelStyle}>Visibility</label><button type="button" aria-pressed={draft.visibility === 'PUBLIC'} onClick={() => set('visibility', draft.visibility === 'PUBLIC' ? 'PRIVATE' : 'PUBLIC')} style={{ display: 'flex', gap: 10, alignItems: 'center', width: '100%', textAlign: 'left', padding: 12, border: '1px solid var(--border)', borderRadius: 11, background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer' }}>
            {draft.visibility === 'PUBLIC' ? <Eye size={17} /> : <EyeOff size={17} />}<span><strong style={{ fontSize: 13 }}>{draft.visibility === 'PUBLIC' ? 'Published' : 'Private'}</strong><span style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>{draft.visibility === 'PUBLIC' ? 'Anyone with your profile URL can view it.' : 'Only you can see this profile in the editor.'}</span></span></button></div>
          <div className="hl-profile-field hl-profile-actions"><Btn onClick={saveProfile} disabled={saving || checking || !availability?.available || !draft.displayName.trim()}>{saving ? 'Saving…' : draft.visibility === 'PUBLIC' ? 'Save and publish' : 'Save profile'}</Btn>
            {draft.visibility === 'PUBLIC' && draft.username && <><button type="button" className="rl-b" onClick={copyLink} style={{ height: 38, padding: '0 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', display: 'inline-flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 12 }}><Copy size={14} /> Copy link</button><Link href={`/${draft.username}`} target="_blank" className="rl-b" style={{ height: 38, padding: '0 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', display: 'inline-flex', alignItems: 'center', gap: 7, textDecoration: 'none', fontSize: 12 }}>Open page <ExternalLink size={14} /></Link></>}
          </div>
        </Card>
      </div>

      <div className="hl-profile-preview-wrap">
        <Card style={{ padding: 14, borderRadius: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '2px 4px 12px' }}><div><div style={{ color: 'var(--text)', fontWeight: 700, fontSize: 13 }}>Live preview</div><div style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 3 }}>Updates as you edit</div></div>
            <div className="hl-profile-preview-toggle" role="group" aria-label="Preview width"><button type="button" aria-pressed={previewMode === 'mobile'} onClick={() => setPreviewMode('mobile')}>Mobile</button><button type="button" aria-pressed={previewMode === 'desktop'} onClick={() => setPreviewMode('desktop')}>Desktop</button></div></div>
          <Preview draft={draft} compact={previewMode === 'mobile'} />
        </Card>
        <div className="hl-profile-note" style={{ padding: '10px 4px' }}>A private profile returns a not-found page to visitors. Only visible links are published.</div>
      </div>
    </div>}
  </div>;
}
