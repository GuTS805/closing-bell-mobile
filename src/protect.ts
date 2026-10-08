// Turns "no more than X% over the issuer price" into swap settings that Jupiter's router
// enforces on-chain. Every Jupiter swap reverts when it receives fewer tokens than its
// minimum; set that minimum from the user's ceiling and the router enforces the limit.

export type Protection =
  /** A slippage setting exists that keeps every accepted fill at or under the ceiling. */
  | { kind: 'protect'; ceiling: number; minTokens: number; maxSlippageBps: number }
  /** The quote sits within 0.01% of the ceiling, so no settable slippage is safe. */
  | { kind: 'tight'; ceiling: number; minTokens: number }
  /** The quote already costs more than the ceiling; no setting can make it pass. */
  | { kind: 'above'; ceiling: number; minTokens: number; overBps: number };

/** Jupiter's swap settings accept slippage in 0.01% steps. */
const SLIPPAGE_STEP_BPS = 1;

/**
 * Both roundings favour the user: the minimum is rounded up to the displayed precision and
 * the slippage is rounded down, so neither can let a fill through above the ceiling.
 */
export function protectSwap(amountUsd: number, quotedTokens: number, issuerPrice: number, bandBps: number, displayDecimals = 6): Protection {
  if (!(amountUsd > 0) || !(quotedTokens > 0) || !(issuerPrice > 0) || !(bandBps >= 0)) throw new Error('Protection needs positive prices and amounts.');
  const ceiling = issuerPrice * (1 + bandBps / 10_000);
  const scale = 10 ** displayDecimals;
  const minTokens = Math.ceil((amountUsd / ceiling) * scale) / scale;
  if (quotedTokens < minTokens) return { kind: 'above', ceiling, minTokens, overBps: (amountUsd / quotedTokens / ceiling - 1) * 10_000 };
  const maxSlippageBps = Math.floor((1 - minTokens / quotedTokens) * 10_000);
  if (maxSlippageBps < SLIPPAGE_STEP_BPS) return { kind: 'tight', ceiling, minTokens };
  return { kind: 'protect', ceiling, minTokens, maxSlippageBps };
}

/** Opens Jupiter's swap with USDC in and the xStock out; the query form keeps both tokens. */
export const jupiterSwapUrl = (inputMint: string, outputMint: string) => `https://jup.ag/?sell=${inputMint}&buy=${outputMint}`;
