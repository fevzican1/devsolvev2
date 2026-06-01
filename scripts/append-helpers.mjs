import fs from 'fs';
import path from 'path';

const code = `

// ──────────────────────────────────────────────
// Presentation helpers for the /fix detail page
// ──────────────────────────────────────────────

export const DIFFICULTY_LABEL: Record<string, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
};

export const SEVERITY_STYLE: Record<string, string> = {
  low: 'text-green-600',
  medium: 'text-yellow-600',
  high: 'text-orange-600',
  critical: 'text-red-600',
};

export interface FixPresentation {
  severity: string;
  difficulty: string;
  timeEstimate: string;
  affectedVersions: string;
  tags: string[];
  verifySteps: string[];
}

export function getFixPresentation(error: ErrorEntry): FixPresentation {
  return {
    severity: error.severity ?? 'medium',
    difficulty: error.difficulty ?? 'intermediate',
    timeEstimate: error.timeEstimate ?? '~15 min',
    affectedVersions: error.affectedVersions ?? 'current',
    tags: error.tags ?? [],
    verifySteps: error.verifySteps ?? [
      'Rerun your application or test suite to confirm the error no longer appears.',
      'Check that the expected output matches the fix above.',
      'Monitor logs for any remaining occurrences of the same error pattern.',
    ],
  };
}
`;

const filePath = path.resolve('src/data/errorLibrary.ts');
fs.appendFileSync(filePath, code, 'utf-8');
console.log('Appended helpers to errorLibrary.ts');