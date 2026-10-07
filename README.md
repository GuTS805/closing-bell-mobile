# Closing Bell Mobile

Standalone Android app for checking xStock token route prices, issuer indicative prices, reserve records, and token holdings on Solana. It does not call the Closing Bell web backend or require a Pyth API key.

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

For a local Windows APK, run `npm run build:apk`. The generated debug key signs this testing build; configure a private release key before store publication. The app bundle makes direct HTTPS requests to Jupiter and xStocks, and neither service requires a key for the endpoints used here. Their availability and usage terms can change.

Wallet identity points to this source repository. A dedicated verified domain with Digital Asset Links is needed for production wallet verification.

## Verification

TypeScript validation and the Android APK build passed on October 7, 2026. The APK was installed on an Android 16 AOSP emulator at 320 × 640. Market comparison, save and restart persistence, recheck restoration, backing record, and wallet connection, holdings lookup, and disconnect were verified using Solana Mobile's fake wallet. No app crash appeared in the AndroidRuntime or ReactNativeJS error log.

The test APK is `artifacts/closing-bell-0.1.0.apk` (SHA-256 `9B62D936D1B66060A0CD7374C814193D581C811186E7B8CF621FB6DF691E477B`). The APK is ignored by Git; build locally from this source. See [emulator QA](docs/emulator-qa.md) for the test record and historical runs.
