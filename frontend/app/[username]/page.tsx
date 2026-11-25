import type { Metadata } from 'next';
import { cache } from 'react';
import { notFound, redirect } from 'next/navigation';
import { ExternalLink, Link2, CheckCircle } from 'lucide-react';
import { getPublicSiteUrl } from '../../lib/site-url';
import { resolveApiBase } from '../../lib/api-url-policy.cjs';
import { ProfileFavicon } from '../../components/profile-favicon';
import { ProfileAvatar } from '../../components/profile-avatar';
import { ProfileReportForm } from '../../components/profile-report-form';
import { SocialIcon } from '../../components/social-icons';

type PublicLink = {
  id: string;
  kind: 'SOCIAL' | 'CUSTOM';
  platform: string | null;
  title: string;
  url: string;
  description: string | null;
  sortOrder: number;
};

type PublicProfile = {
  username: string;
  displayName: string;
  bio: string | null;
  appearance: 'LIGHT' | 'DARK' | 'NEUTRAL';
  avatarUrl: string | null;
  links: PublicLink[];
  redirectTo?: string | null;
};

const API_BASE = resolveApiBase(process.env.NEXT_PUBLIC_API_URL, {
  production: process.env.NODE_ENV === 'production',
}) as string;

const loadProfile = cache(async (username: string): Promise<PublicProfile | null> => {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}/api/public/profiles/${encodeURIComponent(username)}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(5_000),
    });
  } catch {
    throw new Error('The public profile service is temporarily unavailable.');
  }
  if (response.status === 404) return null;
  if (!response.ok) throw new Error('The public profile service is temporarily unavailable.');
  try {
    return (await response.json()) as PublicProfile;
  } catch {
    throw new Error('The public profile service returned an invalid response.');
  }
});

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }): Promise<Metadata> {
  const { username } = await params;
  const profile = await loadProfile(username);
  if (!profile || profile.redirectTo) {
    return { title: 'Profile not found | HeyLaunch', robots: { index: false, follow: false } };
  }
  const title = `${profile.displayName} (@${profile.username}) | HeyLaunch`;
  const description = profile.bio?.slice(0, 160) || `Explore ${profile.displayName}'s official links and social profiles.`;
  const canonical = new URL(`/${encodeURIComponent(profile.username)}`, getPublicSiteUrl()).toString();
  return {
    title,
    description,
    alternates: { canonical },
    robots: { index: true, follow: true },
    openGraph: {
      type: 'profile',
      title,
      description,
      url: canonical,
      images: profile.avatarUrl ? [{ url: profile.avatarUrl, alt: `${profile.displayName} profile photo` }] : [],
    },
    twitter: {
      card: profile.avatarUrl ? 'summary_large_image' : 'summary',
      title,
      description,
      images: profile.avatarUrl ? [profile.avatarUrl] : [],
    },
  };
}

