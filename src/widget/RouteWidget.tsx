import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';
import { markets, Ticker } from '../api';

export type WidgetRow = { ticker: Ticker; bps: number | null; limitBps: number };

const colors = { bg: '#0b0e10', card: '#14181b', ink: '#f5f6f7', faint: '#939da8', gold: '#f2c84b', green: '#32db8a', red: '#f07870' } as const;
const pct = (bps: number) => `${bps >= 0 ? '+' : ''}${(bps / 100).toFixed(2)}%`;

/** Home-screen view of the latest $1,000 route cost over xStocks' price, per token. */
export function RouteWidget({ rows, updatedAt }: { rows: WidgetRow[]; updatedAt: number | null }) {
  return <FlexWidget clickAction="OPEN_APP" style={{ height: 'match_parent', width: 'match_parent', backgroundColor: colors.bg, borderRadius: 18, padding: 14, flexDirection: 'column', justifyContent: 'space-between' }}>
    <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <TextWidget text="Closing Bell" style={{ fontSize: 14, fontFamily: 'Manrope_700Bold', color: colors.ink }} />
      <TextWidget text="OVER XSTOCKS · $1K" style={{ fontSize: 9, fontFamily: 'Inter_700Bold', color: colors.gold, letterSpacing: 0.08 }} />
    </FlexWidget>
    <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', justifyContent: 'space-between' }}>
      {rows.map(row => {
        const tone = row.bps === null ? colors.faint : row.bps <= row.limitBps ? colors.green : colors.red;
        return <FlexWidget key={row.ticker} style={{ backgroundColor: colors.card, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 6, flexDirection: 'column', alignItems: 'center', flex: 1, marginHorizontal: 2 }}>
          <TextWidget text={row.ticker} style={{ fontSize: 11, fontFamily: 'Inter_600SemiBold', color: colors.faint }} />
          <TextWidget text={row.bps === null ? '—' : pct(row.bps)} style={{ fontSize: 15, fontFamily: 'Manrope_700Bold', color: tone }} />
        </FlexWidget>;
      })}
    </FlexWidget>
    <TextWidget text={updatedAt ? `Updated ${new Date(updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · green = within your limit` : 'Open the app to load prices'} style={{ fontSize: 9, fontFamily: 'Inter_500Medium', color: colors.faint }} />
  </FlexWidget>;
}

export const emptyRows = (): WidgetRow[] => markets.map(m => ({ ticker: m.ticker, bps: null, limitBps: 50 }));
