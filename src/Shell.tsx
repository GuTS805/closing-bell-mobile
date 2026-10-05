import React, { useEffect, useState } from 'react';
import { BackHandler, Linking, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMobileWallet } from '@wallet-ui/react-native-web3js';
import { API_URL, costSchema, guardSchema, markets, percent, positionSchema, request, Ticker, usd } from './api';
import { Button, colors, Copy, Label, Notice, s } from './ui';

type Tab = 'Watch' | 'Portfolio' | 'Activity' | 'Settings';
const tabs: Tab[] = ['Watch', 'Portfolio', 'Activity', 'Settings'];
export function Shell() {
  const client = useQueryClient();
  const [tab, setTab] = useState<Tab>('Watch');
  const [stock, setStock] = useState<Ticker | null>(null);
  const [saved, setSaved] = useState<Ticker[]>([]);
  const [ready, setReady] = useState(false);
  useEffect(() => { AsyncStorage.getItem('watchlist').then(value => {
    if (value) { const parsed: unknown = JSON.parse(value); if (Array.isArray(parsed)) setSaved(markets.filter(m => parsed.includes(m.ticker)).map(m => m.ticker)); }
  }).catch(() => {}).finally(() => setReady(true)); }, []);
  useEffect(() => { const listener = BackHandler.addEventListener('hardwareBackPress', () => { if (!stock) return false; setStock(null); return true; }); return () => listener.remove(); }, [stock]);
  const toggle = (ticker: Ticker) => { const next = saved.includes(ticker) ? saved.filter(t => t !== ticker) : [...saved, ticker]; setSaved(next); void AsyncStorage.setItem('watchlist', JSON.stringify(next)).catch(() => {}); };
  return <SafeAreaView style={s.root}><ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
    <View style={s.row}><Label>Closing Bell</Label><Text style={s.copy}>MAINNET</Text></View>
    {stock ? <Stock key={stock} ticker={stock} saved={saved.includes(stock)} toggle={() => toggle(stock)} back={() => setStock(null)} /> : <>
      {tab === 'Watch' && <><Text style={s.title}>A clearer view.</Text><Copy>Check the price before your next stock-token purchase.</Copy><Notice message="Live token quotes compared with equity references. Corporate-action adjustments are under review; these differences are observations, not verified overpayment." />
        {[...markets].sort((a, b) => Number(saved.includes(b.ticker)) - Number(saved.includes(a.ticker))).map(m => <MarketRow key={m.ticker} ticker={m.ticker} saved={saved.includes(m.ticker)} open={() => setStock(m.ticker)} />)}<Button secondary title="Refresh markets" onPress={() => { void client.invalidateQueries({ queryKey: ['cost'] }); }} />{!ready && <Copy>Restoring watchlist…</Copy>}</>}
      {tab === 'Portfolio' && <Portfolio />}
      {tab === 'Activity' && <><Text style={s.title}>Activity</Text><Notice message="No purchases yet. Confirmed purchases will appear here when execution is enabled." /></>}
      {tab === 'Settings' && <Settings />}
    </>}
  </ScrollView><View style={s.tabs}>{tabs.map(t => <Pressable key={t} accessibilityRole="tab" accessibilityState={{ selected: t === tab && !stock }} style={s.tab} onPress={() => { setStock(null); setTab(t); }}><Text style={[s.tabText, t === tab && !stock && s.selected]}>{t}</Text></Pressable>)}</View></SafeAreaView>;
}
function MarketRow({ ticker, saved, open }: { ticker: Ticker; saved: boolean; open: () => void }) {
  const market = markets.find(m => m.ticker === ticker)!;
  const query = useQuery({ queryKey: ['cost', ticker, 1000], queryFn: ({ signal }) => request(`/api/truecost?ticker=${ticker}&notional=1000`, costSchema, signal) });
  return <Pressable accessibilityRole="button" accessibilityLabel={`Open ${market.name}`} onPress={open} style={s.card}><View style={s.row}><View style={s.badge}><Text style={[s.badgeText, { color: market.color }]}>{market.mark}</Text></View><View style={s.flex}><Text style={s.subtitle}>{market.name}</Text><Copy>{ticker}{saved ? ' · Watching' : ''}</Copy></View><Text style={s.back}>↗</Text></View><View style={s.row}><Text style={s.subtitle}>{query.data ? usd(query.data.pool.fillPrice) : query.isPending ? 'Reading…' : 'Unavailable'}</Text><Text style={s.copy}>{query.data ? percent(query.data.breakdown.trueCostBps) : 'Open quote'}</Text></View>{query.data && <Copy>vs equity · reference {query.data.oracle.ageSecs}s old · $1,000 quote</Copy>}</Pressable>;
}
function Stock({ ticker, saved, toggle, back }: { ticker: Ticker; saved: boolean; toggle: () => void; back: () => void }) {
  const [amount, setAmount] = useState('100'); const [band, setBand] = useState(50); const [review, setReview] = useState(false);
  const value = Number(amount); const valid = Number.isFinite(value) && value >= 100 && value <= 10_000_000;
  const market = markets.find(m => m.ticker === ticker)!;
  const quote = useQuery({ queryKey: ['guard', ticker, value, band], enabled: review && valid, queryFn: ({ signal }) => request(`/api/guarded-swap?ticker=${ticker}&notional=${value}&band=${band}`, guardSchema, signal), staleTime: 0 });
  return <><Pressable accessibilityRole="button" onPress={back}><Text style={s.back}>← Watch</Text></Pressable><Label>{ticker} / xStocks</Label><Text style={s.title}>{market.name}</Text><Button secondary title={saved ? 'Remove from watchlist' : 'Add to watchlist'} onPress={toggle} />
    <View style={s.card}><Label>Purchase amount · USDC</Label><TextInput accessibilityLabel="Purchase amount in USDC" style={s.input} value={amount} onChangeText={text => { setAmount(text); setReview(false); }} keyboardType="decimal-pad" />{!valid && <Copy>Enter $100 to $10,000,000.</Copy>}<Label>Maximum above equity reference</Label><View style={s.row}>{[10, 25, 50, 100].map(b => <Pressable key={b} accessibilityRole="button" accessibilityState={{ selected: band === b }} onPress={() => { setBand(b); setReview(false); }} style={s.tab}><Text style={[s.tabText, band === b && s.selected]}>{(b / 100).toFixed(2)}%</Text></Pressable>)}</View><Button title="Check this quote" disabled={!valid} onPress={() => { setReview(true); if (review) void quote.refetch(); }} /></View>
    {review && quote.isPending && <Notice loading message="Reading the reference and finding a route…" />}{review && quote.isError && <Notice message={quote.error.message} retry={() => void quote.refetch()} />}
    {review && quote.data && <View style={s.card}><Label>{quote.data.derivation.buildable ? 'Quote fits selected limit' : 'Outside selected limit'}</Label><Text style={s.value}>{percent(quote.data.derivation.quotedDeviationBps)}</Text><Copy>Compared with the unadjusted equity reference. Reference age: {quote.data.oracle.ageSecs}s.</Copy><View style={s.row}><Copy>Reference price</Copy><Text style={s.subtitle}>{usd(quote.data.oracle.priceUsd)}</Text></View><View style={s.row}><Copy>Selected ceiling</Copy><Text style={s.subtitle}>{usd(quote.data.derivation.maxPriceUsd)}</Text></View><Copy>Observed {new Date(quote.data.capturedAt).toLocaleTimeString()}</Copy></View>}
    <Notice message="Purchase execution is paused while token entitlement and reference quality are verified. Inspecting quotes does not sign or spend." /><Button secondary title="Refresh quote" disabled={!review || quote.isFetching} onPress={() => void quote.refetch()} />
  </>;
}
function Portfolio() {
  const wallet = useMobileWallet(); const [address, setAddress] = useState(''); const [lookup, setLookup] = useState(''); const [error, setError] = useState('');
  const effective = wallet.account?.address.toString() ?? lookup;
  const query = useQuery({ queryKey: ['position', effective], enabled: !!effective, queryFn: ({ signal }) => request(`/api/position?address=${encodeURIComponent(effective)}`, positionSchema, signal) });
  return <><Text style={s.title}>Your positions.</Text><Copy>Read-only view of supported stock tokens.</Copy><WalletButton onError={setError} />{error && <Copy>{error}</Copy>}
    {!wallet.account && <View style={s.card}><Label>Or watch an address</Label><TextInput accessibilityLabel="Solana wallet address" autoCapitalize="none" autoCorrect={false} style={s.input} value={address} onChangeText={setAddress} placeholder="Solana address" placeholderTextColor={colors.muted} /><Button secondary title="Look up holdings" disabled={!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address.trim())} onPress={() => setLookup(address.trim())} /></View>}
    {effective && <Copy>{effective}</Copy>}{effective && query.isPending && <Notice loading message="Reading holdings…" />}{query.isError && <Notice message={query.error.message} retry={() => void query.refetch()} />}
    {query.data && <>{!query.data.holdings.length && <Notice message="No supported stock tokens found." />}{query.data.holdings.map(h => <View key={h.ticker} style={s.card}><Label>{h.ticker}</Label><Text style={s.subtitle}>{h.label}</Text><Text style={s.value}>{h.qty.toLocaleString('en-US', { maximumFractionDigits: 6 })}</Text><Copy>Backend-reported quantity. Valuation is withheld until raw and adjusted price units are reconciled.</Copy></View>)}<Button secondary title="Refresh holdings" onPress={() => void query.refetch()} /></>}
  </>;
}
function WalletButton({ onError }: { onError: (message: string) => void }) {
  const wallet = useMobileWallet(); const [busy, setBusy] = useState(false);
  async function connect() { setBusy(true); onError(''); try { if (wallet.account) await wallet.disconnect(); else await wallet.connect(); } catch (error) { onError(error instanceof Error ? error.message : 'Wallet connection could not be completed.'); } finally { setBusy(false); } }
  return <Button title={busy ? 'Opening wallet…' : wallet.account ? 'Disconnect wallet' : 'Connect wallet'} disabled={busy} onPress={() => void connect()} />;
}
function Settings() {
  const [error, setError] = useState('');
  return <><Text style={s.title}>Settings</Text><View style={s.card}><Label>Wallet</Label><Copy>Connect through your installed wallet. Closing Bell never requests your recovery phrase.</Copy><WalletButton onError={setError} />{error && <Copy>{error}</Copy>}</View><View style={s.card}><Label>Data source</Label><Copy>{API_URL}</Copy><Copy>Quotes are estimates. A price difference is not a promise of savings.</Copy></View><Button secondary title="Read the methodology" onPress={() => { void Linking.openURL(`${API_URL}/findings`).catch(() => setError('Could not open the browser.')); }} /><Copy>Closing Bell · 0.1.0</Copy></>;
}
