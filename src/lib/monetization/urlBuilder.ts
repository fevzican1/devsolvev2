import { monetizationConfig, getProgramById, type AffiliateProgram } from '@/config/monetization';

const ALLOWED_PROTOCOLS = ['https:'];

interface BuildUrlParams {
  programId: string;
  toolSlug?: string;
  guideSlug?: string;
  pageSlug?: string;
}

interface UrlBuildResult {
  url: string;
  isValid: boolean;
  fallbackUsed: boolean;
  error?: string;
}

function validateUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ALLOWED_PROTOCOLS.includes(parsed.protocol);
  } catch {
    return false;
  }
}

function sanitizePath(path: string): string {
  return path.replace(/[^a-zA-Z0-9\-_]/g, '');
}

function buildTrackingParams(params: BuildUrlParams): Record<string, string> {
  const { affiliateDefaults } = monetizationConfig;
  const timestamp = Date.now().toString(36);

  const subId = affiliateDefaults.subIdTemplate
    .replace('{toolSlug}', sanitizePath(params.toolSlug || 'direct'))
    .replace('{timestamp}', timestamp);

  return {
    utm_source: affiliateDefaults.utmSource,
    utm_medium: affiliateDefaults.utmMedium,
    utm_campaign: sanitizePath(params.toolSlug || params.guideSlug || 'homepage'),
    sub_id: subId,
  };
}

export function buildAffiliateUrl(params: BuildUrlParams): UrlBuildResult {
  const program = getProgramById(params.programId);

  if (!program) {
    return {
      url: '',
      isValid: false,
      fallbackUsed: false,
      error: 'Program not found',
    };
  }

  if (!program.enabled) {
    return {
      url: program.homepageUrl,
      isValid: validateUrl(program.homepageUrl),
      fallbackUsed: true,
      error: 'Program is disabled',
    };
  }

  const trackingParams = buildTrackingParams(params);

  let trackingUrl = program.trackingUrlTemplate;

  Object.entries(trackingParams).forEach(([key, value]) => {
    trackingUrl = trackingUrl.replace(`{${key}}`, encodeURIComponent(value));
  });

  trackingUrl = trackingUrl.replace(`{utmSource}`, encodeURIComponent(trackingParams.utm_source));

  if (!validateUrl(trackingUrl)) {
    return {
      url: program.homepageUrl,
      isValid: validateUrl(program.homepageUrl),
      fallbackUsed: true,
      error: 'Invalid tracking URL template',
    };
  }

  return {
    url: trackingUrl,
    isValid: true,
    fallbackUsed: false,
  };
}

export function buildHomepageUrl(program: AffiliateProgram): string {
  if (validateUrl(program.homepageUrl)) {
    return program.homepageUrl;
  }
  return '';
}

export function getAffiliateUrlForTool(programId: string, toolSlug: string): string {
  const result = buildAffiliateUrl({ programId, toolSlug });
  return result.url;
}

export function getAffiliateUrlForGuide(programId: string, guideSlug: string): string {
  const result = buildAffiliateUrl({ programId, guideSlug });
  return result.url;
}
