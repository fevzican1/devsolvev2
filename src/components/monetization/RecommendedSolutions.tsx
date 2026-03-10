'use client';

import { ExternalLink, Info } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { monetizationConfig, isMonetizationConfigured, getOffersForTool } from '@/config/monetization';
import { buildAffiliateUrl } from '@/lib/monetization/urlBuilder';

interface RecommendedSolutionsProps {
  toolSlug?: string;
  clusterKey?: string;
}

export function RecommendedSolutions({ toolSlug, clusterKey }: RecommendedSolutionsProps) {
  const isConfigured = isMonetizationConfigured();

  if (!isConfigured) {
    return (
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Info className="h-5 w-5 text-muted-foreground" />
            Recommended Solutions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Recommended solutions coming soon. We&apos;re evaluating options to suggest
            relevant tools and services that complement this functionality.
          </p>
        </CardContent>
      </Card>
    );
  }

  const offers = toolSlug ? getOffersForTool(toolSlug) : [];

  if (offers.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Recommended Solutions</CardTitle>
        <CardDescription>
          {monetizationConfig.disclosure.shortDisclosure}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {offers.slice(0, 2).map((offer) => {
          const program = monetizationConfig.affiliatePrograms.find(p => p.id === offer.programId);
          if (!program || !program.enabled) return null;

          const urlResult = buildAffiliateUrl({
            programId: offer.programId,
            toolSlug,
          });

          return (
            <div key={offer.id} className="p-4 rounded-lg border bg-muted/50">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h4 className="font-medium">{offer.title}</h4>
                  <p className="text-sm text-muted-foreground">{offer.shortDescription}</p>
                </div>
                <Badge variant="outline">{program.category}</Badge>
              </div>

              <div className="mt-3">
                <h5 className="text-xs font-medium text-muted-foreground mb-1">Features:</h5>
                <ul className="text-xs text-muted-foreground space-y-1">
                  {program.features.slice(0, 3).map((feature, index) => (
                    <li key={index}>- {feature}</li>
                  ))}
                </ul>
              </div>

              {program.limitations.length > 0 && (
                <div className="mt-2">
                  <h5 className="text-xs font-medium text-muted-foreground mb-1">Considerations:</h5>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    {program.limitations.slice(0, 2).map((limitation, index) => (
                      <li key={index}>- {limitation}</li>
                    ))}
                  </ul>
                </div>
              )}

              <Button
                asChild
                variant="outline"
                size="sm"
                className="mt-3"
              >
                <a
                  href={urlResult.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Go to provider
                  <ExternalLink className="ml-2 h-3 w-3" />
                </a>
              </Button>
            </div>
          );
        })}

        <p className="text-xs text-muted-foreground pt-2 border-t">
          {monetizationConfig.disclosure.affiliateText}
        </p>
      </CardContent>
    </Card>
  );
}
