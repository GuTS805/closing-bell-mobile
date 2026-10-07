import React, { useEffect, useState } from 'react';
import { BackHandler, Image, Linking, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMobileWallet } from '@wallet-ui/react-native-web3js';
import { Comparison, getComparison, getPositions, getReserve, marketFor, markets, percent, RPC_URL, Ticker, usd } from './api';
import { ageLabel, SavedCheck, savedCheckSchema } from './decision';
import { Button, colors, Copy, DataRow, Label, Notice, Pill, s } from './ui';

type Tab = 'Markets' | 'Checks' | 'Backing' | 'Wallet';
const tabs: Tab[] = ['Markets', 'Checks', 'Backing', 'Wallet'];
const checksKey = 'issuer-checks-v2';
const watchKey = 'watchlist';
const time = (iso: string) => new Date(iso).toLocaleString();

export function Shell() {
  const client = useQueryClient();
  const [tab, setTab] = useState<Tab>('Markets');
  const [stock, setStock] = useState<Ticker | null>(null);
  const [repeatCheck, setRepeatCheck] = useState<SavedCheck | null>(null);
  const [watch, setWatch] = useState<Ticker[]>([]);
  const [checks, setChecks] = useState<SavedCheck[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([AsyncStorage.getItem(watchKey), AsyncStorage.getItem(checksKey)]).then(([watchValue, checkValue]) => {
      if (watchValue) { const parsed: unknown = JSON.parse(watchValue); if (Array.isArray(parsed)) setWatch(markets.filter(m => parsed.includes(m.ticker)).map(m => m.ticker)); }
      if (checkValue) { const parsed: unknown = JSON.parse(checkValue); if (Array.isArray(parsed)) setChecks(parsed.flatMap(item => { const result = savedCheckSchema.safeParse(item); return result.success ? [result.data] : []; })); }
    }).catch(() => setError('Saved data could not be loaded on this device.')).finally(() => setReady(true));
  }, []);
  useEffect(() => { const listener = BackHandler.addEventListener('hardwareBackPress', () => { if (!stock) return false; setStock(null); return true; }); return () => listener.remove(); }, [stock]);
  const toggle = (ticker: Ticker) => {
    const next = watch.includes(ticker) ? watch.filter(item => item !== ticker) : [...watch, ticker];
    setWatch(next); void AsyncStorage.setItem(watchKey, JSON.stringify(next)).catch(() => setError('Watchlist could not be saved.'));
  };
  const saveCheck = async (check: SavedCheck) => {
    if (!ready) throw new Error('History is still loading.');
    const next = [check, ...checks].slice(0, 30);
    await AsyncStorage.setItem(checksKey, JSON.stringify(next));
    setChecks(next); setError('');
  };
  const removeCheck = async (id: string) => {
    try { const next = checks.filter(check => check.id !== id); await AsyncStorage.setItem(checksKey, JSON.stringify(next)); setChecks(next); }
    catch { setError('Could not remove this check from your device.'); }
  };
  const open = (ticker: Ticker, previous: SavedCheck | null = null) => { setRepeatCheck(previous); setStock(ticker); };

  return <SafeAreaView style={s.root}><ScrollView key={stock ? `stock:${stock}:${repeatCheck?.id ?? 'new'}` : `tab:${tab}`} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
    <View style={s.header}><Image source={require('../assets/icon.png')} style={s.logo} resizeMode="contain" /><View style={s.flex}><Text style={s.brand}>Closing <Text style={s.brandGold}>Bell.</Text></Text><Text style={s.faint}>TOKEN COST. BACKING. CLEAR LIMITS.</Text></View><Pill title="MAINNET" /></View>
    {stock ? <Stock ticker={stock} previous={repeatCheck} watched={watch.includes(stock)} toggle={() => toggle(stock)} back={() => setStock(null)} save={saveCheck} viewChecks={() => { setStock(null); setTab('Checks'); }} /> : <>
      {tab === 'Markets' && <><View style={s.compactHero}><Label>YOUR TOKEN DESK</Label><Text style={s.sectionHeading}>Know what the route costs.</Text><Copy>Compare a Jupiter token quote with xStocks' indicative token price. The issuer does not provide a price timestamp.</Copy></View>
        {[...markets].sort((a, b) => Number(watch.includes(b.ticker)) - Number(watch.includes(a.ticker))).map(m => <MarketRow key={m.ticker} ticker={m.ticker} watched={watch.includes(m.ticker)} last={checks.find(check => check.ticker === m.ticker)} open={() => open(m.ticker)} />)}
        <Button secondary title="Refresh markets" onPress={() => { void client.invalidateQueries({ queryKey: ['comparison'] }); }} />{!ready && <Copy>Restoring saved checks…</Copy>}</>}
      {tab === 'Checks' && <><View style={s.hero}><Label>YOUR HISTORY</Label><Text style={s.title}>Saved checks.</Text><Copy>Indicative observations saved on this phone. Run a new check before deciding.</Copy></View>
        {error && <Notice message={error} />}{ready && checks.length === 0 && <Notice message="No checks saved yet. Choose a token, set a limit, and save the result here." />}
        {checks.map(check => <View key={check.id} style={s.card}><View style={s.row}><View><Label>{check.ticker} / ROUTE CHECK</Label><Text style={s.subtitle}>{usd(check.amount)}</Text></View><Pill title={check.outcome === 'within' ? 'INSIDE LIMIT' : 'ABOVE LIMIT'} tone={check.outcome === 'within' ? 'green' : 'red'} /></View>
          <DataRow label="Vs issuer indicative" value={percent(check.differenceBps)} hint={`Your limit ${(check.band / 100).toFixed(2)}%`} />
          <DataRow label="Token route" value={usd(check.tokenFillPrice)} /><DataRow label="Issuer indicative" value={usd(check.issuerIndicativePrice)} />
          <Text style={s.faint}>CHECKED {time(check.checkedAt).toUpperCase()} · ISSUER PRICE AGE UNKNOWN</Text>
          <Button title={`Check ${check.ticker} again`} onPress={() => open(check.ticker, check)} /><Button secondary title="Remove saved check" onPress={() => { void removeCheck(check.id); }} />
        </View>)}
      </>}
      {tab === 'Backing' && <Backing />}
      {tab === 'Wallet' && <Wallet />}
    </>}
  </ScrollView><View style={s.tabs}>{tabs.map(item => <Pressable key={item} accessibilityRole="tab" accessibilityState={{ selected: item === tab && !stock }} style={[s.tab, item === tab && !stock && s.activeTab]} onPress={() => { setStock(null); setTab(item); }}><Text style={[s.tabText, item === tab && !stock && s.selected]}>{item}</Text></Pressable>)}</View></SafeAreaView>;
}

