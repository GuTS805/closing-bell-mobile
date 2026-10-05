import { z } from 'zod';

export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'https://closing-bell-eight.vercel.app').replace(/\/$/, '');
export const RPC_URL = process.env.EXPO_PUBLIC_RPC_URL ?? 'https://api.mainnet-beta.solana.com';
export const markets = [
  { ticker: 'SPYx', name: 'S&P 500', mark: 'S', color: '#d4bf83' },
  { ticker: 'AAPLx', name: 'Apple', mark: 'A', color: '#b7c4cf' },
  { ticker: 'NVDAx', name: 'Nvidia', mark: 'N', color: '#b9d98a' },
  { ticker: 'TSLAx', name: 'Tesla', mark: 'T', color: '#e7a18e' },
] as const;
export type Ticker = typeof markets[number]['ticker'];
const finite = z.number().finite();
export const costSchema = z.object({
  capturedAt: z.string(),
  oracle: z.object({ price: finite.positive(), ageSecs: finite }),
  pool: z.object({ fillPrice: finite.positive() }),
  breakdown: z.object({ trueCostBps: finite }),
});
export const guardSchema = z.object({
  capturedAt: z.string(),
  oracle: z.object({ priceUsd: finite.positive(), ageSecs: finite }),
  derivation: z.object({ buildable: z.boolean(), quotedDeviationBps: finite, maxPriceUsd: finite.positive() }),
});
export const positionSchema = z.object({
  capturedAt: z.string(), holdings: z.array(z.object({ ticker: z.string(), label: z.string(), qty: finite })),
});
export async function request<T>(path: string, schema: z.ZodType<T>, signal?: AbortSignal): Promise<T> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort);
  if (signal?.aborted) controller.abort();
  const timeout = setTimeout(abort, 20_000);
  try {
    const response = await fetch(`${API_URL}${path}`, { signal: controller.signal });
    const body = await response.json();
    if (!response.ok) throw new Error(typeof body.error === 'string' ? body.error : `Service unavailable (${response.status})`);
    return schema.parse(body);
  } finally { clearTimeout(timeout); signal?.removeEventListener('abort', abort); }
}
export const usd = (value: number) => `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const percent = (bps: number) => `${bps >= 0 ? '+' : ''}${(bps / 100).toFixed(2)}%`;
