import React, { useEffect, useRef, useState } from 'react';
import { BackHandler, Image, Keyboard, KeyboardAvoidingView, Linking, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMobileWallet } from '@wallet-ui/react-native-web3js';
import { Comparison, getComparison, getMarketSession, MarketClosedError, getPositions, getReserve, marketFor, markets, percent, RPC_URL, Ticker, usd } from './api';
import { Onboarding } from './Onboarding';
import { ProtectCard } from './ProtectCard';
import { ensureBackgroundSweep } from './background';
import { lastSweep, sweep } from './watch';
import { refreshWidget } from './widget/handler';
import { AlertList, HistoryChart, WidgetButton } from './WatchViews';
import { ShareButton } from './Share';
import { ageLabel, SavedCheck, savedCheckSchema } from './decision';
import { Button, colors, Copy, DataRow, Label, Notice, Pill, s } from './ui';

type Tab = 'Markets' | 'Checks' | 'Backing' | 'Wallet';
const tabs: Tab[] = ['Markets', 'Checks', 'Backing', 'Wallet'];
const checksKey = 'issuer-checks-v2';
const watchKey = 'watchlist';
const onboardedKey = 'onboarded-v1';
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
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [onboarded, setOnboarded] = useState(true);
  const scroll = useRef<ScrollView>(null);
  const offset = useRef(0);

  // Edge-to-edge Android does not resize the window for the keyboard, so keep the focused field above it.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const show = Keyboard.addListener('keyboardDidShow', event => {
      setKeyboardOpen(true);
      timer = setTimeout(() => TextInput.State.currentlyFocusedInput()?.measureInWindow((_x, y, _w, height) => {
        const overlap = y + height + 24 - event.endCoordinates.screenY;
        if (overlap > 0) scroll.current?.scrollTo({ y: offset.current + overlap, animated: true });
      }), 60);
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardOpen(false));
    return () => { show.remove(); hide.remove(); clearTimeout(timer); };
  }, []);

  useEffect(() => {
    Promise.all([AsyncStorage.getItem(watchKey), AsyncStorage.getItem(checksKey), AsyncStorage.getItem(onboardedKey)]).then(([watchValue, checkValue, onboardedValue]) => {
      setOnboarded(onboardedValue === 'yes');
      if (watchValue) { const parsed: unknown = JSON.parse(watchValue); if (Array.isArray(parsed)) setWatch(markets.filter(m => parsed.includes(m.ticker)).map(m => m.ticker)); }
      if (checkValue) { const parsed: unknown = JSON.parse(checkValue); if (Array.isArray(parsed)) setChecks(parsed.flatMap(item => { const result = savedCheckSchema.safeParse(item); return result.success ? [result.data] : []; })); }
    }).catch(() => setError('Saved data could not be loaded on this device.')).finally(() => setReady(true));
  }, []);
  // Keep history and the widget current while the app is open; the background task covers the rest.
  useEffect(() => {
    void ensureBackgroundSweep().catch(() => undefined);
    void (async () => {
      const last = await lastSweep();
      if (last && Date.now() - last < 600_000) return;
      await sweep();
      await refreshWidget();
      await client.invalidateQueries({ queryKey: ['history'] });
    })().catch(() => undefined);
  }, [client]);
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
  const finishOnboarding = () => { setOnboarded(true); void AsyncStorage.setItem(onboardedKey, 'yes').catch(() => undefined); };

  if (ready && !onboarded) return <Onboarding done={finishOnboarding} />;

  return <SafeAreaView style={s.root}><KeyboardAvoidingView style={s.flex} behavior="padding"><ScrollView ref={scroll} onScroll={event => { offset.current = event.nativeEvent.contentOffset.y; }} scrollEventThrottle={32} key={stock ? `stock:${stock}:${repeatCheck?.id ?? 'new'}` : `tab:${tab}`} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
    <View style={s.header}><Image source={require('../assets/icon.png')} style={s.logo} resizeMode="contain" /><View style={s.flex}><Text style={s.brand} numberOfLines={1} adjustsFontSizeToFit maxFontSizeMultiplier={1.2}>Closing <Text style={s.brandGold}>Bell.</Text></Text><Text style={s.faint} numberOfLines={1} adjustsFontSizeToFit maxFontSizeMultiplier={1.2}>TOKEN COST. BACKING. CLEAR LIMITS.</Text></View><Pill title="MAINNET" /></View>
    {stock ? <Stock ticker={stock} previous={repeatCheck} watched={watch.includes(stock)} toggle={() => toggle(stock)} back={() => setStock(null)} save={saveCheck} viewChecks={() => { setStock(null); setTab('Checks'); }} /> : <>
      {tab === 'Markets' && <><View style={s.compactHero}><Label>BEFORE YOU SWAP</Label><Text style={s.sectionHeading}>What will this xStock really cost?</Text><Copy>Jupiter's live price for $1,000, next to xStocks' own price for the same token.</Copy><Session /></View>
        {[...markets].sort((a, b) => Number(watch.includes(b.ticker)) - Number(watch.includes(a.ticker))).map(m => <MarketRow key={m.ticker} ticker={m.ticker} watched={watch.includes(m.ticker)} last={checks.find(check => check.ticker === m.ticker)} open={() => open(m.ticker)} />)}
        <Button secondary title="Refresh markets" onPress={() => { void client.invalidateQueries({ queryKey: ['comparison'] }); }} /><WidgetButton />{!ready && <Copy>Restoring saved checks…</Copy>}</>}
      {tab === 'Checks' && <><View style={s.hero}><Label>YOUR HISTORY</Label><Text style={s.title}>Saved checks.</Text><Copy>Snapshots saved on this phone. Prices move, so check again before you swap.</Copy></View>
        <AlertList />{error && <Notice message={error} />}{ready && checks.length === 0 && <Notice message="No checks saved yet. Choose a token, set a limit, and save the result here." />}
        {checks.map(check => <View key={check.id} style={s.card}><View style={s.row}><View><Label>{check.ticker} / ROUTE CHECK</Label><Text style={s.subtitle}>{usd(check.amount)}</Text></View><Pill title={check.outcome === 'within' ? 'WITHIN LIMIT' : 'OVER LIMIT'} tone={check.outcome === 'within' ? 'green' : 'red'} /></View>
          <DataRow label="Over xStocks' price" value={percent(check.differenceBps)} hint={`Your limit ${(check.band / 100).toFixed(2)}%`} />
          <DataRow label="Jupiter's price" value={usd(check.tokenFillPrice)} /><DataRow label="xStocks' price" value={usd(check.issuerIndicativePrice)} />
          <Text style={s.faint}>CHECKED {time(check.checkedAt).toUpperCase()}</Text>
          <Button title={`Check ${check.ticker} again`} onPress={() => open(check.ticker, check)} /><Button secondary title="Remove saved check" onPress={() => { void removeCheck(check.id); }} />
        </View>)}
      </>}
      {tab === 'Backing' && <Backing />}
      {tab === 'Wallet' && <Wallet />}
    </>}
  </ScrollView>{!keyboardOpen && <View style={s.tabs}>{tabs.map(item => <Pressable key={item} accessibilityRole="tab" accessibilityState={{ selected: item === tab && !stock }} style={[s.tab, item === tab && !stock && s.activeTab]} onPress={() => { setStock(null); setTab(item); }}><Text style={[s.tabText, item === tab && !stock && s.selected]} numberOfLines={1} adjustsFontSizeToFit maxFontSizeMultiplier={1.3}>{item}</Text></Pressable>)}</View>}</KeyboardAvoidingView></SafeAreaView>;
}

