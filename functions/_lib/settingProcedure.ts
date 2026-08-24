/**
 * Setting-owned optional-section set.
 *
 * Adjacent contexts used to share ~0.15–0.37 of 5-grams because style-locked
 * archetype essays flushed even when omitted from the outline. Every setting
 * therefore drops `archetype`. Remaining body copy is per-URL combo sentences
 * in comboProcedure.ts — do not re-wire setting essays into the renderer.
 */
type OptionalSection = 'takeaways' | 'glossary' | 'comparison' | 'archetype' | 'practice' | 'audience' | 'acceptance';

/** Extra omits on top of the style genre — adjacent settings drop different large sections. */
export function settingOmits(context: string): OptionalSection[] {
  const extra: OptionalSection[] = ['archetype'];
  switch (context) {
    case 'for-time-sensitive-incidents': return [...extra, 'glossary', 'comparison'];
    case 'for-team-onboarding': return [...extra, 'comparison'];
    case 'for-legacy-system-migrations': return [...extra, 'glossary'];
    case 'for-api-contract-validation': return [...extra, 'takeaways'];
    case 'for-compliance-reporting': return [...extra, 'glossary'];
    case 'for-release-management': return extra;
    case 'for-service-mesh-debugging': return [...extra, 'takeaways'];
    case 'for-disaster-recovery': return [...extra, 'takeaways'];
    case 'for-production-rollouts': return [...extra, 'audience', 'glossary'];
    case 'for-observability-pipelines': return [...extra, 'comparison'];
    default: return extra;
  }
}
