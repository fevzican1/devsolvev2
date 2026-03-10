import Link from 'next/link';
import { FileQuestion, Home, Wrench, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="container mx-auto px-4 py-20">
      <div className="max-w-md mx-auto text-center">
        <FileQuestion className="h-16 w-16 text-muted-foreground mx-auto mb-6" />
        <h1 className="text-4xl font-bold mb-4">404</h1>
        <p className="text-xl text-muted-foreground mb-8">
          Page not found. The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button asChild>
            <Link href="/">
              <Home className="mr-2 h-4 w-4" />
              Go Home
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/tools">
              <Wrench className="mr-2 h-4 w-4" />
              Browse Tools
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/guides">
              <FileText className="mr-2 h-4 w-4" />
              Read Guides
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
