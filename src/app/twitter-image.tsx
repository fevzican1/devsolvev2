import { ImageResponse } from 'next/og';
import { siteConfig } from '@/config/site';

export const runtime = 'edge';
export const alt = 'DevSolve - Browser-based developer tools and technical guides';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export default function TwitterImage() {
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
            'linear-gradient(135deg, #0f172a 0%, #1e293b 40%, #0b1120 100%)',
          color: '#e2e8f0',
          padding: '64px',
          fontFamily: 'ui-sans-serif, system-ui, sans-serif',
        }}
      >
        <div style={{ fontSize: 32, color: '#60a5fa', fontWeight: 700 }}>
          DevSolve
        </div>
        <div style={{ maxWidth: '860px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ fontSize: 58, lineHeight: 1.08, fontWeight: 800 }}>
            Browser-based tools for modern developers
          </div>
          <div style={{ fontSize: 28, color: '#94a3b8', lineHeight: 1.35 }}>
            Fast utilities and practical guides with privacy-first defaults.
          </div>
        </div>
        <div style={{ fontSize: 24, color: '#93c5fd' }}>{siteConfig.siteUrl}</div>
      </div>
    ),
    {
      ...size,
    },
  );
}
