# Closing Bell — CLOCK IN submission

**Check what a Jupiter swap into a tokenized stock really costs, then let the chain enforce your limit.**

xStocks such as SPYx trade in Solana pools, and the price Jupiter fills you at can sit above xStocks' own price for the same token. The swap screen doesn't show that gap, and the slippage setting that would protect you is a guess. Closing Bell is an Android app that measures the gap for your exact amount, turns your limit into the two Jupiter settings that make the swap cancel itself on-chain if the price runs past it, and keeps watching from the home screen while the app is closed.

It runs entirely on the phone: direct calls to Jupiter, xStocks and Solana RPC, no backend, no API key, and it never signs or moves funds.

## Try it in two minutes

1. Install the APK (Android 7.0+) from the [v0.2.2 release](https://github.com/GuTS805/closing-bell-mobile/releases/tag/v0.2.2). A three-screen intro explains the idea.
2. **Markets:** Jupiter's price for $1,000 of SPYx, AAPLx, NVDAx and TSLAx next to xStocks' price, and how far over it you'd pay.
3. Open **SPYx**, enter an amount, pick a limit and tap **Check Jupiter's price**.
4. **Within your limit:** the app shows the max slippage and minimum received to set, and opens Jupiter's swap with USDC → SPYx filled in. If the price moves past your limit price before the swap lands, Jupiter's minimum-output check reverts it.
5. **Over your limit:** tap **Alert me** and get a notification when the route comes back within your limit.
6. Tap **Add route-cost widget** for a home-screen view of all four tokens, green within your limit.
7. **Share this check** sends the result as an image. **Backing** shows xStocks' dated reserve record and the mint on Solscan. **Wallet** reads balances via Mobile Wallet Adapter, read-only.

Example from October 8, 2026: $1,000 of SPYx routed at $779.48 per token against xStocks' $774.60, **+0.63%**, over a 0.50% limit.

## Why it is a mobile app

- **Home-screen widget** and **background checks** about every 15 minutes: the cost of a swap is visible without opening anything.
- **Alerts** at the moment a swap becomes reasonable, which a web page cannot do while closed.
- **Mobile Wallet Adapter** for read-only holdings, with the app's identity verified by Digital Asset Links.
- **Hand-off to Jupiter** with the protective settings ready to paste.
- **History** built on the phone from its own samples, a 7-day record of the route cost per token.

## How the protection works

Every Jupiter swap carries an on-chain minimum output and reverts below it. Normally that minimum comes from slippage measured against the pool's own price. Closing Bell derives it from your limit over xStocks' price instead:

- limit price = xStocks' price × (1 + your limit)
- minimum received = amount ÷ limit price, rounded up
- max slippage = 1 − minimum ÷ quoted tokens, rounded down

Both roundings favour the user. `npm test` checks that no accepted fill can price above the limit, across 5,000 random cases, plus the alert transition logic.

## What has been verified

- **Physical Android 13 phone (arm64) with Solflare 2.29.1:** check, save, restart and update persistence, recheck, backing, wallet connect, read-only holdings and disconnect; keyboard handling; protect card, copy and Jupiter hand-off; alert permission and background-job registration; widget placement. No signature was requested.
- **Android 16 emulator:** widget rendering and a forced background run that updated the widget headlessly; history chart; share sheet with the rendered card; offline errors naming the failed source with a working retry; 320 × 640 dp at 1.3 font scale.
- Signed release builds with the same certificate since v0.1.0, so each installs as an update.

Details: [QA record](emulator-qa.md).

## Limits, stated plainly

- **Two token prices, not the share price.** The reference is xStocks' indicative price for the token, not a live SPY/AAPL/NVDA/TSLA quote, and xStocks doesn't timestamp it.
- **Protection relies on Jupiter's minimum-output check.** The user still sets it in Jupiter; Closing Bell doesn't build or sign the swap.
- **Background checks run on Android's schedule**, about every 15 minutes at best; a notification is not a guarantee the price is still there.
- **The reserve record is xStocks' own report.** The Solscan link verifies the mint, not custody.

## Links

- Source: https://github.com/GuTS805/closing-bell-mobile
- Release APK: https://github.com/GuTS805/closing-bell-mobile/releases
