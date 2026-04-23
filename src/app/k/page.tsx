import { ProgrammaticHubPage } from '@/components/programmatic/ProgrammaticHubPage';
import { buildMetadata } from '@/lib/seo/metadata';

export const dynamic = 'force-static';
export const revalidate = false;

export const metadata = buildMetadata({
  title: 'Programmatic Developer Pages',
  description: 'Browse DevSolve’s full programmatic /k library of static developer landing pages without redirects.',
  path: '/k',
  keywords: ['programmatic SEO', 'developer pages', 'static pages', 'developer tools library'],
});

export default function ProgrammaticIndexPage() {
  return <ProgrammaticHubPage />;
}