function Session() {
  const query = useQuery({ queryKey: ['session'], queryFn: ({ signal }) => getMarketSession(signal), staleTime: 60_000, refetchInterval: 300_000 });
  if (!query.data) return null;
  const label = query.data.openNow ? query.data.period === 'market' ? 'US MARKET OPEN' : `US ${query.data.period.toUpperCase()} HOURS` : 'US MARKET CLOSED';
  const next = query.data.nextChangeAt ? ` · CHANGES ${new Date(query.data.nextChangeAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : '';
  return <Text style={s.faint}>{label}{next}</Text>;
}

function MarketRow({ ticker, watched, last, open }: { ticker: Ticker; watched: boolean; last?: SavedCheck; open: () => void }) {
  const market = marketFor(ticker);
  const query = useQuery({ queryKey: ['comparison', ticker, 1000], queryFn: ({ signal }) => getComparison(ticker, 1000, signal) });
  const closed = query.error instanceof MarketClosedError ? query.error : null;
  const fill = query.data?.tokenFillPrice ?? closed?.tokenFillPrice ?? null;
  return <Pressable accessibilityRole="button" accessibilityLabel={`Open ${market.name}`} onPress={open} style={({ pressed }) => [s.card, pressed && { borderColor: colors.gold }]}>
    <View style={s.row}><View style={s.badge}><Text style={[s.badgeText, { color: market.color }]}>{market.mark}</Text></View><View style={s.flex}><Text style={s.subtitle}>{ticker}</Text><Text style={s.faint}>{market.name} · {market.underlying} backing{watched ? ' · WATCHING' : ''}</Text></View><Text style={s.back}>↗</Text></View>
    <View><View style={s.row}><Text style={[s.dataHint, s.flex]}>JUPITER PRICE FOR $1,000</Text><Pill title={closed ? 'MARKET CLOSED' : query.isError ? 'UNAVAILABLE' : query.data ? `${percent(query.data.differenceBps)} OVER` : 'READING'} tone={closed || (query.data && !query.data.issuerLive) ? 'muted' : query.isError ? 'red' : 'gold'} /></View><Text style={s.marketPrice} numberOfLines={1} adjustsFontSizeToFit>{fill !== null ? usd(fill) : query.isPending ? 'Reading…' : '—'}</Text></View>
    <DataRow label="xStocks' price" value={query.data ? usd(query.data.issuerIndicativePrice) : closed ? 'Paused' : '—'} hint={query.data && !query.data.issuerLive ? `Last read ${time(query.data.issuerAt)}` : closed ? 'Resumes when the US market opens' : "The issuer's indicative price for the token"} />
    <DataRow label="You'd pay over xStocks" value={query.data ? percent(query.data.differenceBps) : '—'} hint={query.data && !query.data.issuerLive ? "Jupiter now versus xStocks' last price" : "Jupiter price versus xStocks' price"} accent={!!query.data?.issuerLive} />
    {query.data && <Text style={s.faint}>{query.data.issuerLive ? `CHECKED ${time(query.data.capturedAt).toUpperCase()} · XSTOCKS DOESN'T TIMESTAMP ITS PRICE` : 'US MARKET CLOSED · XSTOCKS HAS PAUSED ITS PRICE · USING THE LAST ONE THIS PHONE READ'}</Text>}
    {last && <Text style={s.faint}>YOUR LAST CHECK {new Date(last.checkedAt).toLocaleDateString()} · {last.outcome === 'within' ? 'WITHIN LIMIT' : 'OVER LIMIT'}</Text>}
    {closed && <Text style={s.faint}>US MARKET CLOSED · JUPITER STILL TRADES {ticker} · THE COMPARISON RETURNS WHEN XSTOCKS RESUMES ITS PRICE</Text>}
    {query.isError && !closed && <Text style={s.faint}>{query.error.message}</Text>}
  </Pressable>;
}

