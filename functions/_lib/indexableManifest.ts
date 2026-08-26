/**
 * Stage-2 lookup: is this factory ordinal in the offline indexable manifest?
 *
 * Cloudflare Pages must not score 20M pages at deploy. The offline worker
 * writes a compact quarantine list; every other ordinal is indexable. An
 * incomplete or stale manifest is treated as "unknown" so we never 404 the
 * factory as a band.
 */
import { CORPUS_SIZE } from '../../src/lib/programmatic/corpusGeometry';
import { CONTENT_VERSION } from './programmaticPage';
import {
  MANIFEST_COMPLETE,
  MANIFEST_CONTENT_VERSION,
  MANIFEST_CORPUS_SIZE,
  QUARANTINE_IDS,
} from './quarantineSeeds';

const quarantine = new Set<number>(QUARANTINE_IDS);

export function manifestIsLive(): boolean {
  return MANIFEST_COMPLETE
    && MANIFEST_CONTENT_VERSION === CONTENT_VERSION
    && MANIFEST_CORPUS_SIZE === CORPUS_SIZE;
}

export function isManifestIndexable(index: number): boolean {
  if (!Number.isInteger(index) || index < 0 || index >= CORPUS_SIZE) return false;
  if (!manifestIsLive()) return true;
  return !quarantine.has(index);
}

export function quarantineCount(): number {
  return quarantine.size;
}
