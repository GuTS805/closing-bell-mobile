import { z } from 'zod';
import { guardSchema, markets, Ticker } from './api';

export const MAX_REFERENCE_AGE_SECS = 300;
export const savedCheckSchema = z.object({
  id: z.string(),
  ticker: z.custom<Ticker>(value => markets.some(market => market.ticker === value)),
  amount: z.number().finite().min(100).max(10_000_000),
  band: z.number().int().positive(),
  deviation: z.number().finite(),
  buildable: z.boolean(),
  outcome: z.enum(['within', 'above', 'stale', 'unavailable']).optional(),
  capturedAt: z.string(),
  checkedAt: z.string(),
  referenceAge: z.number().finite().nonnegative(),
  referencePrice: z.number().finite().positive().optional(),
  maxPrice: z.number().finite().positive().optional(),
});
export type SavedCheck = z.infer<typeof savedCheckSchema>;

export function savedOutcome(check: SavedCheck) {
  return check.outcome ?? (check.buildable ? 'within' : 'above');
}

export function ageSinceCaptureSeconds(capturedAtValue: string, sourceAgeSecs: number, now = Date.now()) {
  const capturedAt = Date.parse(capturedAtValue);
  if (!Number.isFinite(capturedAt) || capturedAt > now + 30_000 || sourceAgeSecs < 0) return Infinity;
  return sourceAgeSecs + Math.max(0, (now - capturedAt) / 1000);
}

export function referenceAgeSeconds(quote: z.infer<typeof guardSchema>, now = Date.now()) {
  return ageSinceCaptureSeconds(quote.capturedAt, quote.oracle.ageSecs, now);
}

export function ageLabel(seconds: number) {
  if (!Number.isFinite(seconds)) return 'unknown age';
  if (seconds >= 86_400) return `${Math.floor(seconds / 86_400)}d old`;
  if (seconds >= 3_600) return `${Math.floor(seconds / 3_600)}h old`;
  if (seconds >= 60) return `${Math.floor(seconds / 60)}m old`;
  return `${Math.round(seconds)}s old`;
}

export function quoteDecision(quote: z.infer<typeof guardSchema>, limitBps: number, now = Date.now()) {
  if (referenceAgeSeconds(quote, now) > MAX_REFERENCE_AGE_SECS) return 'stale' as const;
  if (quote.derivation.quotedDeviationBps > limitBps) return 'above' as const;
  if (!quote.derivation.buildable) return 'unavailable' as const;
  return 'within' as const;
}
