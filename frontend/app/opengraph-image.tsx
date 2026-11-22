import { ImageResponse } from 'next/og';

export const alt = 'HeyLaunch turns Instagram comments into creator conversations';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '64px 72px',
          overflow: 'hidden',
          color: '#f7f5fa',
          background: 'linear-gradient(125deg, #0d0a14 0%, #171222 58%, #241b35 100%)',
          fontFamily: 'Arial, sans-serif',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', width: 650, zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 68 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, transform: 'rotate(-25deg)' }}>
              <span style={{ width: 16, height: 16, borderRadius: 6, background: '#b9f500' }} />
              <span style={{ width: 16, height: 16, borderRadius: 6, background: '#8b6cf0' }} />
              <span style={{ width: 16, height: 16, borderRadius: 6, background: '#ff9ec2' }} />
            </div>
            <span style={{ fontSize: 28, fontWeight: 700, letterSpacing: -1 }}>HeyLaunch</span>
            <span style={{ marginLeft: 8, border: '1px solid #453b57', borderRadius: 999, padding: '8px 14px', color: '#c4b5fd', fontSize: 14 }}>
              FOR CREATORS
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', fontSize: 66, lineHeight: 1.04, letterSpacing: -3, fontWeight: 750 }}>
            <span>Turn comments into</span>
            <span style={{ color: '#b9f500' }}>conversations.</span>
          </div>
          <p style={{ marginTop: 24, color: '#bbb3c9', fontSize: 23, lineHeight: 1.4 }}>
            Thoughtful Instagram comment-to-DM automation, built for creators.
          </p>
          <div style={{ display: 'flex', gap: 12, marginTop: 30 }}>
            {['Keyword triggers', 'Personalized DMs', 'Delivery visibility'].map((label) => (
              <span key={label} style={{ padding: '11px 15px', borderRadius: 999, background: '#ffffff0d', border: '1px solid #ffffff1a', color: '#e9e4f1', fontSize: 15 }}>
                {label}
              </span>
            ))}
          </div>
        </div>

        <div style={{ position: 'relative', width: 340, height: 390, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ position: 'absolute', width: 350, height: 350, borderRadius: 175, background: '#8b6cf01f', border: '1px solid #8b6cf044' }} />
          <div style={{ position: 'absolute', right: 6, top: 40, width: 230, padding: 20, borderRadius: 22, background: '#211b2c', border: '1px solid #463a57', boxShadow: '0 24px 60px #00000055', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <span style={{ color: '#b9f500', fontSize: 14, fontWeight: 700 }}>COMMENT MATCHED</span>
            <span style={{ color: '#f7f5fa', fontSize: 18 }}>“GUIDE” on your post</span>
          </div>
          <div style={{ position: 'absolute', left: 0, bottom: 38, width: 280, padding: 22, borderRadius: 24, background: '#f7f5fa', color: '#171222', border: '1px solid #ffffff', boxShadow: '0 28px 70px #00000066', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <span style={{ color: '#756b83', fontSize: 14, fontWeight: 700 }}>A PERSONAL DM</span>
            <span style={{ fontSize: 20, lineHeight: 1.35 }}>Thanks for reaching out! Here’s the guide you asked for.</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#4b6800', fontSize: 15, fontWeight: 700 }}>
              <span style={{ width: 10, height: 10, borderRadius: 5, background: '#8bb900' }} />
              Ready to send
            </span>
          </div>
          <div style={{ position: 'absolute', right: 4, bottom: 2, width: 60, height: 60, borderRadius: 20, background: '#b9f500', transform: 'rotate(12deg)' }} />
        </div>
      </div>
    ),
    { ...size },
  );
}
