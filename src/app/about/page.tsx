import type { Metadata } from 'next';
import { Building2, Target } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata: Metadata = {
  title: 'About Devsolveco - Empowering Developers Through Technical Scale',
  description:
    'Devsolveco is a technical editorial platform focused on software engineering, DevOps, and cloud infrastructure guidance.',
};

export default function AboutPage() {
  return (
    <div className="py-14 md:py-20">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-4xl space-y-10">
          <section className="rounded-2xl border bg-gradient-to-b from-background to-muted/30 p-8 md:p-10">
            <div className="mb-6 inline-flex items-center gap-3 rounded-full border bg-background px-4 py-2 text-sm font-medium text-muted-foreground">
              <Building2 className="h-4 w-4 text-primary" />
              Technical Editorial Platform
            </div>
            <h1 className="text-balance text-3xl font-bold tracking-tight md:text-5xl">
              About Devsolveco - Empowering Developers Through Technical Scale
            </h1>
            <p className="mt-6 text-lg leading-8 text-muted-foreground">
              Welcome to Devsolveco, a premier technical editorial platform dedicated to simplifying
              the complex world of software engineering, DevOps, and cloud infrastructure. Our mission
              is to provide high-quality, algorithmically-driven technical documentation that addresses
              real-world production challenges.
            </p>
          </section>

          <section className="grid gap-6 md:grid-cols-2">
            <Card className="h-full">
              <CardHeader>
                <CardTitle className="text-2xl">Scale and Precision</CardTitle>
              </CardHeader>
              <CardContent className="text-base leading-7 text-muted-foreground">
                With a library of over 500,000 unique technical resources, we bridge the gap between
                complex tool documentation and practical execution. Our platform serves a global audience
                of software engineers, cloud architects, and tech decision-makers who demand precision and depth.
              </CardContent>
            </Card>

            <Card className="h-full">
              <CardHeader>
                <CardTitle className="text-2xl">Quality at High Scale</CardTitle>
              </CardHeader>
              <CardContent className="text-base leading-7 text-muted-foreground">
                At Devsolveco, we believe that high-scale content doesn&apos;t have to sacrifice quality.
                Every page is meticulously structured with expert tips, deep technical context, and
                production-ready examples to ensure our readers move from problem to solution as fast as possible.
              </CardContent>
            </Card>
          </section>

          <Card className="border-primary/20 bg-primary/5">
            <CardHeader className="flex flex-row items-center gap-3 space-y-0">
              <span className="rounded-lg bg-primary/10 p-2">
                <Target className="h-5 w-5 text-primary" />
              </span>
              <CardTitle className="text-xl md:text-2xl">Mission Statement</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-base leading-7 text-muted-foreground">
                Devsolveco empowers technical teams with practical, reliable, and deeply contextual
                resources so engineers can solve production problems faster, make better decisions, and
                scale with confidence.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
