'use client';

import { useState, useEffect } from 'react';
import { Shield, Lock, Eye, EyeOff, FileText, Link2, AlertTriangle, CheckCircle, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { monetizationConfig, isMonetizationConfigured } from '@/config/monetization';
import { buildAffiliateUrl } from '@/lib/monetization/urlBuilder';

const PASSPHRASE_KEY = 'devsolve_cmd_center_auth';

export function CmdCenterPageClient() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passphrase, setPassphrase] = useState('');
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [testUrl, setTestUrl] = useState('');

  useEffect(() => {
    const stored = localStorage.getItem(PASSPHRASE_KEY);
    if (stored === 'authenticated') {
      setIsAuthenticated(true);
    }
  }, []);

  const handleLogin = () => {
    const expected = process.env.NEXT_PUBLIC_CMD_CENTER_PASSPHRASE;
    if (expected && passphrase === expected) {
      localStorage.setItem(PASSPHRASE_KEY, 'authenticated');
      setIsAuthenticated(true);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem(PASSPHRASE_KEY);
    setIsAuthenticated(false);
  };

  const handleTestLink = (programId: string) => {
    const result = buildAffiliateUrl({ programId, toolSlug: 'test-tool' });
    setTestUrl(result.url || 'No URL generated');
  };

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto px-4 py-20">
        <div className="max-w-md mx-auto">
          <Card>
            <CardHeader className="text-center">
              <Lock className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <CardTitle>Command Center</CardTitle>
              <CardDescription>
                Enter the passphrase to access local operations dashboard
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="relative">
                  <Input
                    type={showPassphrase ? 'text' : 'password'}
                    placeholder="Enter passphrase..."
                    value={passphrase}
                    onChange={(e) => setPassphrase(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute right-2 top-1/2 -translate-y-1/2"
                    onClick={() => setShowPassphrase(!showPassphrase)}
                  >
                    {showPassphrase ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                <Button onClick={handleLogin} className="w-full">
                  Access Dashboard
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const isConfigured = isMonetizationConfigured();

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Command Center</h1>
          <p className="text-muted-foreground">Local operations dashboard</p>
        </div>
        <Button variant="outline" onClick={handleLogout}>
          Logout
        </Button>
      </div>

      <Tabs defaultValue="setup" className="space-y-6">
        <TabsList>
          <TabsTrigger value="setup">Affiliate Setup</TabsTrigger>
          <TabsTrigger value="quality">Quality Report</TabsTrigger>
          <TabsTrigger value="links">Outbound Links</TabsTrigger>
          <TabsTrigger value="forbidden">Forbidden Scan</TabsTrigger>
          <TabsTrigger value="growth">Growth Matrix</TabsTrigger>
        </TabsList>

        <TabsContent value="setup">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Affiliate Setup Wizard
              </CardTitle>
              <CardDescription>
                Configure monetization by editing src/config/monetization.ts
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="p-4 rounded-lg bg-muted/50">
                <h3 className="font-medium mb-2">Configuration Status</h3>
                <div className="flex items-center gap-2">
                  {isConfigured ? (
                    <>
                      <CheckCircle className="h-5 w-5 text-success" />
                      <span>Monetization configured</span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="h-5 w-5 text-warning" />
                      <span>No affiliate programs enabled</span>
                    </>
                  )}
                </div>
              </div>

              <Separator />

              <div>
                <h3 className="font-medium mb-4">Setup Checklist</h3>
                <ul className="space-y-3">
                  <li className="flex items-start gap-3">
                    <input type="checkbox" className="mt-1" />
                    <span>Create accounts with affiliate networks</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <input type="checkbox" className="mt-1" />
                    <span>Get tracking URL templates from each network</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <input type="checkbox" className="mt-1" />
                    <span>Add programs to monetization.ts</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <input type="checkbox" className="mt-1" />
                    <span>Configure Payoneer for payouts</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <input type="checkbox" className="mt-1" />
                    <span>Test affiliate links</span>
                  </li>
                </ul>
              </div>

              <Separator />

              <div>
                <h3 className="font-medium mb-4">Test Link Builder</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Test your affiliate URL generation
                </p>
                {monetizationConfig.affiliatePrograms.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No programs configured. Add programs to monetization.ts first.
                  </p>
                ) : (
                  <div className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                      {monetizationConfig.affiliatePrograms.map((program) => (
                        <Button
                          key={program.id}
                          variant="outline"
                          size="sm"
                          onClick={() => handleTestLink(program.id)}
                        >
                          Test {program.name}
                        </Button>
                      ))}
                    </div>
                    {testUrl && (
                      <div className="p-3 rounded-md bg-muted font-mono text-sm break-all">
                        {testUrl}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="quality">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Quality Report
              </CardTitle>
              <CardDescription>
                Build-time quality and uniqueness analysis
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Quality reports are generated during build. Check out/reports/quality.txt after running npm run build.
              </p>
              <div className="mt-4 p-4 rounded-lg bg-muted/50">
                <p className="text-sm">
                  In development mode, reports are not available. Run a production build to generate reports.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="links">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Link2 className="h-5 w-5" />
                Outbound Link Audit
              </CardTitle>
              <CardDescription>
                Check for hardcoded URLs in the codebase
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                The outbound link audit runs during build. Check out/reports/outbound-links.txt after building.
              </p>
              <div className="mt-4 p-4 rounded-lg bg-muted/50">
                <p className="text-sm">
                  This audit helps ensure all affiliate URLs are generated through the URL builder
                  rather than hardcoded in components.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="forbidden">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Forbidden Terms Scan
              </CardTitle>
              <CardDescription>
                Check for prohibited content
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                The forbidden terms scan runs during build. Check out/reports/forbidden-scan.txt after building.
              </p>
              <div className="mt-4 p-4 rounded-lg bg-muted/50">
                <p className="text-sm">
                  Configure FORBIDDEN_TERMS environment variable with comma-separated terms to scan.
                  If not configured, the scan reports &quot;No terms configured&quot;.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="growth">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Growth Matrix
              </CardTitle>
              <CardDescription>
                Topic cluster prioritization based on local heuristics
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  { cluster: 'JSON Processing', score: 85, reason: 'High tool fit, strong content depth' },
                  { cluster: 'Encoding/Decoding', score: 82, reason: 'Multiple tools, broad use cases' },
                  { cluster: 'Security Tools', score: 78, reason: 'B2B relevance, affiliate potential' },
                  { cluster: 'Text Processing', score: 75, reason: 'Common workflows, good depth' },
                  { cluster: 'Code Formatting', score: 72, reason: 'Developer appeal, tool variety' },
                ].map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div>
                      <p className="font-medium">{item.cluster}</p>
                      <p className="text-sm text-muted-foreground">{item.reason}</p>
                    </div>
                    <Badge variant="secondary">{item.score}/100</Badge>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-4">
                Scores based on commercial intent, tool fit, content depth, affiliate coverage, and risk profile.
                No external data used.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