export default async function PublicProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const profile = await loadProfile(username);
  if (!profile) notFound();

  if (profile.redirectTo) redirect(`/${encodeURIComponent(profile.redirectTo)}`);

  const socials = profile.links.filter((link) => link.kind === 'SOCIAL').sort((a, b) => a.sortOrder - b.sortOrder);
  const customLinks = profile.links.filter((link) => link.kind === 'CUSTOM').sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <main className={`hl-public-profile ${profile.appearance.toLowerCase()}`}>
      <div className="hl-public-profile-shell">
        {/* Profile Header */}
        <header className="hl-public-profile-header">
          <div className="hl-avatar-container">
            <ProfileAvatar
              src={profile.avatarUrl}
              name={profile.displayName}
              className="hl-public-profile-avatar"
              width={112}
              height={112}
            />
          </div>
          
          <div className="hl-name-row">
            <h1>{profile.displayName}</h1>
            <CheckCircle className="hl-verified-badge" size={20} fill="#bbf444" stroke="#0a0c0e" aria-label="Verified Creator" />
          </div>

          <p className="hl-public-profile-username">@{profile.username}</p>

          {profile.bio && <p className="hl-public-profile-bio">{profile.bio}</p>}
        </header>

        {/* Social Icons Dock */}
        {socials.length > 0 && (
          <nav className="hl-public-socials" aria-label="Social profiles">
            {socials.map((link) => (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer nofollow"
                aria-label={link.title}
                title={link.title}
                className="hl-social-btn"
              >
                <SocialIcon platform={link.platform || link.title} size={19} />
              </a>
            ))}
          </nav>
        )}

        {/* Featured Custom Links */}
        {customLinks.length > 0 && (
          <section className="hl-public-links" aria-label="Featured links">
            {customLinks.map((link) => (
              <a
                key={link.id}
                className="hl-public-link"
                href={link.url}
                target="_blank"
                rel="noopener noreferrer nofollow"
              >
                <span className="hl-public-link-icon">
                  <ProfileFavicon url={link.url} />
                </span>
                <span className="hl-public-link-copy">
                  <strong>{link.title}</strong>
                  {link.description && <small>{link.description}</small>}
                </span>
                <span className="hl-public-link-arrow">
                  <ExternalLink size={16} aria-hidden />
                </span>
              </a>
            ))}
          </section>
        )}

        {/* Empty state */}
        {socials.length === 0 && customLinks.length === 0 && (
          <div className="hl-public-empty">
            <Link2 size={24} aria-hidden />
            <p>This creator has not added any public links yet.</p>
          </div>
        )}

        {/* Footer */}
        <footer className="hl-public-profile-footer">
          <a href={getPublicSiteUrl().toString()} rel="noopener noreferrer" className="hl-footer-brand">
            Powered by <b>HeyLaunch</b>
          </a>
          <ProfileReportForm username={profile.username} />
        </footer>
      </div>

      <style>{`
        .hl-public-profile {
          --profile-bg: #f8fafc;
          --profile-text: #0f172a;
          --profile-muted: #64748b;
          --profile-card-bg: #ffffff;
          --profile-card-border: #e2e8f0;
          --profile-card-hover: #f1f5f9;
          --profile-accent: #84cc16;
          --profile-accent-glow: rgba(132, 204, 22, 0.18);
          --profile-shadow: 0 4px 20px -2px rgba(15, 23, 42, 0.06), 0 2px 6px -1px rgba(15, 23, 42, 0.04);
          --profile-shadow-hover: 0 12px 28px -4px rgba(15, 23, 42, 0.12), 0 4px 10px -2px rgba(15, 23, 42, 0.06);

          min-height: 100svh;
          display: flex;
          justify-content: center;
          align-items: flex-start;
          padding: 56px 20px 40px;
          background: 
            radial-gradient(circle at 50% 0%, var(--profile-accent-glow) 0%, transparent 60%),
            var(--profile-bg);
          color: var(--profile-text);
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          transition: background 0.3s ease, color 0.3s ease;
        }

        .hl-public-profile.dark {
          --profile-bg: #090d16;
          --profile-text: #f8fafc;
          --profile-muted: #94a3b8;
          --profile-card-bg: rgba(26, 32, 44, 0.75);
          --profile-card-border: rgba(255, 255, 255, 0.08);
          --profile-card-hover: rgba(36, 44, 60, 0.9);
          --profile-accent: #a3e635;
          --profile-accent-glow: rgba(163, 230, 53, 0.14);
          --profile-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
          --profile-shadow-hover: 0 16px 40px 0 rgba(0, 0, 0, 0.5);
          background: 
            radial-gradient(ellipse at 50% -10%, #172a14 0%, transparent 55%),
            radial-gradient(circle at 80% 30%, #101c2e 0%, transparent 40%),
            var(--profile-bg);
        }

        .hl-public-profile.neutral {
          --profile-bg: #f4f2ec;
          --profile-text: #1c1917;
          --profile-muted: #78716c;
          --profile-card-bg: #faf9f6;
          --profile-card-border: #e7e5e0;
          --profile-card-hover: #f0eee8;
          --profile-accent: #65a30d;
          --profile-accent-glow: rgba(101, 163, 13, 0.15);
          --profile-shadow: 0 4px 20px -2px rgba(28, 25, 23, 0.05);
          --profile-shadow-hover: 0 10px 24px -3px rgba(28, 25, 23, 0.09);
          background: 
            radial-gradient(circle at 50% 0%, #e2eed1 0%, transparent 50%),
            var(--profile-bg);
        }

        .hl-public-profile-shell {
          width: 100%;
          max-width: 540px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
        }

        .hl-public-profile-header {
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .hl-avatar-container {
          position: relative;
          margin-bottom: 18px;
        }

        .hl-public-profile-avatar {
          width: 108px;
          height: 108px;
          border-radius: 50%;
          object-fit: cover;
          border: 4px solid var(--profile-card-bg);
          box-shadow: 0 8px 24px -4px rgba(0, 0, 0, 0.15);
          transition: transform 0.25s ease;
        }

        .hl-public-profile-avatar:hover {
          transform: scale(1.03);
        }

        .hl-public-profile-avatar.fallback {
          display: grid;
          place-items: center;
          background: linear-gradient(135deg, #bbf444 0%, #84cc16 100%);
          color: #0f172a;
          font-size: 40px;
          font-weight: 800;
        }

        .hl-name-row {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          margin: 0;
        }

        .hl-name-row h1 {
          font-size: clamp(22px, 5.5vw, 28px);
          font-weight: 800;
          letter-spacing: -0.6px;
          line-height: 1.2;
          margin: 0;
          overflow-wrap: anywhere;
        }

        .hl-verified-badge {
          flex-shrink: 0;
        }

        .hl-public-profile-username {
          color: var(--profile-muted);
          font-size: 13.5px;
          font-weight: 500;
          margin: 6px 0 0;
        }

        .hl-public-profile-bio {
          font-size: 14.5px;
          line-height: 1.6;
          color: var(--profile-text);
          opacity: 0.9;
          margin: 14px auto 0;
          max-width: 440px;
          white-space: pre-wrap;
          overflow-wrap: anywhere;
        }

        /* Social Icons Dock */
        .hl-public-socials {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 12px;
          margin: 22px auto 0;
          flex-wrap: wrap;
        }

        .hl-social-btn {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          border: 1px solid var(--profile-card-border);
          background: var(--profile-card-bg);
          color: var(--profile-text);
          display: grid;
          place-items: center;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
          transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s ease, border-color 0.2s ease;
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
        }

        .hl-social-btn:hover {
          transform: translateY(-3px) scale(1.06);
          border-color: var(--profile-accent);
          box-shadow: 0 8px 16px -2px rgba(0, 0, 0, 0.12);
        }

        /* Link Cards */
        .hl-public-links {
          display: grid;
          gap: 12px;
          margin: 28px 0 0;
          width: 100%;
        }

        .hl-public-link {
          min-height: 64px;
          padding: 14px 18px;
          display: flex;
          align-items: center;
          gap: 15px;
          border: 1px solid var(--profile-card-border);
          border-radius: 18px;
          background: var(--profile-card-bg);
          color: var(--profile-text);
          text-decoration: none;
          box-shadow: var(--profile-shadow);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s ease, border-color 0.2s ease, background 0.2s ease;
        }

        .hl-public-link:hover {
          transform: translateY(-2px) scale(1.01);
          border-color: color-mix(in srgb, var(--profile-accent) 60%, var(--profile-card-border));
          box-shadow: var(--profile-shadow-hover);
          background: var(--profile-card-hover);
        }

        .hl-public-link-icon {
          width: 42px;
          height: 42px;
          border-radius: 13px;
          background: color-mix(in srgb, var(--profile-accent) 18%, var(--profile-card-bg));
          display: grid;
          place-items: center;
          flex-shrink: 0;
          border: 1px solid color-mix(in srgb, var(--profile-accent) 25%, transparent);
          color: var(--profile-text);
          transition: transform 0.2s ease;
        }

        .hl-public-link:hover .hl-public-link-icon {
          transform: scale(1.06);
        }

        .hl-public-link-copy {
          min-width: 0;
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .hl-public-link-copy strong {
          font-size: 14.5px;
          font-weight: 700;
          line-height: 1.3;
          overflow-wrap: anywhere;
        }

        .hl-public-link-copy small {
          font-size: 12px;
          color: var(--profile-muted);
          line-height: 1.4;
          overflow-wrap: anywhere;
        }

        .hl-public-link-arrow {
          color: var(--profile-muted);
          flex-shrink: 0;
          transition: transform 0.2s ease, color 0.2s ease;
        }

        .hl-public-link:hover .hl-public-link-arrow {
          transform: translate(2px, -2px);
          color: var(--profile-text);
        }

        /* Empty state */
        .hl-public-empty {
          margin: 32px 0 0;
          padding: 36px 20px;
          border: 1.5px dashed var(--profile-card-border);
          border-radius: 20px;
          color: var(--profile-muted);
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
        }

        .hl-public-empty p {
          margin: 0;
          font-size: 13.5px;
        }

        /* Footer */
        .hl-public-profile-footer {
          text-align: center;
          margin-top: 40px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
        }

        .hl-footer-brand {
          font-size: 12px;
          color: var(--profile-muted);
          text-decoration: none;
          letter-spacing: -0.2px;
          transition: color 0.2s ease;
        }

        .hl-footer-brand:hover {
          color: var(--profile-text);
        }

        .hl-footer-brand b {
          font-weight: 800;
          color: var(--profile-text);
        }

        @media (max-width: 480px) {
          .hl-public-profile {
            padding: 36px 16px 28px;
          }
          .hl-public-profile-avatar {
            width: 96px;
            height: 96px;
          }
          .hl-public-link {
            min-height: 60px;
            padding: 12px 14px;
            gap: 12px;
          }
          .hl-public-link-icon {
            width: 38px;
            height: 38px;
          }
        }
      `}</style>
    </main>
  );
}
