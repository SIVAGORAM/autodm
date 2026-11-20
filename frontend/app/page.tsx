import Link from 'next/link';

export const metadata = {
  title: 'Relayo — Instagram auto-DM you can actually trust',
  description: 'Reply to every comment with a DM automatically — with live status, a delivery log, and an alert the moment a connection drops. Reliable Instagram automation for creators and brands.',
};

const C = {
  bg: '#ffffff', soft: '#F5F9F8', softer: '#ECF3F1', line: '#E4ECEA', lineSoft: '#EEF3F2',
  ink: '#0C1D1A', ink2: '#15302B', muted: '#5C7872', faint: '#8AA39D',
  teal: '#12807A', tealD: '#0C5F5A', tealSoft: '#E1F1EF', coral: '#F15F2C', coralSoft: '#FDECE4',
  green: '#16936A', amber: '#C9820C',
};

const S = { wrap: { maxWidth: 1180, margin: '0 auto', padding: '0 32px' } as const };

export default function Home() {
  return (
    <main style={{ background: C.bg, color: C.ink, fontFamily: 'Inter, system-ui, sans-serif', WebkitFontSmoothing: 'antialiased' }}>
      <style>{`
        @keyframes rlp{0%,100%{opacity:.4}50%{opacity:1}}
        .rl-live{animation:rlp 2.4s ease-in-out infinite}
        .rl-l{transition:color .15s}.rl-l:hover{color:${C.ink} !important}
        .rl-b{transition:transform .14s ease, box-shadow .18s ease, filter .14s}
        .rl-b:hover{filter:brightness(1.05);transform:translateY(-1px)}
        .rl-card{transition:transform .2s ease, box-shadow .2s ease}
        .rl-card:hover{transform:translateY(-4px);box-shadow:0 22px 48px -20px rgba(12,29,26,.18)}
        details.rl-faq{border-bottom:1px solid ${C.line}}
        details.rl-faq summary{list-style:none;cursor:pointer;display:flex;justify-content:space-between;align-items:center;padding:22px 2px;font-size:17px;font-weight:600;color:${C.ink}}
        details.rl-faq summary::-webkit-details-marker{display:none}
        details.rl-faq summary .rl-plus{color:${C.teal};font-size:22px;font-weight:400;transition:transform .2s}
        details.rl-faq[open] summary .rl-plus{transform:rotate(45deg)}
        details.rl-faq p{padding:0 2px 22px;color:${C.muted};font-size:15.5px;line-height:1.65;max-width:720px}
        @media(max-width:920px){.rl-hero{grid-template-columns:1fr !important;gap:44px !important}.rl-3{grid-template-columns:1fr !important}.rl-2{grid-template-columns:1fr !important}.rl-split{grid-template-columns:1fr !important}.rl-navlinks{display:none !important}}
      `}</style>

      {/* ───── nav ───── */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 40, background: '#ffffffcc', backdropFilter: 'blur(12px)', borderBottom: `1px solid ${C.line}` }}>
        <div style={{ ...S.wrap, height: 72, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11, fontWeight: 700, fontSize: 21, letterSpacing: '-.5px', color: C.teal }}>
            <span style={{ width: 23, height: 23, borderRadius: '50%', border: `2.5px solid ${C.teal}`, display: 'grid', placeItems: 'center' }}>
              <span className="rl-live" style={{ width: 8, height: 8, borderRadius: '50%', background: C.coral }} />
            </span>relayo
          </div>
          <div className="rl-navlinks" style={{ display: 'flex', alignItems: 'center', gap: 32, fontSize: 15, color: C.muted }}>
            <a href="#why" className="rl-l" style={{ color: C.muted, textDecoration: 'none' }}>Why Relayo</a>
            <a href="#features" className="rl-l" style={{ color: C.muted, textDecoration: 'none' }}>Features</a>
            <a href="#how" className="rl-l" style={{ color: C.muted, textDecoration: 'none' }}>How it works</a>
            <a href="#pricing" className="rl-l" style={{ color: C.muted, textDecoration: 'none' }}>Pricing</a>
            <Link href="/login" className="rl-l" style={{ color: C.muted, textDecoration: 'none' }}>Log in</Link>
            <Link href="/signup" className="rl-b" style={{ background: C.ink, color: '#fff', padding: '10px 18px', borderRadius: 10, fontWeight: 600, textDecoration: 'none' }}>Start free</Link>
          </div>
          <Link href="/signup" className="rl-navlinks" style={{ display: 'none' }}>&nbsp;</Link>
        </div>
      </nav>

      {/* ───── hero ───── */}
      <section style={{ background: `radial-gradient(900px 480px at 82% -10%, ${C.tealSoft} 0%, transparent 58%), radial-gradient(700px 400px at -5% 10%, ${C.coralSoft}66 0%, transparent 50%)`, borderBottom: `1px solid ${C.line}` }}>
        <div style={{ ...S.wrap, padding: '72px 32px 88px' }}>
          <div className="rl-hero" style={{ display: 'grid', gridTemplateColumns: '1.02fr .98fr', gap: 64, alignItems: 'center' }}>
            <div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#fff', border: `1px solid ${C.line}`, borderRadius: 999, padding: '7px 14px', fontSize: 13, fontWeight: 600, color: C.teal, boxShadow: '0 1px 3px rgba(12,29,26,.05)' }}>
                <span className="rl-live" style={{ width: 7, height: 7, borderRadius: '50%', background: C.green }} /> Built on Instagram&rsquo;s official API
              </div>
              <h1 style={{ fontSize: 'clamp(44px,5.6vw,68px)', lineHeight: 1.03, letterSpacing: '-2.4px', fontWeight: 800, margin: '24px 0 0' }}>
                The auto-DM<br />creators actually <span style={{ color: C.teal }}>trust.</span>
              </h1>
              <p style={{ color: C.muted, fontSize: 19.5, lineHeight: 1.6, maxWidth: 500, margin: '24px 0 34px' }}>
                Relayo DMs everyone who comments your keyword &mdash; and shows you every send, flags every failure, and alerts you the second a connection drops. No more guessing if it&rsquo;s working.
              </p>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <Link href="/signup" className="rl-b" style={{ background: C.coral, color: '#fff', padding: '15px 28px', borderRadius: 12, fontWeight: 600, fontSize: 16.5, textDecoration: 'none', boxShadow: '0 12px 28px -10px rgba(241,95,44,.55)' }}>Start free &rarr;</Link>
                <a href="#how" className="rl-b" style={{ background: '#fff', border: `1px solid ${C.line}`, color: C.ink, padding: '15px 28px', borderRadius: 12, fontWeight: 600, fontSize: 16.5, textDecoration: 'none' }}>See how it works</a>
              </div>
              <div style={{ display: 'flex', gap: 30, marginTop: 40, flexWrap: 'wrap' }}>
                {[['Free', 'to start'], ['0', 'DMs lost to silent failures'], ['₹299', 'plans start here']].map(([a, b]) => (
                  <div key={b}><div style={{ fontSize: 27, fontWeight: 700, letterSpacing: '-.8px' }}>{a}</div><div style={{ fontSize: 13, color: C.muted, marginTop: 3 }}>{b}</div></div>
                ))}
              </div>
            </div>
            {/* hero product card */}
            <div style={{ background: '#fff', border: `1px solid ${C.line}`, borderRadius: 22, overflow: 'hidden', boxShadow: '0 50px 100px -40px rgba(12,29,26,.32), 0 2px 10px rgba(12,29,26,.05)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: `1px solid ${C.line}`, background: C.soft }}>
                <span style={{ fontSize: 13.5, fontWeight: 600, color: C.muted }}>Your automations</span>
                <span style={{ fontSize: 12.5, color: C.green, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}><span className="rl-live" style={{ width: 7, height: 7, borderRadius: '50%', background: C.green }} />1,284 sent today</span>
              </div>
              {[
                { n: 'Free guide on my Reel', m: '312 sent · 0 failed · fired 2 min ago', l: 'Healthy', c: C.green, bg: '#E7F5EE' },
                { n: 'Price drop → DM', m: 'Instagram token expired', l: 'Needs reconnect', c: C.coral, bg: C.coralSoft },
                { n: 'Webinar waitlist', m: 'Paused by you', l: 'Paused', c: C.muted, bg: '#EEF2F1' },
              ].map((r) => (
                <div key={r.n} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: `1px solid ${C.line}`, gap: 12 }}>
                  <div style={{ minWidth: 0 }}><div style={{ fontSize: 15, fontWeight: 600 }}>{r.n}</div><div style={{ fontSize: 12.5, color: C.muted, marginTop: 3 }}>{r.m}</div></div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: r.c, background: r.bg, padding: '5px 11px', borderRadius: 999, whiteSpace: 'nowrap' }}>{r.l}</span>
                </div>
              ))}
              <div style={{ padding: '18px 20px' }}>
                <div style={{ fontSize: 12, color: C.muted, marginBottom: 10, fontWeight: 500 }}>DMs sent &middot; last 15 min</div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 48 }}>
                  {[40, 55, 44, 66, 50, 72, 60, 68, 46, 70, 78, 63, 74, 60, 86].map((b, i, a) => (<div key={i} style={{ flex: 1, height: `${b}%`, borderRadius: 3, background: i === a.length - 1 ? C.teal : C.tealSoft }} />))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ───── trust strip ───── */}
      <section style={{ background: C.ink, color: '#fff' }}>
        <div style={{ ...S.wrap, padding: '28px 32px', display: 'flex', flexWrap: 'wrap', gap: 28, alignItems: 'center', justifyContent: 'center', fontSize: 14.5, color: '#A6C4BE' }}>
          {['Meta-verified official API', 'AES-256 encrypted tokens', 'No password sharing', 'T+1 India payouts', 'No per-contact pricing'].map((t, i) => (
            <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
              {i > 0 && <span style={{ color: '#2F4A45' }}>|</span>}
              <span style={{ color: C.coral }}>&#10003;</span>{t}
            </span>
          ))}
        </div>
      </section>

      {/* ───── problem ───── */}
      <section id="why" style={{ background: C.soft, borderBottom: `1px solid ${C.line}` }}>
        <div style={{ ...S.wrap, padding: '92px 32px' }}>
          <div className="rl-split" style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 56, alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: C.coral, letterSpacing: '.2px' }}>The problem nobody fixes</div>
              <h2 style={{ fontSize: 'clamp(30px,4vw,44px)', letterSpacing: '-1.4px', fontWeight: 800, lineHeight: 1.1, margin: '14px 0 0' }}>
                Most auto-DM tools fail in silence.
              </h2>
              <p style={{ color: C.muted, fontSize: 18.5, lineHeight: 1.62, maxWidth: 520, marginTop: 18 }}>
                A token expires. Meta pauses you. A webhook drops. The automation still shows &ldquo;live&rdquo; &mdash; but nothing goes out, and you only notice when the leads stop and the viral moment is gone.
              </p>
              <p style={{ color: C.ink, fontSize: 18.5, fontWeight: 600, marginTop: 18, maxWidth: 520 }}>Relayo is the only one built so that never happens to you quietly.</p>
            </div>
            {/* broken-state mock */}
            <div style={{ background: '#fff', border: `1px solid ${C.coralSoft}`, borderRadius: 18, padding: 22, boxShadow: '0 20px 50px -24px rgba(241,95,44,.22)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, color: C.coral, fontWeight: 600, fontSize: 14 }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: C.coral }} /> Break detected &middot; just now
              </div>
              <div style={{ fontSize: 15.5, fontWeight: 600 }}>Your automation on @yourbrand stopped sending.</div>
              <div style={{ background: C.coralSoft, color: '#B4411F', borderRadius: 10, padding: '11px 14px', fontSize: 13.5, margin: '14px 0' }}>Instagram token expired &mdash; reconnect to resume.</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <span style={{ background: C.coral, color: '#fff', padding: '9px 16px', borderRadius: 9, fontSize: 13.5, fontWeight: 600 }}>Reconnect @yourbrand</span>
                <span style={{ border: `1px solid ${C.line}`, color: C.muted, padding: '9px 16px', borderRadius: 9, fontSize: 13.5 }}>View log</span>
              </div>
              <div style={{ fontSize: 12.5, color: C.faint, marginTop: 14 }}>Sent to you by email, the second it broke.</div>
            </div>
          </div>
        </div>
      </section>

      {/* ───── features ───── */}
      <section id="features">
        <div style={{ ...S.wrap, padding: '92px 32px' }}>
          <div style={{ textAlign: 'center', maxWidth: 640, margin: '0 auto 56px' }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: C.teal }}>What you get</div>
            <h2 style={{ fontSize: 'clamp(30px,4vw,44px)', letterSpacing: '-1.4px', fontWeight: 800, marginTop: 12, lineHeight: 1.1 }}>Everything that proves it&rsquo;s working</h2>
          </div>
          <div className="rl-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 22 }}>
            {[
              { k: 'Live status', dot: C.green, d: 'Every automation reads Healthy, Needs reconnect, or Paused. Green means a comment right now gets its DM. No more wondering.' },
              { k: 'Delivery log', dot: C.teal, d: 'A receipt for every run &mdash; matched, sent, skipped or failed, with the exact reason. Full visibility into every DM.' },
              { k: 'Instant break alerts', dot: C.coral, d: 'The moment a token expires or Meta pauses you, we email you with a one-tap reconnect &mdash; before a single lead is lost.' },
            ].map((f) => (
              <div key={f.k} className="rl-card" style={{ background: '#fff', border: `1px solid ${C.line}`, borderRadius: 18, padding: 30, boxShadow: '0 1px 3px rgba(12,29,26,.04)' }}>
                <span style={{ width: 12, height: 12, borderRadius: '50%', background: f.dot, display: 'inline-block' }} />
                <h3 style={{ fontSize: 21, fontWeight: 700, margin: '18px 0 10px', letterSpacing: '-.4px' }}>{f.k}</h3>
                <p style={{ color: C.muted, fontSize: 15.5, lineHeight: 1.62 }} dangerouslySetInnerHTML={{ __html: f.d }} />
              </div>
            ))}
          </div>
          {/* secondary features row */}
          <div className="rl-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 22, marginTop: 22 }}>
            {[
              ['Comment, Story, Live & DM triggers', 'Fire on any surface Instagram offers.'],
              ['Follow-ups within 24h', 'Nudge people who didn’t click or reply.'],
              ['Personalized DMs', 'Drop in the commenter’s name automatically.'],
              ['Public reply + button cards', 'Reply under the comment and send rich buttons.'],
              ['Up to 5 accounts', 'Run agencies and multiple brands from one login.'],
              ['Flat, honest pricing', 'Unlimited contacts. Your viral reel never spikes the bill.'],
            ].map(([t, d]) => (
              <div key={t} style={{ display: 'flex', gap: 12, padding: '8px 4px' }}>
                <span style={{ color: C.teal, fontSize: 18, lineHeight: '24px' }}>&#10003;</span>
                <div><div style={{ fontWeight: 600, fontSize: 15.5 }}>{t}</div><div style={{ color: C.muted, fontSize: 14, marginTop: 3 }}>{d}</div></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───── how ───── */}
      <section id="how" style={{ background: C.soft, borderTop: `1px solid ${C.line}`, borderBottom: `1px solid ${C.line}` }}>
        <div style={{ ...S.wrap, padding: '92px 32px' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: C.teal }}>How it works</div>
            <h2 style={{ fontSize: 'clamp(30px,4vw,44px)', letterSpacing: '-1.4px', fontWeight: 800, marginTop: 12 }}>Live in under a minute</h2>
          </div>
          <div className="rl-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 28, marginTop: 56 }}>
            {[
              ['Connect Instagram', 'Link your professional account through Meta. No password sharing, official API only.'],
              ['Set a trigger & keyword', 'Pick a post or Reel, choose the keyword, write the DM and buttons in a 3-step builder.'],
              ['Go live & watch it work', 'Every matching comment gets your DM instantly — and you watch each one land, live.'],
            ].map(([t, d], i) => (
              <div key={t} style={{ background: '#fff', border: `1px solid ${C.line}`, borderRadius: 18, padding: 30 }}>
                <div style={{ width: 44, height: 44, borderRadius: 13, background: C.tealSoft, color: C.teal, display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 18 }}>{i + 1}</div>
                <h3 style={{ fontSize: 19, fontWeight: 700, marginTop: 18, letterSpacing: '-.3px' }}>{t}</h3>
                <p style={{ color: C.muted, fontSize: 15.5, marginTop: 8, lineHeight: 1.6 }}>{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───── pricing ───── */}
      <section id="pricing">
        <div style={{ maxWidth: 1120, margin: '0 auto', padding: '92px 32px' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: C.teal }}>Pricing</div>
            <h2 style={{ fontSize: 'clamp(30px,4vw,44px)', letterSpacing: '-1.4px', fontWeight: 800, marginTop: 12 }}>Simple plans that scale with you.</h2>
            <p style={{ color: C.muted, fontSize: 17.5, maxWidth: 540, margin: '14px auto 0', lineHeight: 1.6 }}>Start free. Every paid plan begins with a 2-day full-Pro trial — upgrade when you&rsquo;re ready.</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 18, marginTop: 52 }}>
            {[
              { name: 'Free', price: '₹0', per: '', sub: 'For getting started.', popular: false, cta: 'Start free', items: ['1 Instagram account', '1 keyword per automation', '150 DMs / month', 'Post & Reel triggers', 'Live status + delivery log'] },
              { name: 'Creator', price: '₹299', per: ' /mo', sub: 'For growing creators.', popular: false, cta: 'Start free trial', items: ['2 Instagram accounts', 'Up to 5 keywords', '2,000 DMs / month', 'Stories, Lives & DMs', 'Follow-ups & ask-to-follow'] },
              { name: 'Pro', price: '₹599', per: ' /mo', sub: 'For serious businesses.', popular: true, cta: 'Start free trial', items: ['5 Instagram accounts', 'Unlimited keywords', '10,000 DMs / month', 'Advanced workflows', 'Lead collection & export'] },
              { name: 'Agency', price: '₹1,499', per: ' /mo', sub: 'For teams & agencies.', popular: false, cta: 'Start free trial', items: ['15 Instagram accounts', 'Unlimited keywords', '50,000 DMs / month', 'Client workspaces', 'Team access & reports'] },
            ].map((p) => (
              <div key={p.name} style={{ background: '#fff', border: p.popular ? `2px solid ${C.teal}` : `1px solid ${C.line}`, borderRadius: 20, padding: 28, position: 'relative', boxShadow: p.popular ? '0 28px 56px -26px rgba(18,128,122,.4)' : undefined }}>
                {p.popular && <span style={{ position: 'absolute', top: -13, left: 28, background: C.teal, color: '#fff', fontSize: 12, fontWeight: 700, padding: '5px 13px', borderRadius: 999 }}>Most popular</span>}
                <div style={{ fontSize: 16, fontWeight: 700 }}>{p.name}</div>
                <div style={{ fontSize: 38, fontWeight: 800, letterSpacing: '-1.6px', margin: '8px 0' }}>{p.price}<span style={{ fontSize: 15, color: C.muted, fontWeight: 500 }}>{p.per}</span></div>
                <div style={{ color: C.muted, fontSize: 13.5, marginBottom: 18 }}>{p.sub}</div>
                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 26px', display: 'grid', gap: 10 }}>
                  {p.items.map((x) => (<li key={x} style={{ color: C.ink, fontSize: 14, display: 'flex', gap: 9 }}><span style={{ color: C.teal, fontWeight: 700 }}>&#10003;</span>{x}</li>))}
                </ul>
                <Link href="/signup" className="rl-b" style={{ display: 'block', textAlign: 'center', background: p.popular ? C.teal : '#fff', color: p.popular ? '#fff' : C.ink, border: p.popular ? 'none' : `1px solid ${C.line}`, padding: '13px', borderRadius: 12, fontWeight: 600, textDecoration: 'none' }}>{p.cta}</Link>
              </div>
            ))}
          </div>
          <p style={{ color: C.muted, fontSize: 13, textAlign: 'center', marginTop: 24 }}>Prices in INR &middot; 2-day free trial on every plan &middot; Cancel anytime</p>
        </div>
      </section>

      {/* ───── faq ───── */}
      <section style={{ background: C.soft, borderTop: `1px solid ${C.line}` }}>
        <div style={{ maxWidth: 820, margin: '0 auto', padding: '92px 32px' }}>
          <h2 style={{ fontSize: 'clamp(28px,3.6vw,40px)', letterSpacing: '-1.2px', fontWeight: 800, textAlign: 'center', marginBottom: 40 }}>Questions, answered</h2>
          {[
            ['Is this safe for my Instagram account?', 'Yes. Relayo uses Instagram’s official Meta API with proper login — no password sharing and no browser bots. Your access token is encrypted at rest with AES-256.'],
            ['What makes Relayo different from ManyChat or SuperProfile?', 'Reliability you can see. Other tools fail silently; Relayo shows live status on every automation, logs every DM, and emails you the moment a connection drops — before you lose leads.'],
            ['Does pricing go up as my audience grows?', 'Your price depends on the plan you pick, not your follower count. Each plan includes a monthly DM volume — upgrade only when you outgrow it.'],
            ['Which triggers are supported?', 'Comments on posts and Reels, Story replies, Live comments, and incoming DMs — with keyword or any-comment matching.'],
            ['Can I run multiple accounts or clients?', 'Yes. Plans scale from 2 accounts on Creator up to 15 on Agency, all under one login — built for creators and agencies.'],
          ].map(([q, a]) => (
            <details key={q} className="rl-faq"><summary>{q}<span className="rl-plus">+</span></summary><p>{a}</p></details>
          ))}
        </div>
      </section>

      {/* ───── final cta ───── */}
      <section>
        <div style={{ ...S.wrap, padding: '36px 32px 64px' }}>
          <div style={{ background: `linear-gradient(150deg, ${C.ink} 0%, ${C.ink2} 100%)`, borderRadius: 30, padding: '80px 32px', textAlign: 'center', color: '#fff', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: -80, right: -40, width: 280, height: 280, borderRadius: '50%', background: 'rgba(18,128,122,.3)', filter: 'blur(100px)' }} />
            <h2 style={{ fontSize: 'clamp(32px,4.6vw,52px)', letterSpacing: '-1.6px', fontWeight: 800, lineHeight: 1.08, position: 'relative' }}>Stop guessing. Start knowing.</h2>
            <p style={{ color: '#A6C4BE', fontSize: 18.5, margin: '16px auto 32px', maxWidth: 480, position: 'relative' }}>Set up your first automation free, and never wonder if your auto-DM fired again.</p>
            <Link href="/signup" className="rl-b" style={{ display: 'inline-block', background: C.coral, color: '#fff', padding: '16px 34px', borderRadius: 14, fontWeight: 600, fontSize: 17, textDecoration: 'none', position: 'relative' }}>Start free &rarr;</Link>
          </div>
        </div>
      </section>

      {/* ───── footer ───── */}
      <footer style={{ borderTop: `1px solid ${C.line}`, background: C.bg }}>
        <div style={{ ...S.wrap, padding: '56px 32px 40px' }}>
          <div className="rl-split" style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1fr', gap: 32 }}>
            <div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, color: C.teal, fontWeight: 700, fontSize: 19 }}>
                <span style={{ width: 20, height: 20, borderRadius: '50%', border: `2.5px solid ${C.teal}`, display: 'grid', placeItems: 'center' }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: C.coral }} /></span>relayo
              </div>
              <p style={{ color: C.muted, fontSize: 14.5, marginTop: 12, maxWidth: 260, lineHeight: 1.6 }}>Reliable Instagram auto-DM for creators and brands who can&rsquo;t afford to miss a lead.</p>
            </div>
            {[['Product', ['Features', 'Pricing', 'How it works']], ['Company', ['About', 'Blog', 'Contact']], ['Legal', ['Privacy', 'Terms', 'Refunds']]].map(([h, items]) => (
              <div key={h as string}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.ink, textTransform: 'none', marginBottom: 14 }}>{h as string}</div>
                {(items as string[]).map((it) => (<div key={it} style={{ fontSize: 14.5, color: C.muted, marginBottom: 10 }}>{it}</div>))}
              </div>
            ))}
          </div>
          <div style={{ borderTop: `1px solid ${C.line}`, marginTop: 40, paddingTop: 24, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, fontSize: 13, color: C.faint }}>
            <span>&copy; 2026 Relayo. All rights reserved.</span>
            <span style={{ maxWidth: 560, textAlign: 'right' }}>Relayo is an independent product, not affiliated with or endorsed by Instagram or Meta. Instagram is a trademark of Meta Platforms, Inc.</span>
          </div>
        </div>
      </footer>
    </main>
  );
}
