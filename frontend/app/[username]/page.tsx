import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { ExternalLink, Link2 } from 'lucide-react';
import { getPublicSiteUrl } from '../../lib/site-url';
import { resolveApiBase } from '../../lib/api-url-policy.cjs';
import { ProfileFavicon } from '../../components/profile-favicon';
import { ProfileAvatar } from '../../components/profile-avatar';

type PublicLink = { id: string; kind: 'SOCIAL' | 'CUSTOM'; platform: string | null; title: string; url: string; description: string | null; sortOrder: number };
type PublicProfile = { username: string; displayName: string; bio: string | null; appearance: 'LIGHT' | 'DARK' | 'NEUTRAL'; avatarUrl: string | null; links: PublicLink[]; redirectTo?: string | null };

const API_BASE = resolveApiBase(process.env.NEXT_PUBLIC_API_URL, {
  production: process.env.NODE_ENV === 'production',
}) as string;

async function loadProfile(username: string): Promise<PublicProfile | null> {
  try {
    const response = await fetch(`${API_BASE}/api/public/profiles/${encodeURIComponent(username)}`, { cache: 'no-store' });
    if (!response.ok) return null;
    return await response.json() as PublicProfile;
  } catch { return null; }
}

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }): Promise<Metadata> {
  const { username } = await params;
  const profile = await loadProfile(username);
  if (!profile || profile.redirectTo) return { title: 'Profile not found | HeyLaunch', robots: { index: false, follow: false } };
  const title = `${profile.displayName} (@${profile.username}) | HeyLaunch`;
  const description = profile.bio?.slice(0, 160) || `Explore ${profile.displayName}'s links and social profiles.`;
  const canonical = new URL(`/${encodeURIComponent(profile.username)}`, getPublicSiteUrl()).toString();
  return {
    title, description, alternates: { canonical }, robots: { index: true, follow: true },
    openGraph: { type: 'profile', title, description, url: canonical, images: profile.avatarUrl ? [{ url: profile.avatarUrl, alt: `${profile.displayName} profile photo` }] : [] },
    twitter: { card: profile.avatarUrl ? 'summary_large_image' : 'summary', title, description, images: profile.avatarUrl ? [profile.avatarUrl] : [] },
  };
}

