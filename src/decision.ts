import { z } from 'zod';
import { markets, Ticker } from './api';

export const savedCheckSchema = z.object({
  id: z.string(), ticker: z.custom<Ticker>(value => markets.some(m => m.ticker === value)),
  amount: z.number().finite().min(100).max(10_000_000), band: z.number().int().positive(),
  differenceBps: z.number().finite(), outcome: z.enum(['within', 'above']),
  issuerIndicativePrice: z.number().finite().positive(), tokenFillPrice: z.number().finite().positive(),
  capturedAt: z.string(), checkedAt: z.string(),
});
export type SavedCheck = z.infer<typeof savedCheckSchema>;

export function ageLabel(iso: string, now = Date.now()) {
  const age = (now - Date.parse(iso)) / 1000;
  if (!Number.isFinite(age) || age < -30) return 'unknown age';
  if (age >= 86_400) return `${Math.floor(age / 86_400)}d old`;
  if (age >= 3_600) return `${Math.floor(age / 3_600)}h old`;
  if (age >= 60) return `${Math.floor(age / 60)} min old`;
  return `${Math.max(0, Math.round(age))} sec old`;
}