function MarketRow({ ticker, watched, last, open }: { ticker: Ticker; watched: boolean; last?: SavedCheck; open: () => void }) {
  const market = marketFor(ticker);
  const query = useQuery({ queryKey: ['comparison', ticker, 1000], queryFn: ({ signal }) => getComparison(ticker, 1000, signal) });
  return <Pressable accessibilityRole="button" accessibilityLabel={`Open ${market.name}`} onPress={open} style={({ pressed }) => [s.card, pressed && { borderColor: colors.gold }]}>
    <View style={s.row}><View style={s.badge}><Text style={[s.badgeText, { color: market.color }]}>{market.mark}</Text></View><View style={s.flex}><Text style={s.subtitle}>{ticker}</Text><Text style={s.faint}>{market.name} · {market.underlying} backing{watched ? ' · WATCHING' : ''}</Text></View><Text style={s.back}>↗</Text></View>
    <View style={s.row}><View style={s.flex}><Text style={s.dataHint}>JUPITER TOKEN QUOTE / $1,000</Text><Text style={s.marketPrice}>{query.data ? usd(query.data.tokenFillPrice) : query.isPending ? 'Reading…' : '—'}</Text></View><Pill title={query.isError ? 'UNAVAILABLE' : 'AGE UNKNOWN'} tone={query.isError ? 'red' : 'gold'} /></View>
    <DataRow label="Issuer indicative token" value={query.data ? usd(query.data.issuerIndicativePrice) : '—'} hint="xStocks · price timestamp not supplied" />
    <DataRow label="Route difference" value={query.data ? percent(query.data.differenceBps) : '—'} hint="Token route versus issuer indicative" accent={!!query.data} />
    {query.data && <Text style={s.faint}>ROUTE REQUESTED {time(query.data.capturedAt).toUpperCase()} · SOURCE AGE UNKNOWN</Text>}
    {last && <Text style={s.faint}>LAST CHECK {new Date(last.checkedAt).toLocaleDateString()} · {last.outcome === 'within' ? 'INSIDE LIMIT' : 'ABOVE LIMIT'}</Text>}
    {query.isError && <Text style={s.faint}>{query.error.message}</Text>}
  </Pressable>;
}

