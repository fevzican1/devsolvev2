import type { Metadata } from 'next';
import { buildMetadata } from '@/lib/seo/metadata';
import { CmdCenterPageClient } from '@/components/cmd-center/CmdCenterPageClient';

export const metadata: Metadata = buildMetadata({
  title: 'Command Center',
  description: 'Internal operations dashboard.',
  path: '/cmd-center',
  noindex: true,
});

export default function CmdCenterPage() {
  return <CmdCenterPageClient />;
}
