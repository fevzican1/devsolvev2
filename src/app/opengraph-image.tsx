import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'DevSolve - Browser-based developer tools and technical guides';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background:
            'radial-gradient(circle at 20% 20%, #1d4ed8 0%, #0f172a 50%, #020617 100%)',
          color: '#f8fafc',
          padding: '64px',
          fontFamily: 'ui-sans-serif, system-ui, sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '34px', fontWeight: 700 }}>
          <span style={{ color: '#93c5fd' }}>{'<>'}</span>
          DevSolve
        </div>
        <div style={{ maxWidth: '860px', display: 'flex', flexDirection: 'column', gap: '22px' }}>
          <div style={{ fontSize: 62, lineHeight: 1.08, fontWeight: 800 }}>
            Developer tools that keep your data local
          </div>
          <div style={{ fontSize: 30, color: '#cbd5e1', lineHeight: 1.35 }}>
            Format, validate, encode, and debug directly in the browser.
          </div>
        </div>
        <div style={{ fontSize: 24, color: '#93c5fd' }}>devsolvev2.com</div>
      </div>
    ),
    {
      ...size,
    },
  );
}
