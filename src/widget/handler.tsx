import React from 'react';
import { requestWidgetUpdate, WidgetTaskHandlerProps } from 'react-native-android-widget';
import { markets } from '../api';
import { lastSweep, readAlerts, readHistory, sweep } from '../watch';
import { RouteWidget, WidgetRow } from './RouteWidget';

export const widgetName = 'RouteCost';
/** Without an alert for a token, the widget colours it against the app's default limit. */
const defaultLimitBps = 50;

export async function buildWidget() {
  const [history, alerts, updatedAt] = await Promise.all([readHistory(), readAlerts(), lastSweep()]);
  const rows: WidgetRow[] = markets.map(m => {
    const latest = history[m.ticker]?.at(-1);
    return { ticker: m.ticker, bps: latest?.bps ?? null, limitBps: alerts.find(a => a.ticker === m.ticker)?.band ?? defaultLimitBps };
  });
  return <RouteWidget rows={rows} updatedAt={updatedAt} />;
}

/** Re-renders every placed widget from stored samples; a no-op when none is placed. */
export const refreshWidget = () => requestWidgetUpdate({ widgetName, renderWidget: buildWidget, widgetNotFound: () => undefined });

export async function widgetTaskHandler({ widgetAction, renderWidget }: WidgetTaskHandlerProps) {
  if (widgetAction === 'WIDGET_DELETED') return;
  // A newly placed widget or the system's periodic update gets fresh data when it can.
  if (widgetAction === 'WIDGET_ADDED' || widgetAction === 'WIDGET_UPDATE') {
    try { await sweep(); } catch { /* Render the last stored samples. */ }
  }
  renderWidget(await buildWidget());
}
