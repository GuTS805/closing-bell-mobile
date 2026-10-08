import { z } from 'zod';

export const RPC_URL = process.env.EXPO_PUBLIC_RPC_URL ?? 'https://api.mainnet-beta.solana.com';
const XSTOCKS = 'https://api.xstocks.fi/api/v2/public';
export const USDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const TOKEN_2022 = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';
export const markets = [
  { ticker: 'SPYx', name: 'S&P 500', underlying: 'SPY', mark: 'S', color: '#d4bf83', mint: 'XsoCS1TfEyfFhfvj8EtZ528L3CaKBDBRqRapnBbDF2W', decimals: 8 },
  { ticker: 'AAPLx', name: 'Apple', underlying: 'AAPL', mark: 'A', color: '#b7c4cf', mint: 'XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp', decimals: 8 },
  { ticker: 'NVDAx', name: 'Nvidia', underlying: 'NVDA', mark: 'N', color: '#b9d98a', mint: 'Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh', decimals: 8 },
  { ticker: 'TSLAx', name: 'Tesla', underlying: 'TSLA', mark: 'T', color: '#e7a18e', mint: 'XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB', decimals: 8 },
] as const;
export type Ticker = typeof markets[number]['ticker'];
export const marketFor = (ticker: Ticker) => markets.find(m => m.ticker === ticker)!;
const issuerSchema = z.object({ quote: z.number().finite().positive() });
const routeSchema = z.object({ outAmount: z.string().regex(/^\d+$/), contextSlot: z.number().int().nonnegative(), routePlan: z.array(z.object({ swapInfo: z.object({ label: z.string() }) })).optional() });
export const reserveSchema = z.object({ symbol: z.string(), timestamp: z.string().datetime(), sharesHeld: z.string(), circulatingSupply: z.string(), holdings: z.array(z.object({ provider: z.string(), quantity: z.string(), symbol: z.string() })) });
export type Reserve = z.infer<typeof reserveSchema>;
export type Comparison = { ticker: Ticker; amount: number; tokensOut: number; tokenFillPrice: number; issuerIndicativePrice: number; differenceBps: number; routeSlot: number; venues: string[]; capturedAt: string };

async function readJson<T>(source: string, url: string, schema: z.ZodType<T>, signal?: AbortSignal, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort);
  if (signal?.aborted) controller.abort();
  const timeout = setTimeout(abort, 15_000);
  try {
    let response: Response;
    try { response = await fetch(url, { ...init, signal: controller.signal, headers: { Accept: 'application/json', ...init?.headers } }); }
    catch (error) {
      if (signal?.aborted) throw error;
      if (controller.signal.aborted) throw new Error(`${source} took too long to respond. Try again.`);
      throw new Error(`Could not reach ${source}. Check your internet connection and try again.`);
    }
    if (response.status === 429) throw new Error(`${source} is limiting requests. Wait a minute and try again.`);
    if (!response.ok) throw new Error(`${source} is unavailable right now (HTTP ${response.status}). Try again later.`);
    let body: unknown;
    try { body = await response.json(); }
    catch (error) {
      if (signal?.aborted) throw error;
      if (controller.signal.aborted) throw new Error(`${source} took too long to respond. Try again.`);
      throw new Error(`${source} returned an unreadable response. If you are on Wi-Fi that needs a sign-in, open a browser first.`);
    }
    const parsed = schema.safeParse(body);
    if (!parsed.success) throw new Error(`${source} returned incomplete data. Try again.`);
    return parsed.data;
  } finally { clearTimeout(timeout); signal?.removeEventListener('abort', abort); }
}

export async function getComparison(ticker: Ticker, amount: number, signal?: AbortSignal): Promise<Comparison> {
  if (!Number.isFinite(amount) || amount < 100 || amount > 10_000_000) throw new Error('Amount must be between $100 and $10,000,000.');
  const market = marketFor(ticker);
  const rawAmount = Math.round(amount * 1_000_000);
  const routeUrl = `https://lite-api.jup.ag/swap/v1/quote?inputMint=${USDC}&outputMint=${market.mint}&amount=${rawAmount}&slippageBps=50`;
  const [issuer, route] = await Promise.all([readJson('xStocks', `${XSTOCKS}/assets/${ticker}/price-data`, issuerSchema, signal), readJson('Jupiter', routeUrl, routeSchema, signal)]);
  const output = Number(route.outAmount) / 10 ** market.decimals;
  if (!Number.isFinite(output) || output <= 0) throw new Error('The route returned an invalid token amount.');
  const tokenFillPrice = amount / output;
  const differenceBps = (tokenFillPrice / issuer.quote - 1) * 10_000;
  if (!Number.isFinite(differenceBps)) throw new Error('Could not compare these prices.');
  return { ticker, amount, tokensOut: output, tokenFillPrice, issuerIndicativePrice: issuer.quote, differenceBps,
    routeSlot: route.contextSlot, venues: [...new Set((route.routePlan ?? []).map(hop => hop.swapInfo.label))], capturedAt: new Date().toISOString() };
}

const tradingSchema = z.object({ trading: z.object({ currentPeriod: z.string(), openNow: z.boolean(), nextChangeAt: z.string().datetime().nullable().optional() }) });
export type MarketSession = { period: string; openNow: boolean; nextChangeAt: string | null };
/** xStocks trade 24/5; the issuer reports which US session its prices currently follow. */
export async function getMarketSession(signal?: AbortSignal): Promise<MarketSession> {
  const { trading } = await readJson('xStocks', `${XSTOCKS}/assets/SPYx`, tradingSchema, signal);
  return { period: trading.currentPeriod, openNow: trading.openNow, nextChangeAt: trading.nextChangeAt ?? null };
}

export async function getReserve(ticker: Ticker, signal?: AbortSignal): Promise<Reserve> {
  const reserve = await readJson('xStocks', `${XSTOCKS}/proof-of-reserves/${ticker}`, reserveSchema, signal);
  if (reserve.symbol !== ticker || !Number.isFinite(Date.parse(reserve.timestamp)) ||
    ![reserve.sharesHeld, reserve.circulatingSupply].every(value => Number.isFinite(Number(value)) && Number(value) >= 0)) throw new Error('Issuer reserve record was incomplete.');
  return reserve;
}

const rpcSchema = z.object({ result: z.object({ value: z.array(z.object({ account: z.object({ data: z.object({ parsed: z.object({ info: z.object({ mint: z.string(), tokenAmount: z.object({ uiAmountString: z.string() }) }) }) }) }) })) }) });
const rpcErrorSchema = z.object({ error: z.object({ message: z.string() }) });
export async function getPositions(address: string, signal?: AbortSignal) {
  const parsed = await readJson('Solana RPC', RPC_URL, rpcSchema.or(rpcErrorSchema), signal, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getTokenAccountsByOwner', params: [address, { programId: TOKEN_2022 }, { encoding: 'jsonParsed' }] }) });
  if (!('result' in parsed)) throw new Error(/invalid param/i.test(parsed.error.message) ? 'That is not a valid Solana address.' : 'Solana RPC could not read token holdings. Try again.');
  return markets.flatMap(market => {
    const qty = parsed.result.value.filter(item => item.account.data.parsed.info.mint === market.mint)
      .reduce((sum, item) => sum + Number(item.account.data.parsed.info.tokenAmount.uiAmountString), 0);
    return qty > 0 ? [{ ticker: market.ticker, label: market.name, qty }] : [];
  });
}

export const usd = (value: number) => `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const percent = (bps: number) => `${bps >= 0 ? '+' : ''}${(bps / 100).toFixed(2)}%`;
