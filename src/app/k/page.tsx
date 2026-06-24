import { ProgrammaticHubPage } from '@/components/programmatic/ProgrammaticHubPage';
import { buildMetadata } from '@/lib/seo/metadata';
import { PROGRAMMATIC_HUB_METADATA } from '@/lib/programmatic/metadata';

export const dynamic = 'force-static';

// Pure SSG — see src/config/staticGeneration.ts for edge ISR on long-tail /k/* routes.

export const metadata = buildMetadata(PROGRAMMATIC_HUB_METADATA);

export default function ProgrammaticIndexPage() {
  return <ProgrammaticHubPage />;
}
