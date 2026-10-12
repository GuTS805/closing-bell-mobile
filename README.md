# Closing Bell Mobile

Android app that checks what a Jupiter swap into an xStock (SPYx, AAPLx, NVDAx, TSLAx) really costs against xStocks' own price for the token, then turns your limit into Jupiter settings that the chain enforces. It runs entirely on the phone: it calls Jupiter, xStocks and Solana RPC directly, needs no backend and no API key, and never signs or moves funds.

## What it does

- **Check:** for your amount, Jupiter's live route price next to xStocks' indicative token price, and how far over it you would pay.
- **Protect this swap:** when the route is within your limit, the max slippage and minimum received that make Jupiter's on-chain minimum-output check cancel any fill above your limit price, with a hand-off to Jupiter's swap for the pair. Both values are rounded in the user's favour; `npm test` checks the invariant over 5,000 random cases.
- **Alerts:** when the route is over your limit, a background check about every 15 minutes notifies you once it moves within.
- **History:** the same background check builds a 7-day chart per token on the phone.
- **Home-screen widget:** the latest route cost over xStocks' price for each token, green within your limit.
- **Share:** a check as an image.
- **Backing:** xStocks' dated reserve record per token and a Solscan link to the mint.
- **Wallet:** read-only xStock balances by Mobile Wallet Adapter connect or pasted address.

## What the app compares

For a chosen USDC amount, the app requests a read-only Jupiter route to an xStock and calculates USD per token from the quoted output. It separately requests xStocks' public indicative **token** price. The difference and user-selected limit are informational. The issuer endpoint does not include a price publication timestamp, so the app labels its age unknown. It never presents the indicative price as the underlying share price or signs a trade.

The Backing tab displays xStocks' timestamped issuer proof-of-reserves record and links to the Solana mainnet token mint. The issuer record reports custody; the mint link verifies the token on-chain, not custody. Wallet holdings are read directly from Solana RPC. Prior Pyth-based mobile checks remain in the device's `quote-checks-v1` storage key and are not mixed with the new `issuer-checks-v2` history.

## Development

Install Node.js, Java, Android SDK, and an MWA-compatible wallet on the device or emulator.

```sh
npm install
cp .env.example .env.local
npm run typecheck
npm run android
```

Use a native development build. Expo Go does not contain the wallet and crypto modules. `EXPO_PUBLIC_RPC_URL` is a public Solana mainnet RPC endpoint; never put a secret in an `EXPO_PUBLIC_` variable.

For a local Windows test APK, run `npm run build:apk`. That testing build uses a debug key. To build the distributable APK with this project's release certificate, run `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-apk.ps1 -Release`. The release keystore is stored locally in `.build-cache/release-signing/closing-bell-release.jks`; its password is encrypted for this Windows account in `password.dpapi`. Neither file is committed. Back up the keystore and record its password in your password manager using `scripts/show-release-password.ps1` in a private terminal. Losing the keystore prevents updates under the same app identity. Keep the project, Android SDK and JDK outside OneDrive: OneDrive turns hard-linked native build files into cloud placeholders that Gradle cannot read. Set `CLOSING_BELL_SIGNING_DIR` when the keystore is not in `.build-cache/release-signing`.

The app bundle makes direct HTTPS requests to Jupiter and xStocks, and neither service requires a key for the endpoints used here. Their availability and usage terms can change.

Wallet identity uses `https://guts805.github.io`, a GitHub Pages site published from a separate repository, solely for Android Digital Asset Links verification. It serves `/.well-known/assetlinks.json` with the release certificate fingerprint. Market data and wallet holdings do not call it.

## Verification

TypeScript validation and the Android APK build passed on October 7, 2026. The APK was installed on an Android 16 AOSP emulator at 320 × 640. Market comparison, save and restart persistence, recheck restoration, backing record, and wallet connection, holdings lookup, and disconnect were verified using Solana Mobile's fake wallet. The release APK showed `Verification successful` in that wallet. No app crash appeared in the AndroidRuntime or ReactNativeJS error log.

On October 8, 2026, the network-failure and small-screen fixes were tested at 320 × 640 dp with a 1.3 system font scale and in airplane mode: prices and limit buttons no longer wrap, and network errors name the failed source with a retry. v0.1.2 was then tested on a physical Android 13 arm64 phone with Solflare 2.29.1: market check, save, restart and update persistence, recheck, backing, and wallet connect, holdings lookup and disconnect. That test found the keyboard covering the amount and address fields under edge-to-edge display; v0.1.2 fixes it. No transaction was signed.

On October 12, 2026, v0.2.1 was tested on the same phone and on an emulator while the US market was closed. xStocks pauses its price on weekends; the app keeps showing Jupiter's live price and compares it with the last xStocks price the phone read, labelled with its time.

The current release APK is v0.2.1, available locally as `artifacts/closing-bell-0.2.1-release.apk` (SHA-256 `1A3915A9BB1BBB8EEF73925D36B44A2B1E5E3ED28207971AE2C8FA687683F137`). It uses the same signing certificate as [v0.1.0](https://github.com/GuTS805/closing-bell-mobile/releases/tag/v0.1.0) and installs over earlier versions as an update. APKs are ignored by Git. See [emulator QA](docs/emulator-qa.md) for the test record and historical runs.
