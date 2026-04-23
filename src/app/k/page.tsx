import { ProgrammaticHubPage } from '@/components/programmatic/ProgrammaticHubPage';
import { buildMetadata } from '@/lib/seo/metadata';
import { PROGRAMMATIC_HUB_METADATA } from '@/lib/programmatic/metadata';

export const dynamic = 'force-static';
export const revalidate = false;

export const metadata = buildMetadata(PROGRAMMATIC_HUB_METADATA);

export default function ProgrammaticIndexPage() {
  return <ProgrammaticHubPage />;
}