export default async function PublicProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const profile = await loadProfile(username);
  if (!profile) notFound();
  // Retired handles stay reserved, but use a temporary redirect so browsers
  // and crawlers do not cache a name change permanently. This lets creators
  // hide a profile or change its handle later without a durable cached hop.
  if (profile.redirectTo) redirect(`/${encodeURIComponent(profile.redirectTo)}`);
  const socials = profile.links.filter((link) => link.kind === 'SOCIAL').sort((a, b) => a.sortOrder - b.sortOrder);
  const customLinks = profile.links.filter((link) => link.kind === 'CUSTOM').sort((a, b) => a.sortOrder - b.sortOrder);

  return <main className={`hl-public-profile ${profile.appearance.toLowerCase()}`}>
    <div className="hl-public-profile-shell">
      <header className="hl-public-profile-header">
        <ProfileAvatar src={profile.avatarUrl} name={profile.displayName} className="hl-public-profile-avatar" width={104} height={104} />
        <h1>{profile.displayName}</h1>
        <p className="hl-public-profile-username">@{profile.username}</p>
        {profile.bio && <p className="hl-public-profile-bio">{profile.bio}</p>}
      </header>

      {socials.length > 0 && <nav className="hl-public-socials" aria-label="Social profiles">
        {socials.map((link) => <a key={link.id} href={link.url} target="_blank" rel="noopener noreferrer nofollow" aria-label={link.title} title={link.title}>
          <ProfileFavicon url={link.url} social />
        </a>)}
      </nav>}

      {customLinks.length > 0 && <section className="hl-public-links" aria-label="Featured links">
        {customLinks.map((link) => <a key={link.id} className="hl-public-link" href={link.url} target="_blank" rel="noopener noreferrer nofollow">
          <span className="hl-public-link-icon"><ProfileFavicon url={link.url} /></span>
          <span className="hl-public-link-copy"><strong>{link.title}</strong>{link.description && <small>{link.description}</small>}</span>
          <ExternalLink size={16} aria-hidden className="hl-public-link-external" />
        </a>)}
      </section>}

      {socials.length === 0 && customLinks.length === 0 && <div className="hl-public-empty"><Link2 size={20} aria-hidden /><p>This creator hasn’t added any links yet.</p></div>}
      <footer className="hl-public-profile-footer"><a href={getPublicSiteUrl().toString()} rel="noopener noreferrer">Made with <b>HeyLaunch</b></a></footer>
    </div>
    <style>{`
      .hl-public-profile{--profile-bg:#f3f4f0;--profile-text:#191c19;--profile-muted:#747971;--profile-card:#fff;--profile-border:#e2e5df;min-height:100svh;display:grid;place-items:center;padding:46px 18px 30px;background:radial-gradient(ellipse at 50% -12%,#dff6ad 0,transparent 47%),var(--profile-bg);color:var(--profile-text);font-family:var(--font-inter),Inter,system-ui,sans-serif}
      .hl-public-profile.dark{--profile-bg:#101311;--profile-text:#f4f6f2;--profile-muted:#a1a9a0;--profile-card:#191e1a;--profile-border:#303730;background:radial-gradient(ellipse at 50% -15%,#354a24 0,transparent 48%),var(--profile-bg)}
      .hl-public-profile.neutral{--profile-bg:#e9eae4;--profile-text:#1d201c;--profile-muted:#6c7168;--profile-card:#f7f7f3;--profile-border:#d6d9d1;background:radial-gradient(ellipse at 50% -15%,#d9ebbd 0,transparent 47%),var(--profile-bg)}
      .hl-public-profile-shell{width:min(100%,560px);margin:auto}.hl-public-profile-header{text-align:center;display:grid;justify-items:center}.hl-public-profile-avatar{width:104px;height:104px;border-radius:50%;object-fit:cover;border:4px solid color-mix(in srgb,var(--profile-card) 88%,transparent);box-shadow:0 8px 26px #101a1024;margin:0 0 20px}.hl-public-profile-avatar.fallback{display:grid;place-items:center;background:#b9e776;color:#223016;font-size:35px;font-weight:780}
      .hl-public-profile-header h1{font-size:clamp(24px,6vw,31px);font-weight:760;letter-spacing:-.8px;line-height:1.12;margin:0;overflow-wrap:anywhere}.hl-public-profile-username{color:var(--profile-muted);font-size:13px;margin:8px 0 0}.hl-public-profile-bio{color:var(--profile-text);font-size:14px;line-height:1.65;white-space:pre-wrap;overflow-wrap:anywhere;max-width:440px;margin:16px auto 0}
      .hl-public-socials{display:flex;justify-content:center;align-items:center;gap:13px;margin:23px auto 0;flex-wrap:wrap}.hl-public-socials a{width:44px;height:44px;border:1px solid var(--profile-border);border-radius:50%;display:grid;place-items:center;color:var(--profile-text);background:color-mix(in srgb,var(--profile-card) 80%,transparent);transition:transform .16s ease,border-color .16s ease}.hl-public-socials a:hover{transform:translateY(-2px);border-color:#a5d55c}.hl-public-socials a:focus-visible,.hl-public-link:focus-visible{outline:3px solid #93c83d;outline-offset:3px}
      .hl-public-links{display:grid;gap:12px;margin:28px auto 0}.hl-public-link{min-height:72px;padding:13px 15px;display:flex;align-items:center;gap:14px;border:1px solid var(--profile-border);border-radius:16px;background:var(--profile-card);color:var(--profile-text);text-decoration:none;box-shadow:0 5px 16px #0e180b08;transition:transform .16s ease,box-shadow .16s ease,border-color .16s ease}.hl-public-link:hover{transform:translateY(-2px);border-color:#b8d98b;box-shadow:0 10px 24px #0e180b12}.hl-public-link-icon{width:42px;height:42px;border-radius:12px;background:color-mix(in srgb,#b9e776 23%,var(--profile-card));display:grid;place-items:center;flex:none}.hl-public-link-copy{min-width:0;flex:1;display:grid;gap:4px}.hl-public-link-copy strong{font-size:14px;font-weight:680;line-height:1.35;overflow-wrap:anywhere}.hl-public-link-copy small{font-size:12px;color:var(--profile-muted);line-height:1.45;overflow-wrap:anywhere}.hl-public-link-external{color:var(--profile-muted);flex:none}
      .hl-public-empty{margin:28px auto 0;padding:25px;border:1px dashed var(--profile-border);border-radius:16px;color:var(--profile-muted);text-align:center;display:grid;justify-items:center;gap:9px}.hl-public-empty p{margin:0;font-size:13px}.hl-public-profile-footer{text-align:center;margin-top:30px}.hl-public-profile-footer a{color:var(--profile-muted);font-size:11px;text-decoration:none}.hl-public-profile-footer b{color:var(--profile-text);font-weight:750}
      @media(max-width:480px){.hl-public-profile{padding:34px 16px 24px}.hl-public-profile-avatar{width:92px;height:92px;margin-bottom:16px}.hl-public-link{min-height:68px;padding:11px 12px}.hl-public-link-icon{width:39px;height:39px}}
      @media(prefers-reduced-motion:reduce){.hl-public-socials a,.hl-public-link{transition:none}}
    `}</style>
  </main>;
}
