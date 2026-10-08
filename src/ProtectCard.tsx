import React, { useState } from 'react';
import { Linking, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Comparison, marketFor, USDC, usd } from './api';
import { jupiterSwapUrl, protectSwap } from './protect';
import { Button, Copy, DataRow, Label, Pill, s } from './ui';
import { AlertButton } from './WatchViews';

const tokens = (value: number) => value.toLocaleString('en-US', { maximumFractionDigits: 6 });

/** The step after a check: what to do, and the Jupiter settings that enforce the limit on-chain. */
export function ProtectCard({ result, band }: { result: Comparison; band: number }) {
  const market = marketFor(result.ticker);
  const protection = protectSwap(result.amount, result.tokensOut, result.issuerIndicativePrice, band);
  const [note, setNote] = useState('');
  const limit = `${(band / 100).toFixed(2)}%`;

  async function copyMinimum() {
    try { await Clipboard.setStringAsync(protection.minTokens.toFixed(6)); setNote(`Copied ${protection.minTokens.toFixed(6)} ${result.ticker}.`); }
    catch { setNote('Could not copy. Note the minimum shown above.'); }
  }
  function openJupiter() {
    setNote('');
    void Linking.openURL(jupiterSwapUrl(USDC, market.mint)).catch(() => setNote('No browser is available to open Jupiter.'));
  }

  if (protection.kind === 'above') {
    return <View style={[s.card, s.resultRed]}>
      <View style={s.row}><Label>03 / WHAT TO DO</Label><Pill title="DON'T SWAP YET" tone="red" /></View>
      <Text style={s.subtitle}>This route is {(protection.overBps / 100).toFixed(2)}% past your limit.</Text>
      <Copy>No swap setting can keep this price under {usd(protection.ceiling)}. Wait and check again, try a smaller amount, or accept a wider limit than {limit}.</Copy>
      <AlertButton ticker={result.ticker} amount={result.amount} band={band} />
    </View>;
  }
  if (protection.kind === 'tight') {
    return <View style={s.card}>
      <View style={s.row}><Label>03 / WHAT TO DO</Label><Pill title="AT YOUR LIMIT" tone="gold" /></View>
      <Text style={s.subtitle}>The route sits right at your limit.</Text>
      <Copy>Any price move before the swap lands would cross {usd(protection.ceiling)}. Wait for a better route or widen your limit beyond {limit}.</Copy>
      <AlertButton ticker={result.ticker} amount={result.amount} band={band} />
    </View>;
  }
  return <View style={[s.card, s.resultGreen]}>
    <View style={s.row}><Label>03 / PROTECT THIS SWAP</Label><Pill title="ENFORCED ON-CHAIN" tone="green" /></View>
    <Text style={s.subtitle}>Swap in Jupiter with these two settings.</Text>
    <DataRow label="Max slippage" value={`${(protection.maxSlippageBps / 100).toFixed(2)}%`} hint="Swap settings → manual slippage" accent />
    <DataRow label="Minimum received" value={`${tokens(protection.minTokens)} ${result.ticker}`} hint={`For ${usd(result.amount)}. Check Jupiter shows at least this.`} accent />
    <Copy>{`If the price runs past ${usd(protection.ceiling)} per token before your swap lands, Jupiter's on-chain check cancels it and your USDC stays in your wallet. Closing Bell never signs or moves funds.`}</Copy>
    <Button title={`Open ${result.ticker} swap in Jupiter`} onPress={openJupiter} />
    <Button secondary title="Copy minimum received" onPress={() => { void copyMinimum(); }} />
    {note !== '' && <Text style={s.faint}>{note}</Text>}
  </View>;
}
