import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';
import { markets, percent, Ticker } from '../api';

export type WidgetRow = { ticker: Ticker; bps: number | null; limitBps: number };

const colors = { bg: '#0b0e10', card: '#14181b', ink: '#f5f6f7', faint: '#939da8', gold: '#f2c84b', green: '#32db8a', red: '#f07870' } as const;
/** Time for today's samples; weekday and time once they are older, e.g. across a market-closed weekend. */
const updatedLabel = (at: number) => {
  const date = new Date(at);
  const clock = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return date.toDateString() === new Date().toDateString() ? clock : `${date.toLocaleDateString([], { weekday: 'short' })} ${clock}`;
};

/** Home-screen view of the latest $1,000 route cost over xStocks' price, per token. */
export function RouteWidget({ rows, updatedAt }: { rows: WidgetRow[]; updatedAt: number | null }) {
  return <FlexWidget clickAction="OPEN_APP" style={{ height: 'match_parent', width: 'match_parent', backgroundColor: colors.bg, borderRadius: 18, padding: 14, flexDirection: 'column', justifyContent: 'space-between' }}>
    <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <TextWidget text="Closing Bell" style={{ fontSize: 14, fontFamily: 'Manrope_700Bold', color: colors.ink }} />
      <TextWidget text="VS XSTOCKS · $1K" style={{ fontSize: 9, fontFamily: 'Inter_700Bold', color: colors.gold, letterSpacing: 0.08 }} />
    </FlexWidget>
    <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', justifyContent: 'space-between' }}>
      {rows.map(row => {
        const tone = row.bps === null ? colors.faint : row.bps <= row.limitBps ? colors.green : colors.red;
        return <FlexWidget key={row.ticker} style={{ backgroundColor: colors.card, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 6, flexDirection: 'column', alignItems: 'center', flex: 1, marginHorizontal: 2 }}>
          <TextWidget text={row.ticker} style={{ fontSize: 11, fontFamily: 'Inter_600SemiBold', color: colors.faint }} />
          <TextWidget text={row.bps === null ? '—' : percent(row.bps)} maxLines={1} style={{ fontSize: 13, fontFamily: 'Manrope_700Bold', color: tone }} />
        </FlexWidget>;
      })}
    </FlexWidget>
    <TextWidget text={updatedAt ? `Updated ${updatedLabel(updatedAt)} · green = within your limit` : 'Open the app to load prices'} style={{ fontSize: 9, fontFamily: 'Inter_500Medium', color: colors.faint }} />
  </FlexWidget>;
}

export const emptyRows = (): WidgetRow[] => markets.map(m => ({ ticker: m.ticker, bps: null, limitBps: 50 }));
