# Closing Bell Mobile

Android app for inspecting stock-token execution prices on Solana. React Native and Expo, using the existing Closing Bell backend.

## Development

Install Node.js, Java, Android SDK, and an MWA-compatible wallet on a device/emulator.

```sh
npm install
cp .env.example .env.local
npm run android
```

Use a native development build. Expo Go does not contain the wallet and crypto modules. `npm start` starts Metro for an installed development build.

## Features

Live quotes for four tokens, persisted watchlist, editable amount/limit checks, native wallet connection, and read-only portfolio lookup. Screens include loading, error, empty, and refresh states.

Purchase execution is paused pending backend entitlement and reference-quality verification. Portfolio valuation is withheld pending price-unit reconciliation. Activity has an empty state. Background alerts and transaction execution are not implemented.

## Configuration and builds

`EXPO_PUBLIC_API_URL` and `EXPO_PUBLIC_RPC_URL` are bundled public endpoints. Never use server credentials or private keys in them.

The wallet identity domain must publish Digital Asset Links for `com.closingbell.mobile` and its signing certificate before production wallet verification.

```sh
npm run typecheck
npm run export:android
```

EAS profiles produce APKs. Remote repository creation, publishing accounts, and release signing credentials are separate setup steps.

For a standalone local APK on Windows, run `npm run build:apk`. The script generates Android files, compiles bundled release-mode JavaScript, and copies the APK to `artifacts/closing-bell-0.1.0.apk`. This local build uses the generated debug signing key and is for device testing. Configure a private release key before store publication.

The Windows build script uses a temporary drive mapping for long workspace paths and removes its mapping when finished. It uses Windows trusted certificates for dependency downloads.

## Verified build

Version 0.1.0 compiled successfully on October 5, 2026. APK signature verification passed. Package: `com.closingbell.mobile`; Android 7.0 or newer; ARM64, ARMv7, x86, and x86_64. TypeScript validation and release JavaScript bundling passed. No device or emulator was connected for a launch test.

APK SHA-256: `a0dacc36793456658610b1fe7c66f36028827088d0342787955cc39b676695dd`.
