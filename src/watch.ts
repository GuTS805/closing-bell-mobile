// Alerts and price history kept on the phone. The background sweep and the app share it,
// so history keeps filling and alerts keep firing while the app is closed.
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { z } from 'zod';
import { Comparison, getComparison, markets, percent, Ticker, usd } from './api';
import { nextAlertState } from './alertState';

const alertsKey = 'alerts-v1';
const historyKey = 'history-v1';
const sweptKey = 'last-sweep-v1';
/** Samples older than this are dropped; at one sample per 15 minutes a week is ~670 points. */
const keepMs = 7 * 86_400_000;
/** The amount the Markets tab, history and widget are measured at. */
export const referenceAmount = 1000;

const tickerSchema = z.custom<Ticker>(value => markets.some(m => m.ticker === value));
const alertSchema = z.object({ ticker: tickerSchema, amount: z.number().positive(), band: z.number().int().positive(), createdAt: z.string(), within: z.boolean() });
export type RouteAlert = z.infer<typeof alertSchema>;
const sampleSchema = z.object({ t: z.number(), bps: z.number().finite(), price: z.number().positive(), issuer: z.number().positive() });
export type Sample = z.infer<typeof sampleSchema>;
export type History = Partial<Record<Ticker, Sample[]>>;

async function readList<T>(key: string, schema: z.ZodType<T>): Promise<T[]> {
  const raw = await AsyncStorage.getItem(key);
  const parsed: unknown = raw ? JSON.parse(raw) : [];
  return Array.isArray(parsed) ? parsed.flatMap(item => { const result = schema.safeParse(item); return result.success ? [result.data] : []; }) : [];
}

export const readAlerts = () => readList(alertsKey, alertSchema);
export const writeAlerts = (alerts: RouteAlert[]) => AsyncStorage.setItem(alertsKey, JSON.stringify(alerts));

export async function readHistory(): Promise<History> {
  const raw = await AsyncStorage.getItem(historyKey);
  const parsed: unknown = raw ? JSON.parse(raw) : {};
  const history: History = {};
  if (parsed && typeof parsed === 'object') for (const market of markets) {
    const list = (parsed as Record<string, unknown>)[market.ticker];
    if (Array.isArray(list)) history[market.ticker] = list.flatMap(item => { const result = sampleSchema.safeParse(item); return result.success ? [result.data] : []; });
  }
  return history;
}

export async function lastSweep(): Promise<number | null> {
  const value = Number(await AsyncStorage.getItem(sweptKey));
  return Number.isFinite(value) && value > 0 ? value : null;
}

/** Appends $1,000 samples and prunes anything older than a week. */
export async function recordSamples(results: Comparison[], now = Date.now()) {
  if (!results.length) return;
  const history = await readHistory();
  for (const result of results) {
    const list = [...(history[result.ticker] ?? []), { t: now, bps: result.differenceBps, price: result.tokenFillPrice, issuer: result.issuerIndicativePrice }];
    history[result.ticker] = list.filter(sample => now - sample.t <= keepMs);
  }
  await AsyncStorage.multiSet([[historyKey, JSON.stringify(history)], [sweptKey, String(now)]]);
}

export async function notifyWithin(alert: RouteAlert, result: Comparison) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: `${alert.ticker} is within your ${(alert.band / 100).toFixed(2)}% limit`,
      body: `Jupiter is ${percent(result.differenceBps)} over xStocks' price for ${usd(alert.amount)}. Open Closing Bell to protect the swap.`,
      data: { ticker: alert.ticker },
    },
    trigger: null,
  });
}

/**
 * One pass: sample every market at $1,000, then re-check each alert at its own amount and
 * notify only on the move from over the limit to within it, so a steady state never repeats.
 */
export async function sweep(signal?: AbortSignal) {
  const settled = await Promise.allSettled(markets.map(m => getComparison(m.ticker, referenceAmount, signal)));
  const samples = settled.flatMap(item => item.status === 'fulfilled' ? [item.value] : []);
  await recordSamples(samples);
  const alerts = await readAlerts();
  if (!alerts.length) return samples;
  const next = await Promise.all(alerts.map(async alert => {
    try {
      const result = alert.amount === referenceAmount ? samples.find(sample => sample.ticker === alert.ticker) ?? await getComparison(alert.ticker, alert.amount, signal) : await getComparison(alert.ticker, alert.amount, signal);
      const { within, notify } = nextAlertState(alert, result.differenceBps);
      if (notify) await notifyWithin(alert, result);
      return { ...alert, within };
    } catch { return alert; }
  }));
  await writeAlerts(next);
  return samples;
}