function Stock({ ticker, previous, watched, toggle, back, save, viewChecks }: { ticker: Ticker; previous: SavedCheck | null; watched: boolean; toggle: () => void; back: () => void; save: (check: SavedCheck) => Promise<void>; viewChecks: () => void }) {
  const market = marketFor(ticker);
  const [amount, setAmount] = useState(previous ? String(previous.amount) : '100');
  const [band, setBand] = useState(previous?.band ?? 50);
  const [review, setReview] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const value = Number(amount);
  const valid = /^\d+(\.\d{1,2})?$/.test(amount) && value >= 100 && value <= 10_000_000;
  const quote = useQuery({ queryKey: ['comparison', ticker, value, band], enabled: review && valid, queryFn: ({ signal }) => getComparison(ticker, value, signal), staleTime: 0 });
  const result: Comparison | null = review && !quote.isFetching && !quote.isError ? quote.data ?? null : null;
  const outcome = result ? result.differenceBps > band ? 'above' : 'within' : null;
  async function saveCurrent() {
    if (!result || !outcome || saved) return;
    try { await save({ id: `${ticker}-${Date.now()}`, ticker, amount: value, band, differenceBps: result.differenceBps, outcome,
      issuerIndicativePrice: result.issuerIndicativePrice, tokenFillPrice: result.tokenFillPrice, capturedAt: result.capturedAt, checkedAt: new Date().toISOString() }); setSaved(true); setError(''); }
    catch { setError('Could not save this check on your device.'); }
  }
  return <><Pressable accessibilityRole="button" onPress={back}><Text style={s.back}>← Markets</Text></Pressable>
    <View style={s.hero}><Label>PRICE YOUR ROUTE / {ticker}</Label><Text style={s.title}>{market.name}</Text><Copy>See whether a token route stays inside your limit against the issuer's indicative token price.</Copy></View>
    {previous && <Copy>Previous amount and limit restored. Run a new check to see what changed.</Copy>}
    <Button secondary title={watched ? 'Remove from watchlist' : 'Add to watchlist'} onPress={toggle} />
    <View style={s.card}><View style={s.row}><Label>01 / YOUR LIMIT</Label><Pill title="READ ONLY" tone="muted" /></View>
      <Text style={s.dataLabel}>Amount to inspect · USDC</Text><TextInput accessibilityLabel="Amount in USDC" style={s.input} value={amount} onChangeText={text => { setAmount(text); setReview(false); setSaved(false); }} keyboardType="decimal-pad" />
      {!valid && <Copy>Enter $100 to $10,000,000 with up to two decimals.</Copy>}
      <Text style={s.dataLabel}>Maximum above issuer indicative</Text><View style={s.row}>{[10, 25, 50, 100].map(option => <Pressable key={option} accessibilityRole="button" accessibilityState={{ selected: band === option }} onPress={() => { setBand(option); setReview(false); setSaved(false); }} style={[s.bandOption, band === option && s.bandSelected]}><Text style={[s.bandText, band === option && s.selected]}>{(option / 100).toFixed(2)}%</Text></Pressable>)}</View>
      <Button title="Check this route" disabled={!valid || quote.isFetching} onPress={() => { setReview(true); if (review) void quote.refetch(); }} />
    </View>
    {review && quote.isFetching && <Notice loading message="Reading Jupiter and xStocks…" />}
    {review && quote.isError && <Notice message={quote.error.message} retry={() => void quote.refetch()} />}
    {result && outcome && <View style={[s.card, s.resultCard, outcome === 'above' && s.resultRed]}>
      <View style={s.row}><Label>02 / INDICATIVE RESULT</Label><Pill title={outcome === 'above' ? 'ABOVE LIMIT' : 'INSIDE LIMIT'} tone={outcome === 'above' ? 'red' : 'green'} /></View>
      <Text style={s.value}>{percent(result.differenceBps)}</Text><Copy>{outcome === 'above' ? 'The quoted token route is above your chosen indicative limit.' : 'The quoted token route is inside your chosen indicative limit.'}</Copy>
      <DataRow label="Jupiter token route" value={usd(result.tokenFillPrice)} hint={result.venues.join(', ') || `Solana slot ${result.routeSlot}`} />
      <DataRow label="xStocks indicative token" value={usd(result.issuerIndicativePrice)} hint="Issuer does not supply a price timestamp" />
      <DataRow label="Your indicative ceiling" value={usd(result.issuerIndicativePrice * (1 + band / 10_000))} hint={`Issuer indicative + ${(band / 100).toFixed(2)}%`} accent />
      <Text style={s.faint}>ROUTE REQUESTED {time(result.capturedAt).toUpperCase()} · ISSUER PRICE AGE UNKNOWN</Text>
      {previous && <View style={s.notice}><Label>SINCE YOUR SAVED CHECK</Label><Copy>{previous.amount === value && previous.band === band
        ? `Previous ${percent(previous.differenceBps)} · now ${percent(result.differenceBps)} · ${Math.abs(result.differenceBps - previous.differenceBps).toFixed(0)} bp ${result.differenceBps >= previous.differenceBps ? 'higher' : 'lower'}. Both are indicative snapshots.`
        : 'A like-for-like change needs the same amount and limit.'}</Copy></View>}
      <Button secondary title={saved ? 'Saved to your checks' : 'Save this check'} disabled={saved} onPress={() => { void saveCurrent(); }} />
      {saved && <Button title="View saved checks" onPress={viewChecks} />}{error && <Notice message={error} />}
    </View>}
    <Notice message="This comparison uses two token prices. It is not a live underlying share quote or an executable on-chain guard. Issuer price age is unknown; no transaction is signed." />
    <Button secondary title="Refresh route" disabled={!review || quote.isFetching} onPress={() => void quote.refetch()} />
  </>;
}

