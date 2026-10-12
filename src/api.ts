import AsyncStorage from '@react-native-async-storage/async-storage';
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
// xStocks returns { quote: null } while the US market is closed (weekends on its 24/5 schedule).
const issuerSchema = z.object({ quote: z.number().finite().positive().nullable() });
const routeSchema = z.object({ outAmount: z.string().regex(/^\d+$/), contextSlot: z.number().int().nonnegative(), routePlan: z.array(z.object({ swapInfo: z.object({ label: z.string() }) })).optional() });
export const reserveSchema = z.object({ symbol: z.string(), timestamp: z.string().datetime(), sharesHeld: z.string(), circulatingSupply: z.string(), holdings: z.array(z.object({ provider: z.string(), quantity: z.string(), symbol: z.string() })) });
export type Reserve = z.infer<typeof reserveSchema>;
/** issuerLive is false when xStocks has paused its price and the comparison uses the last one this phone read, at issuerAt. */
export type Comparison = { ticker: Ticker; amount: number; tokensOut: number; tokenFillPrice: number; issuerIndicativePrice: number; issuerLive: boolean; issuerAt: string; differenceBps: number; routeSlot: number; venues: string[]; capturedAt: string };

/** Thrown while xStocks' price is paused and this phone has never read one for the token; still carries Jupiter's live price. */
export class MarketClosedError extends Error {
  constructor(readonly ticker: Ticker, readonly tokensOut: number, readonly tokenFillPrice: number) {
    super(`xStocks pauses its price while the US market is closed, and this phone hasn't read one for ${ticker} yet. Jupiter's live price is ${usd(tokenFillPrice)} per token; the comparison returns when the market reopens.`);
    this.name = 'MarketClosedError';
  }
}

const lastIssuerKey = 'issuer-last-v1';
/** Older issuer prices are too stale to compare against, even with a label. */
const lastIssuerMaxMs = 7 * 86_400_000;
type IssuerRead = { price: number; at: number };

async function rememberIssuer(ticker: Ticker, read: IssuerRead) {
  try {
    const raw = await AsyncStorage.getItem(lastIssuerKey);
    const stored: Record<string, IssuerRead> = raw ? JSON.parse(raw) : {};
    await AsyncStorage.setItem(lastIssuerKey, JSON.stringify({ ...stored, [ticker]: read }));
  } catch { /* The comparison itself doesn't depend on the cache. */ }
}

/** The newest issuer price this phone read for the token, from the cache or the background history. */
async function lastIssuer(ticker: Ticker, now: number): Promise<IssuerRead | null> {
  const reads: IssuerRead[] = [];
  try {
    const [[, cached], [, history]] = await AsyncStorage.multiGet([lastIssuerKey, 'history-v1']);
    const read = cached ? JSON.parse(cached)?.[ticker] : null;
    if (read) reads.push(read);
    const samples = history ? JSON.parse(history)?.[ticker] : null;
    if (Array.isArray(samples)) for (const sample of samples) if (sample) reads.push({ price: sample.issuer, at: sample.t });
  } catch { return null; }
  const valid = reads.filter(read => Number.isFinite(read?.price) && read.price > 0 && Number.isFinite(read?.at) && now - read.at <= lastIssuerMaxMs);
  return valid.length ? valid.reduce((a, b) => (b.at > a.at ? b : a)) : null;
}

async function readJson<T>(source: string, url: string, schema: z.ZodType<T>, signal?: AbortSignal, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort);
  if (signal?.aborted) controller.abort();
  const timeout = setTimeout(abort, 15_000);
  try {
    let response: Response;
    // Gateway errors (seen from Jupiter on a cold start) usually clear within a second or two, so retry them here.
    for (let attempt = 0; ; attempt++) {
      try { response = await fetch(url, { ...init, signal: controller.signal, headers: { Accept: 'application/json', ...init?.headers } }); }
      catch (error) {
        if (signal?.aborted) throw error;
        if (controller.signal.aborted) throw new Error(`${source} took too long to respond. Try again.`);
        throw new Error(`Could not reach ${source}. Check your internet connection and try again.`);
      }
      if (![502, 503, 504].includes(response.status) || attempt === 2) break;
      await new Promise(resolve => setTimeout(resolve, 700 * (attempt + 1)));
      if (controller.signal.aborted) throw signal?.aborted ? new Error('Aborted') : new Error(`${source} took too long to respond. Try again.`);
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
  const now = Date.now();
  let reference: IssuerRead | null = issuer.quote === null ? null : { price: issuer.quote, at: now };
  if (reference) await rememberIssuer(ticker, reference);
  else reference = await lastIssuer(ticker, now);
  if (!reference) throw new MarketClosedError(ticker, output, tokenFillPrice);
  const differenceBps = (tokenFillPrice / reference.price - 1) * 10_000;
  if (!Number.isFinite(differenceBps)) throw new Error('Could not compare these prices.');
  return { ticker, amount, tokensOut: output, tokenFillPrice, issuerIndicativePrice: reference.price, issuerLive: issuer.quote !== null, issuerAt: new Date(reference.at).toISOString(), differenceBps,
    routeSlot: route.contextSlot, venues: [...new Set((route.routePlan ?? []).map(hop => hop.swapInfo.label))], capturedAt: new Date(now).toISOString() };
}

const tradingSchema = z.object({ trading: z.object({ currentPeriod: z.string(), openNow: z.boolean(), nextChangeAt: z.string().datetime().nullable().optional() }) });
export type MarketSession = { period: string; openNow: boolean; nextChangeAt: string | null };
/** xStocks trade 24/5; the issuer reports which US session its prices currently follow. */
export async function getMarketSession(signal?: AbortSignal): Promise<MarketSession> {
  const { trading } = await readJson('xStocks', `${XSTOCKS}/assets/SPYx`, tradingSchema, signal);
  return { period: trading.currentPeriod, openNow: trading.openNow, nextChangeAt: trading.nextChangeAt ?? null };
}

/** saved is true when xStocks couldn't be reached and this is the last record the phone read; its timestamp still dates it. */
export async function getReserve(ticker: Ticker, signal?: AbortSignal): Promise<Reserve & { saved: boolean }> {
  const key = `reserve-v1:${ticker}`;
  try {
    const reserve = await readJson('xStocks', `${XSTOCKS}/proof-of-reserves/${ticker}`, reserveSchema, signal);
    if (reserve.symbol !== ticker || !Number.isFinite(Date.parse(reserve.timestamp)) ||
      ![reserve.sharesHeld, reserve.circulatingSupply].every(value => Number.isFinite(Number(value)) && Number(value) >= 0)) throw new Error('Issuer reserve record was incomplete.');
    AsyncStorage.setItem(key, JSON.stringify(reserve)).catch(() => undefined);
    return { ...reserve, saved: false };
  } catch (error) {
    if (signal?.aborted) throw error;
    let saved: Reserve | null = null;
    try {
      const raw = await AsyncStorage.getItem(key);
      const parsed = raw ? reserveSchema.safeParse(JSON.parse(raw)) : null;
      saved = parsed?.success ? parsed.data : null;
    } catch { /* Fall through to the network error. */ }
    if (saved) return { ...saved, saved: true };
    throw error;
  }
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
/** The gap in words for sentences and pills: "0.61% over", or "0.08% under" when Jupiter is cheaper. */
export const isUnder = (bps: number) => bps <= -0.5;
export const gapWords = (bps: number) => `${(Math.abs(bps) / 100).toFixed(2)}% ${isUnder(bps) ? 'under' : 'over'}`;