function Stock({ ticker, previous, watched, toggle, back, save, viewChecks }: { ticker: Ticker; previous: SavedCheck | null; watched: boolean; toggle: () => void; back: () => void; save: (check: SavedCheck) => Promise<void>; viewChecks: () => void }) {
  const market = marketFor(ticker);
  const [amount, setAmount] = useState(previous ? String(previous.amount) : '100');
  const [band, setBand] = useState(previous?.band ?? 50);
  const [review, setReview] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const resultCard = useRef<View>(null);
  const value = Number(amount);
  const valid = /^\d+(\.\d{1,2})?$/.test(amount) && value >= 100 && value <= 10_000_000;
  const quote = useQuery({ queryKey: ['comparison', ticker, value, band], enabled: review && valid, queryFn: ({ signal }) => getComparison(ticker, value, signal), staleTime: 0 });
  // Keep the last result on screen during a refetch (e.g. on returning from Jupiter or a permission prompt); the query key changes with amount and limit, so it always matches the inputs.
  const result: Comparison | null = review && !quote.isError ? quote.data ?? null : null;
  const outcome = result ? result.differenceBps > band ? 'above' : 'within' : null;
  async function saveCurrent() {
    if (!result || !outcome || saved) return;
    try { await save({ id: `${ticker}-${Date.now()}`, ticker, amount: value, band, differenceBps: result.differenceBps, outcome,
      issuerIndicativePrice: result.issuerIndicativePrice, tokenFillPrice: result.tokenFillPrice, capturedAt: result.capturedAt, checkedAt: new Date().toISOString() }); setSaved(true); setError(''); }
    catch { setError('Could not save this check on your device.'); }
  }
  return <><Pressable accessibilityRole="button" onPress={back}><Text style={s.back}>← Markets</Text></Pressable>
    <View style={s.hero}><Label>CHECK BEFORE YOU SWAP / {ticker}</Label><Text style={s.title}>{market.name}</Text><Copy>{`Set your amount and the most you'll pay above xStocks' price. We check Jupiter's live route against it.`}</Copy></View>
    {previous && <Copy>Previous amount and limit restored. Run a new check to see what changed.</Copy>}
    <Button secondary title={watched ? 'Remove from watchlist' : 'Add to watchlist'} onPress={toggle} />
    <View style={s.card}><View style={s.row}><Label>01 / YOUR LIMIT</Label><Pill title="NO SIGNING" tone="muted" /></View>
      <Text style={s.dataLabel}>How much USDC will you spend?</Text><TextInput accessibilityLabel="Amount in USDC" style={s.input} value={amount} onChangeText={text => { setAmount(text.replace(/,/g, '.').replace(/\s/g, '')); setReview(false); setSaved(false); }} keyboardType="decimal-pad" />
      {!valid && <Copy>Enter $100 to $10,000,000 with up to two decimals.</Copy>}
      <Text style={s.dataLabel}>{`Most you'll pay above xStocks' price`}</Text><View style={s.row}>{[10, 25, 50, 100].map(option => <Pressable key={option} accessibilityRole="button" accessibilityState={{ selected: band === option }} onPress={() => { setBand(option); setReview(false); setSaved(false); }} style={[s.bandOption, band === option && s.bandSelected]}><Text style={[s.bandText, band === option && s.selected]} numberOfLines={1} adjustsFontSizeToFit maxFontSizeMultiplier={1.3}>{(option / 100).toFixed(2)}%</Text></Pressable>)}</View>
      <Button title="Check Jupiter's price" disabled={!valid || quote.isFetching} onPress={() => { setReview(true); if (review) void quote.refetch(); }} />
    </View>
    {review && quote.isFetching && <Notice loading message="Reading Jupiter and xStocks…" />}
    {review && quote.isError && <Notice message={quote.error.message} retry={() => void quote.refetch()} />}
    {result && outcome && <><View ref={resultCard} collapsable={false} style={[s.card, s.resultCard, outcome === 'above' && s.resultRed]}>
      <View style={s.row}><Label>02 / RESULT</Label><Pill title={outcome === 'above' ? 'OVER YOUR LIMIT' : 'WITHIN YOUR LIMIT'} tone={outcome === 'above' ? 'red' : 'green'} /></View>
      <Text style={s.value} numberOfLines={1} adjustsFontSizeToFit>{percent(result.differenceBps)}</Text><Copy>{`You'd pay ${percent(result.differenceBps)} over xStocks' price for this swap. Your limit is ${(band / 100).toFixed(2)}%.`}</Copy>
      <DataRow label="Jupiter's price for you" value={usd(result.tokenFillPrice)} hint={result.venues.length ? `Route via ${result.venues.join(', ')}` : `Solana slot ${result.routeSlot}`} />
      <DataRow label="xStocks' price" value={usd(result.issuerIndicativePrice)} hint={result.issuerLive ? "Indicative; xStocks doesn't timestamp it" : `Last read ${time(result.issuerAt)} · paused while the US market is closed`} />
      <DataRow label="Your limit price" value={usd(result.issuerIndicativePrice * (1 + band / 10_000))} hint={`xStocks' price + ${(band / 100).toFixed(2)}%`} accent />
      <Text style={s.faint}>CHECKED {time(result.capturedAt).toUpperCase()}</Text>
      {!result.issuerLive && <Copy>{`The US market is closed, so xStocks has paused its price. This compares Jupiter's live route with the last xStocks price this phone read. Check again after the market opens before relying on it.`}</Copy>}
      {previous && <View style={s.notice}><Label>SINCE YOUR SAVED CHECK</Label><Copy>{previous.amount === value && previous.band === band
        ? `Previous ${percent(previous.differenceBps)} · now ${percent(result.differenceBps)} · ${Math.abs(result.differenceBps - previous.differenceBps).toFixed(0)} bp ${result.differenceBps >= previous.differenceBps ? 'higher' : 'lower'}. Both are indicative snapshots.`
        : 'A like-for-like change needs the same amount and limit.'}</Copy></View>}
      <Text style={[s.faint, s.signature]} numberOfLines={1} adjustsFontSizeToFit>{`CLOSING BELL · ${ticker} · ${usd(value)}`}</Text>
    </View>
      <Button secondary title={saved ? 'Saved to your checks' : 'Save this check'} disabled={saved} onPress={() => { void saveCurrent(); }} />
      {saved && <Button title="View saved checks" onPress={viewChecks} />}{error && <Notice message={error} />}
      <ShareButton target={resultCard} title={`Share ${ticker} check`} />
    </>}
    {result && <ProtectCard result={result} band={band} />}
    <HistoryChart ticker={ticker} band={band} />
    <Notice message="Closing Bell compares two prices for the same token: Jupiter's and xStocks'. It is not the underlying share price. It never signs, swaps or moves your funds." />
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
      {query.data.map(position => <View key={position.ticker} style={s.card}><Label>{position.ticker} / ON-CHAIN</Label><Text style={s.subtitle}>{position.label}</Text><Text style={s.value} numberOfLines={1} adjustsFontSizeToFit>{position.qty.toLocaleString('en-US', { maximumFractionDigits: 6 })}</Text><Copy>Token quantity. No cash valuation is implied.</Copy></View>)}
      <Button secondary title="Refresh holdings" onPress={() => void query.refetch()} /></>}
    <Text style={s.faint}>RPC {RPC_URL}</Text>
  </>;
}