function Backing() {
  return <><View style={s.hero}><Label>ISSUER RECORD + ON-CHAIN TOKEN</Label><Text style={s.title}>Check the backing.</Text><Copy>Read the issuer's dated reserve record, then inspect each Solana token mint yourself.</Copy></View>
    {markets.map(market => <BackingRow key={market.ticker} ticker={market.ticker} />)}
    <Notice message="Reserve quantities and custody are reported by xStocks. The Solscan link independently shows the token mint on mainnet; it does not independently audit custody." />
  </>;
}
function BackingRow({ ticker }: { ticker: Ticker }) {
  const market = marketFor(ticker);
  const query = useQuery({ queryKey: ['reserve', ticker], queryFn: ({ signal }) => getReserve(ticker, signal), staleTime: 60_000 });
  const [error, setError] = useState('');
  const open = (url: string) => { setError(''); void Linking.openURL(url).catch(() => setError('No browser is available to open this link.')); };
  return <View style={s.card}><View style={s.row}><View><Label>{ticker} / {market.underlying}</Label><Text style={s.subtitle}>{market.name}</Text></View><Pill title="ISSUER DATA" tone="muted" /></View>
    {query.isPending && <Notice loading message="Reading reserve record…" />}
    {query.isError && <Notice message={query.error.message} retry={() => void query.refetch()} />}
    {query.data && <><DataRow label="Shares reported held" value={Number(query.data.sharesHeld).toLocaleString('en-US')} /><DataRow label="Token supply reported" value={Number(query.data.circulatingSupply).toLocaleString('en-US', { maximumFractionDigits: 3 })} />
      <Text style={s.faint}>ISSUER RECORD {time(query.data.timestamp).toUpperCase()} · {ageLabel(query.data.timestamp).toUpperCase()}</Text>
      <Copy>Custodian: {query.data.holdings.map(h => h.provider).join(', ') || 'not specified'}. Counts may require the issuer's multiplier to compare directly.</Copy></>}
    <Button secondary title="View token mint on Solscan" onPress={() => open(`https://solscan.io/token/${market.mint}`)} />
    <Button secondary title="View issuer reserve source" onPress={() => open(`https://api.xstocks.fi/api/v2/public/proof-of-reserves/${ticker}`)} />
    {error && <Notice message={error} />}
  </View>;
}

function Wallet() {
  const wallet = useMobileWallet();
  const [address, setAddress] = useState('');
  const [lookup, setLookup] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const effective = wallet.account?.address.toString() ?? lookup;
  const query = useQuery({ queryKey: ['positions', effective], enabled: !!effective, queryFn: ({ signal }) => getPositions(effective, signal) });
  async function connect() { setBusy(true); setError(''); try { if (wallet.account) await wallet.disconnect(); else await wallet.connect(); }
    catch (caught) { const message = caught instanceof Error ? caught.message : ''; setError(/no installed wallet|no wallet found/i.test(message) ? 'No compatible wallet is installed. Install a Solana wallet with Mobile Wallet Adapter, or look up an address below.' : message || 'Wallet connection could not be completed.'); }
    finally { setBusy(false); } }
  return <><View style={s.hero}><Label>READ-ONLY MAINNET VIEW</Label><Text style={s.title}>Your xStocks.</Text><Copy>Check token quantities in a wallet. This screen never signs or spends.</Copy></View>
    <Button title={busy ? 'Opening wallet…' : wallet.account ? 'Disconnect wallet' : 'Connect wallet'} disabled={busy} onPress={() => { void connect(); }} />{error && <Notice message={error} />}
    {!wallet.account && <View style={s.card}><Label>OR WATCH AN ADDRESS</Label><TextInput accessibilityLabel="Solana wallet address" autoCapitalize="none" autoCorrect={false} style={s.input} value={address} onChangeText={setAddress} placeholder="Solana address" placeholderTextColor={colors.muted} />
      <Button secondary title="Look up holdings" disabled={!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address.trim())} onPress={() => setLookup(address.trim())} /></View>}
    {effective && <View style={s.notice}><Label>WALLET ADDRESS</Label><Copy>{effective}</Copy></View>}
    {query.isPending && effective && <Notice loading message="Reading Solana token accounts…" />}
    {query.isError && <Notice message={query.error.message} retry={() => void query.refetch()} />}
    {query.data && <>{query.data.length === 0 && <Notice message="No supported xStocks found at this address." />}
      {query.data.map(position => <View key={position.ticker} style={s.card}><Label>{position.ticker} / ON-CHAIN</Label><Text style={s.subtitle}>{position.label}</Text><Text style={s.value}>{position.qty.toLocaleString('en-US', { maximumFractionDigits: 6 })}</Text><Copy>Token quantity. No cash valuation is implied.</Copy></View>)}
      <Button secondary title="Refresh holdings" onPress={() => void query.refetch()} /></>}
    <Text style={s.faint}>RPC {RPC_URL}</Text>
  </>;
}
