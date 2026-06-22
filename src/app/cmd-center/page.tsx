import type { Metadata } from 'next';
import { buildMetadata } from '@/lib/seo/metadata';
import { CmdCenterPageClient } from '@/components/cmd-center/CmdCenterPageClient';

const baseMetadata = buildMetadata({
  title: 'Command Center',
  description:
    'Internal DevSolve operations dashboard for monitoring site health, indexing status, and deployment metrics. Not intended for public search indexing.',
  path: '/cmd-center',
});

export const metadata: Metadata = {
  ...baseMetadata,
  robots: {
    index: false,
    follow: true,
    googleBot: {
      index: false,
      follow: true,
    },
  },
};


export default function CmdCenterPage() {
  return <CmdCenterPageClient />;
}
