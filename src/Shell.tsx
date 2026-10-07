import React, { useEffect, useState } from 'react';
import { BackHandler, Image, Linking, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMobileWallet } from '@wallet-ui/react-native-web3js';
import { API_URL, costSchema, guardSchema, markets, percent, positionSchema, request, Ticker, usd } from './api';
import { ageLabel, ageSinceCaptureSeconds, MAX_REFERENCE_AGE_SECS, quoteDecision, referenceAgeSeconds, SavedCheck, savedCheckSchema, savedOutcome } from './decision';
import { Button, colors, Copy, DataRow, Label, Notice, Pill, s } from './ui';

type Tab = 'Watch' | 'Portfolio' | 'Checks' | 'Proof';
const tabs: Tab[] = ['Watch', 'Portfolio', 'Checks', 'Proof'];
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
  return <SafeAreaView style={s.root}><ScrollView key={stock ? `stock:${stock}:${repeatCheck?.id ?? 'new'}` : `tab:${tab}`} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
    <View style={s.header}><Image source={require('../assets/icon.png')} style={s.logo} resizeMode="contain" /><View style={s.flex}><Text style={s.brand}>Closing <Text style={s.brandGold}>Bell.</Text></Text><Text style={s.faint}>TOKENIZED STOCKS. FULL TRANSPARENCY.</Text></View><Pill title={!stock && tab === 'Proof' ? 'DEVNET' : 'MAINNET'} /></View>
    {stock ? <Stock key={`${stock}:${repeatCheck?.id ?? 'new'}`} ticker={stock} initialCheck={repeatCheck} saved={saved.includes(stock)} toggle={() => toggle(stock)} back={() => setStock(null)} saveCheck={saveCheck} viewChecks={() => { setStock(null); setTab('Checks'); }} /> : <>
      {tab === 'Watch' && <><View style={s.compactHero}><Label>MAINNET PRICE CHECK</Label><Text style={s.sectionHeading}>Know what the token costs.</Text><Copy>Compare its quote with the share beneath it. Old references pause the verdict.</Copy></View><View style={s.row}><View><Label>YOUR MARKET DESK</Label><Text style={s.sectionHeading}>Markets</Text></View><Text style={s.faint}>04 ASSETS</Text></View>
        {[...markets].sort((a, b) => Number(saved.includes(b.ticker)) - Number(saved.includes(a.ticker))).map(m => <MarketRow key={m.ticker} ticker={m.ticker} saved={saved.includes(m.ticker)} lastCheck={checks.find(check => check.ticker === m.ticker)} open={() => { setRepeatCheck(null); setStock(m.ticker); }} />)}<Button secondary title="Refresh markets" onPress={() => { void client.invalidateQueries({ queryKey: ['cost'] }); }} />{!ready && <Copy>Restoring watchlist…</Copy>}</>}
      {tab === 'Portfolio' && <Portfolio />}
      {tab === 'Checks' && <>
        <View style={s.hero}><Label>YOUR HISTORY</Label><Text style={s.title}>Saved checks.</Text><Copy>Past observations on this device. Run a new check before making a decision.</Copy></View>
        {storageError && <Notice message={storageError} />}
        {checksReady && checks.length === 0 && <Notice message="No checks saved yet. Choose a token, check a quote, and save the result here." />}
        {checks.map(check => <View key={check.id} style={s.card}>
          <View style={s.row}><View><Label>{check.ticker} / QUOTE CHECK</Label><Text style={s.subtitle}>{usd(check.amount)}</Text></View><Pill title={savedOutcome(check) === 'within' ? 'WITHIN LIMIT' : savedOutcome(check) === 'above' ? 'ABOVE LIMIT' : savedOutcome(check) === 'stale' ? 'OLD REFERENCE' : 'NO ROUTE'} tone={savedOutcome(check) === 'within' ? 'green' : savedOutcome(check) === 'above' ? 'red' : 'gold'} /></View>
          <DataRow label="Against reference" value={savedOutcome(check) === 'stale' ? 'Unavailable' : percent(check.deviation)} hint={`Your limit ${(check.band / 100).toFixed(2)}%`} />
          {check.referencePrice && <DataRow label="Reference" value={usd(check.referencePrice)} />}
          {check.maxPrice && <DataRow label="Your ceiling" value={usd(check.maxPrice)} accent />}
          <Text style={s.faint}>{new Date(check.checkedAt).toLocaleString().toUpperCase()}  /  REFERENCE WAS {ageLabel(check.referenceAge).toUpperCase()} AT CAPTURE</Text>
          <Button title={`Check ${check.ticker} again`} onPress={() => { setRepeatCheck(check); setStock(check.ticker); }} />
          <Button secondary title="Remove saved check" onPress={() => { void deleteCheck(check.id); }} />
        </View>)}
      </>}
      {tab === 'Proof' && <Proof />}
    </>}
  </ScrollView><View style={s.tabs}>{tabs.map(t => <Pressable key={t} accessibilityRole="tab" accessibilityState={{ selected: t === tab && !stock }} style={[s.tab, t === tab && !stock && s.activeTab]} onPress={() => { setStock(null); setTab(t); }}><Text style={[s.tabText, t === tab && !stock && s.selected]}>{t}</Text></Pressable>)}</View></SafeAreaView>;
}
function MarketRow({ ticker, saved, lastCheck, open }: { ticker: Ticker; saved: boolean; lastCheck?: SavedCheck; open: () => void }) {
  const market = markets.find(m => m.ticker === ticker)!;
  const query = useQuery({ queryKey: ['cost', ticker, 1000], queryFn: ({ signal }) => request(`/api/truecost?ticker=${ticker}&notional=1000`, costSchema, signal) });
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(timer); }, []);
  const fresh = !!query.data && ageSinceCaptureSeconds(query.data.capturedAt, query.data.oracle.ageSecs, now) <= MAX_REFERENCE_AGE_SECS;
  const status = query.isError ? 'UNAVAILABLE' : !query.data ? 'CHECKING' : fresh ? 'FRESH SNAPSHOT' : 'OLD REFERENCE';
  return <Pressable accessibilityRole="button" accessibilityLabel={`Open ${market.name}`} onPress={open} style={({ pressed }) => [s.card, pressed && { borderColor: colors.gold }]}>
    <View style={s.row}><View style={s.badge}><Text style={[s.badgeText, { color: market.color }]}>{market.mark}</Text></View><View style={s.flex}><Text style={s.subtitle}>{ticker}</Text><Text style={s.faint}>{market.name}{saved ? ' · WATCHING' : ''}</Text></View><Text style={s.back}>↗</Text></View>
    <View style={s.row}><View style={s.flex}><Text style={s.dataHint}>TOKEN QUOTE / $1,000</Text><Text style={s.marketPrice}>{query.data && !query.isError ? usd(query.data.pool.fillPrice) : query.isPending ? 'Reading…' : '—'}</Text></View><Pill title={status} tone={fresh && !query.isError ? 'green' : query.isError ? 'red' : 'gold'} /></View>
    <DataRow label="Underlying share" value={query.data && !query.isError ? usd(query.data.oracle.price) : '—'} hint={query.data ? `Pyth reference · ${ageLabel(ageSinceCaptureSeconds(query.data.capturedAt, query.data.oracle.ageSecs, now))}` : 'Pyth reference'} />
    <DataRow label="Difference" value={fresh && !query.isError ? percent(query.data!.breakdown.trueCostBps) : 'Unavailable'} hint={fresh ? 'Token quote versus share' : 'Requires a fresh equity reference'} accent={fresh} />
    {lastCheck && <Text style={s.faint}>LAST CHECK {new Date(lastCheck.checkedAt).toLocaleDateString()} · {savedOutcome(lastCheck) === 'stale' ? 'OLD REFERENCE' : savedOutcome(lastCheck) === 'within' ? 'WITHIN LIMIT' : savedOutcome(lastCheck) === 'above' ? 'ABOVE LIMIT' : 'NO ROUTE'}</Text>}
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
  const previousComparable = initialCheck && initialCheck.amount === value && initialCheck.band === band && ['within', 'above'].includes(savedOutcome(initialCheck));
  const captureKey = quote.data ? `${ticker}:${value}:${band}:${quote.data.capturedAt}:${quote.data.derivation.quotedDeviationBps}` : '';
  async function save() {
    if (!quote.data || !result || saving) return;
    setSaving(true); setSaveError('');
    try {
      await saveCheck({ id: `${ticker}-${Date.now()}`, ticker, amount: value, band,
        deviation: quote.data.derivation.quotedDeviationBps, buildable: result === 'within', outcome: result,
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
      {initialCheck && <View style={s.notice}><Label>SINCE YOUR SAVED CHECK</Label><Copy>{previousComparable && (result === 'within' || result === 'above')
        ? `Previous ${percent(initialCheck.deviation)} · now ${percent(quote.data.derivation.quotedDeviationBps)} · ${Math.abs(quote.data.derivation.quotedDeviationBps - initialCheck.deviation).toFixed(0)} bp ${quote.data.derivation.quotedDeviationBps >= initialCheck.deviation ? 'higher' : 'lower'}.`
        : result === 'stale' ? 'The equity reference is still too old to compare this result with your saved check.'
        : 'A like-for-like change needs two fresh checks with the same amount and limit.'}</Copy></View>}
      {result !== 'stale' && result !== 'within' && quote.data.derivation.refusal && <Copy>Service reason: {quote.data.derivation.refusal}</Copy>}
      <DataRow label="Pyth equity reference" value={usd(quote.data.oracle.priceUsd)} hint="Underlying share, unadjusted" />
      <DataRow label="Your price ceiling" value={usd(quote.data.derivation.maxPriceUsd)} hint={`Reference + ${(band / 100).toFixed(2)}%`} accent />
      <Text style={s.faint}>OBSERVED {new Date(quote.data.capturedAt).toLocaleString()}  /  REFERENCE {ageLabel(referenceAgeSeconds(quote.data, now)).toUpperCase()}</Text>
      <Button secondary title={saving ? 'Saving…' : savedCapture === captureKey ? 'Saved to your checks' : result === 'stale' ? 'Save this refused check' : 'Save this check'} disabled={saving || savedCapture === captureKey} onPress={() => { void save(); }} />
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
  async function connect() { setBusy(true); onError(''); try { if (wallet.account) await wallet.disconnect(); else await wallet.connect(); } catch (error) {
    const message = error instanceof Error ? error.message : '';
    onError(/no installed wallet|no wallet found/i.test(message)
      ? 'No compatible wallet is installed. Install a Solana wallet with Mobile Wallet Adapter, or look up an address below.'
      : message || 'Wallet connection could not be completed.');
  } finally { setBusy(false); } }
  return <Button title={busy ? 'Opening wallet…' : wallet.account ? 'Disconnect wallet' : 'Connect wallet'} disabled={busy} onPress={() => void connect()} />;
}
function Proof() {
  const [error, setError] = useState('');
  const open = (url: string) => { setError(''); void Linking.openURL(url).catch(() => setError('No browser is available to open this link.')); };
  return <><View style={s.hero}><Label>VERIFIABLE ON-CHAIN / DEVNET</Label><Text style={s.title}>The guard refuses.</Text><Copy>A fill above the chosen price ceiling is rejected by a Solana program at settlement.</Copy></View>
    <View style={s.card}><View style={s.row}><Label>RECORDED TRANSACTIONS</Label><Pill title="DEVNET" /></View><Text style={s.subtitle}>See both outcomes.</Text><DataRow label="At the reference" value="Allowed" /><DataRow label="6.8% above reference" value="Rejected" /><Copy>These proof transactions use a SOL/USD reference on devnet. They do not demonstrate a live equity feed or a mainnet stock purchase.</Copy><Button title="View rejected transaction" onPress={() => open('https://solscan.io/tx/2VKxFk8Lnim9pe59pev9NNhyYk3TrRQ7ZyrF5amiCqKR5yUbZ2woLS5KcGXmMrwjqrQxBN44oeGyLAA6e4T9wjS6?cluster=devnet')} /><Button secondary title="View allowed transaction" onPress={() => open('https://solscan.io/tx/5KK2pPnAks22g3tPJHYdAhtuhJbwFbk7FKWFVwLiJmGi8VxWwJWSy8fjw23MFWQ3WGp3q3tiA2sQqzyDBndobYy9?cluster=devnet')} /></View>
    <View style={s.card}><Label>RUN IT YOURSELF</Label><Text style={s.subtitle}>Live devnet demonstration</Text><Copy>The web proof sends a new devnet transaction and shows whether the program accepts or rejects it.</Copy><Button secondary title="Open live proof (devnet)" onPress={() => open(`${API_URL}/proof`)} /></View>
    <View style={s.card}><Label>NETWORKS AND SOURCES</Label><DataRow label="Mobile market checks" value="Mainnet" /><DataRow label="Guard proof" value="Devnet" /><DataRow label="Equity reference" value="Pyth" /><DataRow label="Token route" value="Jupiter" /><Copy>Mainnet purchase execution is paused. No check in this app signs or spends.</Copy></View>
    {error && <Notice message={error} />}
    <Button secondary title="Read the methodology" onPress={() => open(`${API_URL}/findings`)} /><Text style={s.faint}>CLOSING BELL  /  0.1.0</Text></>;
}
