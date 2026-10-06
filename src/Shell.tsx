import React, { useEffect, useState } from 'react';
import { BackHandler, Image, Linking, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMobileWallet } from '@wallet-ui/react-native-web3js';
import { API_URL, costSchema, guardSchema, markets, percent, positionSchema, request, Ticker, usd } from './api';
import { ageLabel, ageSinceCaptureSeconds, MAX_REFERENCE_AGE_SECS, quoteDecision, referenceAgeSeconds, SavedCheck, savedCheckSchema } from './decision';
import { Button, colors, Copy, DataRow, Label, Notice, Pill, s } from './ui';

type Tab = 'Watch' | 'Portfolio' | 'Checks' | 'Settings';
const tabs: Tab[] = ['Watch', 'Portfolio', 'Checks', 'Settings'];
const checksKey = 'quote-checks-v1';
export function Shell() {
  const client = useQueryClient();
  const [tab, setTab] = useState<Tab>('Watch');
  const [stock, setStock] = useState<Ticker | null>(null);
  const [repeatCheck, setRepeatCheck] = useState<SavedCheck | null>(null);
  const [saved, setSaved] = useState<Ticker[]>([]);
  const [ready, setReady] = useState(false);
  const [checks, setChecks] = useState<SavedCheck[]>([]);
  const [checksReady, setChecksReady] = useState(false);
  const [storageError, setStorageError] = useState('');
  useEffect(() => { AsyncStorage.getItem('watchlist').then(value => {
    if (value) { const parsed: unknown = JSON.parse(value); if (Array.isArray(parsed)) setSaved(markets.filter(m => parsed.includes(m.ticker)).map(m => m.ticker)); }
  }).catch(() => {}).finally(() => setReady(true)); }, []);
  useEffect(() => { AsyncStorage.getItem(checksKey).then(value => {
    if (value) { const parsed: unknown = JSON.parse(value); if (Array.isArray(parsed)) setChecks(parsed.flatMap(item => { const result = savedCheckSchema.safeParse(item); return result.success ? [result.data] : []; })); }
  }).catch(() => setStorageError('Saved checks could not be loaded on this device.')).finally(() => setChecksReady(true)); }, []);
  useEffect(() => { const listener = BackHandler.addEventListener('hardwareBackPress', () => { if (!stock) return false; setStock(null); return true; }); return () => listener.remove(); }, [stock]);
  const toggle = (ticker: Ticker) => { const next = saved.includes(ticker) ? saved.filter(t => t !== ticker) : [...saved, ticker]; setSaved(next); void AsyncStorage.setItem('watchlist', JSON.stringify(next)).catch(() => {}); };
  const saveCheck = async (check: SavedCheck) => {
    if (!checksReady) throw new Error('Saved checks are still loading. Try again.');
    if (storageError) throw new Error(storageError);
    const next = [check, ...checks].slice(0, 30);
    await AsyncStorage.setItem(checksKey, JSON.stringify(next));
    setChecks(next);
    setStorageError('');
  };
  const deleteCheck = async (id: string) => {
    try {
      const next = checks.filter(check => check.id !== id);
      await AsyncStorage.setItem(checksKey, JSON.stringify(next));
      setChecks(next); setStorageError('');
    } catch { setStorageError('Could not remove this check from your device.'); }
  };
  return <SafeAreaView style={s.root}><ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
    <View style={s.header}><Image source={require('../assets/icon.png')} style={s.logo} resizeMode="contain" /><View style={s.flex}><Text style={s.brand}>Closing <Text style={s.brandGold}>Bell.</Text></Text><Text style={s.faint}>TOKENIZED STOCKS. FULL TRANSPARENCY.</Text></View><Pill title="MAINNET" /></View>
    {stock ? <Stock key={`${stock}:${repeatCheck?.id ?? 'new'}`} ticker={stock} initialCheck={repeatCheck} saved={saved.includes(stock)} toggle={() => toggle(stock)} back={() => setStock(null)} saveCheck={saveCheck} viewChecks={() => { setStock(null); setTab('Checks'); }} /> : <>
      {tab === 'Watch' && <><View style={s.hero}><Label>KNOW THE PRICE. SEE THE WHOLE PICTURE.</Label><Text style={s.heroTitle}>The quote is only half the <Text style={s.brandGold}>story.</Text></Text><Copy>See the price behind the token. Compare a quote with the underlying share before you decide.</Copy></View><View style={s.row}><View><Label>YOUR MARKET DESK</Label><Text style={s.sectionHeading}>Explore tokens</Text></View><Text style={s.faint}>04 ASSETS</Text></View>
        {[...markets].sort((a, b) => Number(saved.includes(b.ticker)) - Number(saved.includes(a.ticker))).map(m => <MarketRow key={m.ticker} ticker={m.ticker} saved={saved.includes(m.ticker)} open={() => { setRepeatCheck(null); setStock(m.ticker); }} />)}<Button secondary title="Refresh markets" onPress={() => { void client.invalidateQueries({ queryKey: ['cost'] }); }} />{!ready && <Copy>Restoring watchlist…</Copy>}</>}
      {tab === 'Portfolio' && <Portfolio />}
      {tab === 'Checks' && <>
        <View style={s.hero}><Label>YOUR HISTORY</Label><Text style={s.title}>Saved checks.</Text><Copy>Past observations on this device. Run a new check before making a decision.</Copy></View>
        {storageError && <Notice message={storageError} />}
        {checksReady && checks.length === 0 && <Notice message="No checks saved yet. Choose a token, check a quote, and save the result here." />}
        {checks.map(check => <View key={check.id} style={s.card}>
          <View style={s.row}><View><Label>{check.ticker} / QUOTE CHECK</Label><Text style={s.subtitle}>{usd(check.amount)}</Text></View><Pill title={check.buildable ? 'WITHIN LIMIT' : 'ABOVE LIMIT'} tone={check.buildable ? 'green' : 'red'} /></View>
          <DataRow label="Against reference" value={percent(check.deviation)} hint={`Your limit ${(check.band / 100).toFixed(2)}%`} />
          {check.referencePrice && <DataRow label="Reference" value={usd(check.referencePrice)} />}
          {check.maxPrice && <DataRow label="Your ceiling" value={usd(check.maxPrice)} accent />}
          <Text style={s.faint}>{new Date(check.checkedAt).toLocaleString().toUpperCase()}  /  REFERENCE WAS {ageLabel(check.referenceAge).toUpperCase()} AT CAPTURE</Text>
          <Button title={`Check ${check.ticker} again`} onPress={() => { setRepeatCheck(check); setStock(check.ticker); }} />
          <Button secondary title="Remove saved check" onPress={() => { void deleteCheck(check.id); }} />
        </View>)}
      </>}
      {tab === 'Settings' && <Settings />}
    </>}
  </ScrollView><View style={s.tabs}>{tabs.map(t => <Pressable key={t} accessibilityRole="tab" accessibilityState={{ selected: t === tab && !stock }} style={[s.tab, t === tab && !stock && s.activeTab]} onPress={() => { setStock(null); setTab(t); }}><Text style={[s.tabText, t === tab && !stock && s.selected]}>{t}</Text></Pressable>)}</View></SafeAreaView>;
}
function MarketRow({ ticker, saved, open }: { ticker: Ticker; saved: boolean; open: () => void }) {
  const market = markets.find(m => m.ticker === ticker)!;
  const query = useQuery({ queryKey: ['cost', ticker, 1000], queryFn: ({ signal }) => request(`/api/truecost?ticker=${ticker}&notional=1000`, costSchema, signal) });
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(timer); }, []);
  const fresh = !!query.data && ageSinceCaptureSeconds(query.data.capturedAt, query.data.oracle.ageSecs, now) <= MAX_REFERENCE_AGE_SECS;
  const status = query.isError ? 'UNAVAILABLE' : !query.data ? 'CHECKING' : fresh ? 'FRESH SNAPSHOT' : 'OLD REFERENCE';
  return <Pressable accessibilityRole="button" accessibilityLabel={`Open ${market.name}`} onPress={open} style={({ pressed }) => [s.card, pressed && { borderColor: colors.gold }]}>
    <View style={s.row}><View style={s.badge}><Text style={[s.badgeText, { color: market.color }]}>{market.mark}</Text></View><View style={s.flex}><Text style={s.subtitle}>{ticker}</Text><Text style={s.faint}>{market.name}{saved ? ' · WATCHING' : ''}</Text></View><Text style={s.back}>↗</Text></View>
    <View style={s.row}><Text style={s.marketPrice}>{query.data && !query.isError ? usd(query.data.pool.fillPrice) : query.isPending ? 'Reading…' : '—'}</Text><Pill title={status} tone={fresh && !query.isError ? 'green' : query.isError ? 'red' : 'gold'} /></View>
    <DataRow label="Against the share" value={fresh && !query.isError ? percent(query.data!.breakdown.trueCostBps) : '—'} hint="$1,000 indicative quote" accent={fresh} />
    {query.data && <Text style={s.faint}>PYTH {query.data.oracle.feed ?? 'EQUITY'} · {ageLabel(ageSinceCaptureSeconds(query.data.capturedAt, query.data.oracle.ageSecs, now))}{query.data.pool.venues?.length ? `  /  ${query.data.pool.venues.join(', ')}` : ''}</Text>}
    {query.isError && <Text style={s.faint}>Data unavailable. Open the token to retry.</Text>}
  </Pressable>;
}
function Stock({ ticker, initialCheck, saved, toggle, back, saveCheck, viewChecks }: {
  ticker: Ticker; initialCheck: SavedCheck | null; saved: boolean; toggle: () => void; back: () => void;
  saveCheck: (check: SavedCheck) => Promise<void>; viewChecks: () => void;
}) {
  const [amount, setAmount] = useState(initialCheck ? String(initialCheck.amount) : '100');
  const [band, setBand] = useState(initialCheck?.band ?? 50);
  const [review, setReview] = useState(false);
  const [savedCapture, setSavedCapture] = useState('');
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 15_000); return () => clearInterval(timer); }, []);
  const value = Number(amount);
  const valid = /^\d+(\.\d{1,2})?$/.test(amount) && Number.isFinite(value) && value >= 100 && value <= 10_000_000;
  const market = markets.find(m => m.ticker === ticker)!;
  const quote = useQuery({
    queryKey: ['guard', ticker, value, band], enabled: review && valid,
    queryFn: ({ signal }) => request(`/api/guarded-swap?ticker=${ticker}&notional=${value}&band=${band}`, guardSchema, signal),
    staleTime: 0,
  });
  const result = review && quote.data && !quote.isError && !quote.isFetching ? quoteDecision(quote.data, band, now) : null;
  const captureKey = quote.data ? `${ticker}:${value}:${band}:${quote.data.capturedAt}:${quote.data.derivation.quotedDeviationBps}` : '';
  async function save() {
    if (!quote.data || !result || result === 'stale' || result === 'unavailable' || saving) return;
    setSaving(true); setSaveError('');
    try {
      await saveCheck({ id: `${ticker}-${Date.now()}`, ticker, amount: value, band,
        deviation: quote.data.derivation.quotedDeviationBps, buildable: result === 'within',
        capturedAt: quote.data.capturedAt, checkedAt: new Date().toISOString(),
        referenceAge: referenceAgeSeconds(quote.data, Date.now()),
        referencePrice: quote.data.oracle.priceUsd, maxPrice: quote.data.derivation.maxPriceUsd,
      });
      setSavedCapture(captureKey);
    } catch { setSaveError('Could not save this check on your device. Try again.'); }
    finally { setSaving(false); }
  }
  return <>
    <Pressable accessibilityRole="button" onPress={back}><Text style={s.back}>← Watch</Text></Pressable>
    <View style={s.hero}><Label>PRICE YOUR TRADE / {ticker}</Label><Text style={s.title}>{market.name}</Text><Copy>Set a price ceiling, then see whether the quote fits inside it.</Copy></View>
    {initialCheck && <Copy>Previous settings restored. Run a new check for a current result.</Copy>}
    <Button secondary title={saved ? 'Remove from watchlist' : 'Add to watchlist'} onPress={toggle} />
    <View style={s.card}>
      <View style={s.row}><Label>01 / SET YOUR LIMIT</Label><Pill title="READ ONLY" tone="muted" /></View>
      <Text style={s.subtitle}>Your quote settings</Text>
      <Text style={s.dataLabel}>Amount to inspect · USDC</Text>
      <TextInput accessibilityLabel="Amount in USDC" style={s.input} value={amount} onChangeText={text => { setAmount(text); setReview(false); setSavedCapture(''); }} keyboardType="decimal-pad" />
      {!valid && <Copy>Enter an amount from $100 to $10,000,000, with up to two decimals.</Copy>}
      <Text style={s.dataLabel}>Maximum above equity reference</Text>
      <View style={s.row}>{[10, 25, 50, 100].map(b => <Pressable key={b} accessibilityRole="button" accessibilityState={{ selected: band === b }} onPress={() => { setBand(b); setReview(false); setSavedCapture(''); }} style={[s.bandOption, band === b && s.bandSelected]}><Text style={[s.bandText, band === b && s.selected]}>{(b / 100).toFixed(2)}%</Text></Pressable>)}</View>
      <Button title="Check this quote" disabled={!valid || quote.isFetching} onPress={() => { setNow(Date.now()); setReview(true); if (review) void quote.refetch(); }} />
    </View>
    {review && quote.isFetching && <Notice loading message="Checking the quote and reference…" />}
    {review && quote.isError && <Notice message={quote.error.message} retry={() => void quote.refetch()} />}
    {result && quote.data && <View style={[s.card, s.resultCard, result === 'within' && s.resultGreen, result === 'above' && s.resultRed]}>
      <View style={s.row}><Label>02 / THE VERDICT</Label><Pill title={result === 'within' ? 'WITHIN LIMIT' : result === 'above' ? 'ABOVE LIMIT' : result === 'stale' ? 'OLD REFERENCE' : 'NO ROUTE'} tone={result === 'within' ? 'green' : result === 'above' ? 'red' : 'gold'} /></View>
      <Text style={s.value}>{result === 'stale' ? 'Quote paused' : percent(quote.data.derivation.quotedDeviationBps)}</Text>
      <Copy>{result === 'stale' ? `The reference is over ${MAX_REFERENCE_AGE_SECS / 60} minutes old. Refresh before making a decision.` : result === 'unavailable' ? 'The comparison is inside your limit, but the service could not prepare a route. Try again later.' : result === 'within' ? 'The quoted deviation is within your chosen ceiling.' : 'The quoted deviation exceeds your chosen ceiling.'}</Copy>
      {result !== 'stale' && result !== 'within' && quote.data.derivation.refusal && <Copy>Service reason: {quote.data.derivation.refusal}</Copy>}
      <DataRow label="Pyth equity reference" value={usd(quote.data.oracle.priceUsd)} hint="Underlying share, unadjusted" />
      <DataRow label="Your price ceiling" value={usd(quote.data.derivation.maxPriceUsd)} hint={`Reference + ${(band / 100).toFixed(2)}%`} accent />
      <Text style={s.faint}>OBSERVED {new Date(quote.data.capturedAt).toLocaleString()}  /  REFERENCE {ageLabel(referenceAgeSeconds(quote.data, now)).toUpperCase()}</Text>
      {result !== 'stale' && result !== 'unavailable' && <Button secondary title={saving ? 'Saving…' : savedCapture === captureKey ? 'Saved to your checks' : 'Save this check'} disabled={saving || savedCapture === captureKey} onPress={() => { void save(); }} />}
      {saveError && <Copy>{saveError}</Copy>}
      {savedCapture === captureKey && <Button title="View saved checks" onPress={viewChecks} />}
    </View>}
    <Notice message="Indicative comparison only. Corporate-action adjustments remain under review. Purchase execution is paused; checking a quote does not sign or spend." />
    <Button secondary title="Refresh quote" disabled={!review || quote.isFetching} onPress={() => { setNow(Date.now()); void quote.refetch(); }} />
  </>;
}
function Portfolio() {
  const wallet = useMobileWallet(); const [address, setAddress] = useState(''); const [lookup, setLookup] = useState(''); const [error, setError] = useState('');
  const effective = wallet.account?.address.toString() ?? lookup;
  const query = useQuery({ queryKey: ['position', effective], enabled: !!effective, queryFn: ({ signal }) => request(`/api/position?address=${encodeURIComponent(effective)}`, positionSchema, signal) });
  return <><View style={s.hero}><Label>YOUR ON-CHAIN VIEW</Label><Text style={s.title}>Your positions.</Text><Copy>Inspect supported stock tokens in a wallet. This view never signs or spends.</Copy></View><WalletButton onError={setError} />{error && <Notice message={error} />}
    {!wallet.account && <View style={s.card}><Label>Or watch an address</Label><TextInput accessibilityLabel="Solana wallet address" autoCapitalize="none" autoCorrect={false} style={s.input} value={address} onChangeText={setAddress} placeholder="Solana address" placeholderTextColor={colors.muted} /><Button secondary title="Look up holdings" disabled={!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address.trim())} onPress={() => setLookup(address.trim())} /></View>}
    {effective && <View style={s.notice}><Label>WALLET ADDRESS</Label><Copy>{effective}</Copy></View>}{effective && query.isPending && <Notice loading message="Reading holdings…" />}{query.isError && <Notice message={query.error.message} retry={() => void query.refetch()} />}
    {query.data && <>{!query.data.holdings.length && <Notice message="No supported stock tokens found." />}{query.data.holdings.map(h => <View key={h.ticker} style={s.card}><View style={s.row}><Label>{h.ticker}</Label><Pill title="ON-CHAIN" tone="green" /></View><Text style={s.subtitle}>{h.label}</Text><Text style={s.value}>{h.qty.toLocaleString('en-US', { maximumFractionDigits: 6 })}</Text><Copy>Token quantity · valuation awaits price-unit reconciliation.</Copy></View>)}<Button secondary title="Refresh holdings" onPress={() => void query.refetch()} /></>}
  </>;
}
function WalletButton({ onError }: { onError: (message: string) => void }) {
  const wallet = useMobileWallet(); const [busy, setBusy] = useState(false);
  async function connect() { setBusy(true); onError(''); try { if (wallet.account) await wallet.disconnect(); else await wallet.connect(); } catch (error) { onError(error instanceof Error ? error.message : 'Wallet connection could not be completed.'); } finally { setBusy(false); } }
  return <Button title={busy ? 'Opening wallet…' : wallet.account ? 'Disconnect wallet' : 'Connect wallet'} disabled={busy} onPress={() => void connect()} />;
}
function Settings() {
  const [error, setError] = useState('');
  return <><View style={s.hero}><Label>THE DETAILS MATTER</Label><Text style={s.title}>Settings.</Text><Copy>Wallet access, data sources, and how Closing Bell handles your quote.</Copy></View><View style={s.card}><Label>01 / WALLET</Label><Text style={s.subtitle}>Stay in control</Text><Copy>Connect through an installed wallet. Closing Bell never requests your recovery phrase.</Copy><WalletButton onError={setError} />{error && <Notice message={error} />}</View><View style={s.card}><Label>02 / PRICE SOURCES</Label><DataRow label="Equity reference" value="Pyth" /><DataRow label="Pool route" value="Jupiter" /><Text style={s.faint}>API  {API_URL}</Text><Copy>Comparisons are indicative. A price difference is not a promise of savings.</Copy></View><Button secondary title="Read the methodology" onPress={() => { void Linking.openURL(`${API_URL}/findings`).catch(() => setError('Could not open the browser.')); }} /><Text style={s.faint}>CLOSING BELL  /  0.1.0</Text></>;
}
