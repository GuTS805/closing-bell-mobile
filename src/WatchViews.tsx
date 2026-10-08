import React, { useState } from 'react';
import { Text, View } from 'react-native';
import * as Notifications from 'expo-notifications';
import { requestPinWidget } from 'react-native-android-widget';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { percent, Ticker, usd } from './api';
import { ensureBackgroundSweep } from './background';
import { readAlerts, readHistory, RouteAlert, writeAlerts } from './watch';
import { widgetName } from './widget/handler';
import { Button, colors, Copy, Label, Notice, Pill, s } from './ui';

export const useAlerts = () => useQuery({ queryKey: ['alerts'], queryFn: readAlerts, staleTime: Infinity });
export const useHistory = () => useQuery({ queryKey: ['history'], queryFn: readHistory, staleTime: 60_000 });

/** Asks for notification permission at the moment it is needed, then stores the alert. */
export function AlertButton({ ticker, amount, band }: { ticker: Ticker; amount: number; band: number }) {
  const client = useQueryClient();
  const alerts = useAlerts();
  const [message, setMessage] = useState('');
  const existing = alerts.data?.find(alert => alert.ticker === ticker);
  async function create() {
    setMessage('');
    try {
      const permission = await Notifications.requestPermissionsAsync();
      if (!permission.granted) { setMessage('Notifications are off for Closing Bell. Turn them on in Android settings to get alerts.'); return; }
      const next: RouteAlert[] = [...(alerts.data ?? []).filter(alert => alert.ticker !== ticker), { ticker, amount, band, createdAt: new Date().toISOString(), within: false }];
      await writeAlerts(next);
      const scheduled = await ensureBackgroundSweep();
      await client.invalidateQueries({ queryKey: ['alerts'] });
      setMessage(scheduled ? `We'll check about every 15 minutes and notify you when ${ticker} is within ${(band / 100).toFixed(2)}%.` : 'Alert saved, but Android has background checks off for this app, so it can only update while open.');
    } catch { setMessage('Could not set this alert on your device.'); }
  }
  const same = existing && existing.amount === amount && existing.band === band;
  return <>
    <Button secondary={!!same} disabled={!!same} title={same ? 'Alert is on' : `Alert me when it's within ${(band / 100).toFixed(2)}%`} onPress={() => { void create(); }} />
    {message !== '' && <Text style={s.faint}>{message}</Text>}
  </>;
}

export function AlertList() {
  const client = useQueryClient();
  const alerts = useAlerts();
  if (!alerts.data?.length) return null;
  async function remove(ticker: Ticker) {
    await writeAlerts((alerts.data ?? []).filter(alert => alert.ticker !== ticker));
    await client.invalidateQueries({ queryKey: ['alerts'] });
  }
  return <View style={s.card}>
    <Label>YOUR ALERTS</Label>
    {alerts.data.map(alert => <View key={alert.ticker} style={s.dataRow}>
      <View style={s.flex}><Text style={s.dataLabel}>{alert.ticker} within {(alert.band / 100).toFixed(2)}%</Text><Text style={s.dataHint}>For {usd(alert.amount)} · {alert.within ? 'within now' : 'waiting'}</Text></View>
      <Button secondary title="Remove" onPress={() => { void remove(alert.ticker); }} />
    </View>)}
  </View>;
}

/** Last seven days of $1,000 route cost over xStocks' price, sampled on this phone. */
export function HistoryChart({ ticker, band }: { ticker: Ticker; band: number }) {
  const history = useHistory();
  const samples = history.data?.[ticker] ?? [];
  if (samples.length < 2) return <Notice message="Your price history starts now. Closing Bell samples Jupiter about every 15 minutes in the background and builds a 7-day chart here." />;
  const bars = samples.slice(-48);
  const values = bars.map(sample => sample.bps);
  // Scale to the observed range and the limit, so moves of a few basis points stay visible.
  const low = Math.min(band, ...values), high = Math.max(band, ...values);
  const pad = Math.max((high - low) * 0.4, 5);
  const min = low - pad, max = high + pad;
  const span = max - min;
  const latest = bars[bars.length - 1];
  const within = samples.filter(sample => sample.bps <= band).length;
  return <View style={s.card}>
    <View style={s.row}><Label>LAST {bars.length} CHECKS ON THIS PHONE</Label><Pill title={`${Math.round(within / samples.length * 100)}% WITHIN`} tone="muted" /></View>
    <View style={s.chart}>
      {bars.map(sample => <View key={sample.t} style={[s.bar, { height: `${Math.max(4, (sample.bps - min) / span * 100)}%`, backgroundColor: sample.bps <= band ? colors.green : colors.red }]} />)}
      <View style={[s.limitLine, { bottom: `${(band - min) / span * 100}%` }]} />
    </View>
    <Copy>{`Now ${percent(latest.bps)} for $1,000, ranging ${percent(Math.min(...values))} to ${percent(Math.max(...values))}. The dashed line is your ${(band / 100).toFixed(2)}% limit. ${samples.length} samples since ${new Date(samples[0].t).toLocaleDateString()}.`}</Copy>
  </View>;
}

export function WidgetButton() {
  const [message, setMessage] = useState('');
  async function pin() {
    try { const shown = await requestPinWidget({ widgetName }); setMessage(shown ? 'Confirm on the prompt to place the widget.' : 'Your launcher does not support adding widgets from apps. Long-press the home screen and add "Closing Bell route cost".'); }
    catch { setMessage('Long-press the home screen, open Widgets and add "Closing Bell route cost".'); }
  }
  return <>
    <Button secondary title="Add route-cost widget to home screen" onPress={() => { void pin(); }} />
    {message !== '' && <Text style={s.faint}>{message}</Text>}
  </>;
}
