# Android emulator QA

## October 7 independent app build

Installed the rebuilt APK on an Android 16 AOSP emulator at 320 × 640. The home screen showed the SPYx Jupiter route token price, the xStocks issuer indicative **token** price, their difference, and `AGE UNKNOWN` because the issuer price endpoint gives no publication timestamp. The app identified the network as mainnet.

Checked a $100 SPYx route with a 0.50% limit. The result showed the route price, issuer price, ceiling, difference, and `ABOVE LIMIT`, while explaining that the comparison is indicative and does not execute a trade. Saved the check, force-stopped and relaunched the app, then found it in Checks. `Check SPYx again` restored the prior amount and limit and offered a fresh check.

The Backing tab displayed SPYx shares held, token supply, and a dated issuer record whose age was eight minutes at inspection. The Wallet tab showed Connect wallet and a read-only address lookup. After installing Solana Mobile's official fake wallet, authorization handed off correctly, returned a wallet address to the app, showed `No supported xStocks found at this address`, and disconnected correctly. This test exposed an invalid Token-2022 program ID in the holdings RPC call; it was corrected and the fixed APK was installed for the successful retest. No `AndroidRuntime` or `ReactNativeJS` error appeared in the final log check. The AOSP image returned black screenshots, so UI hierarchy and logs were used for this pass. A real wallet and real signed transaction were not tested; this app does not offer a transaction action.

The first independent APK signature verified with `apksigner`. The rebuilt APK after the holdings fix has SHA-256 `9B62D936D1B66060A0CD7374C814193D581C811186E7B8CF621FB6DF691E477B`. This section supersedes the older Pyth-based flow below.

## October 7 release identity check

Generated a persistent release signing key. Its APK certificate SHA-256 fingerprint is `5E:87:B6:61:FC:97:F1:71:96:55:C1:7A:BE:25:F7:88:27:76:E9:AD:EC:2B:FF:85:17:CD:4B:6C:46:A8:B4:AB`. The live `https://closing-bell-eight.vercel.app/.well-known/assetlinks.json` associates that fingerprint with `com.closingbell.mobile` and returns HTTP 200 with the exact `application/json` content type. The endpoint is edge cached; a repeat request returned `X-Vercel-Cache: HIT`.

Installed the release-signed APK on the Android 16 AOSP emulator. Solana Mobile's fake wallet showed `Verification successful` for the domain. Authorized the app, confirmed the address and empty xStocks state, then disconnected. The final APK SHA-256 is `07C42596A51603D01BF275E86C5104FAF7A3A15CC81438A4C59EB3A2A147457D`; `apksigner` confirmed the expected certificate. No app crash appeared in the AndroidRuntime or ReactNativeJS error log. A physical-device test with a production wallet and a funded account is still pending; no transaction flow exists in this app.

## October 6, 2026 — previous build

Test device: Android 16 (API 36), Google APIs x86_64 emulator. The release APK was installed and tested at 1080 × 2400 and 320 × 640. Local screenshots are in `artifacts/qa/` (ignored by Git).

| Area | Result |
| --- | --- |
| Launch and stability | App launched from the installed APK. No `AndroidRuntime` or `ReactNativeJS` errors appeared in the final log check. |
| First screen | SPYx token quote, underlying share price, and the old-reference status appeared in the first viewport at both tested sizes. The comparison and further tokens remained available by scrolling. No clipped controls were observed. |
| Quote flow | Opened SPYx, checked $100 at a 0.50% limit, then edited to $250 at 0.25%. The result refused a verdict because the equity reference was about seven days old. The $250 check displayed a $769.83 ceiling against a $767.91 reference. |
| Save and revisit | Saved the refused check, force-stopped and relaunched the app, opened Checks, and selected “Check SPYx again.” The amount and limit were restored and the quote was requested again. A navigation scroll-position issue found during this test was fixed. |
| Proof | The Proof tab labels its recorded transactions and live demonstration as devnet. The rejected transaction link opened Chrome with the Solscan transaction URL and `cluster=devnet`. The screen explains that mobile market checks use mainnet data while the guard proof uses a devnet SOL/USD reference. |
| Wallet | With no compatible wallet installed, Connect wallet showed an actionable error and the read-only address lookup remained available. A successful Mobile Wallet Adapter connection was not tested. |
| Performance | No prolonged blank or frozen screen was observed during manual navigation. Quote requests completed without an app hang; no benchmark or network latency guarantee was established. |

The current public equity reference is stale, so a fresh-reference within-limit or above-limit verdict could not be validated end to end on this run. The app deliberately blocks that decision until the reference refreshes. The on-chain proof links were checked for routing and network label; the transaction contents were not independently audited in this emulator run.

## October 7 follow-up

Rebuilt the APK with saved-check context. On the Android 16 AOSP test emulator at 320 × 640, the Watch card showed the last saved SPYx check as `OLD REFERENCE`. Opening that saved check restored $250 and a 0.25% limit. Rechecking showed `SINCE YOUR SAVED CHECK` and explained that the equity reference was still too old for a comparison. No app crash appeared in the AndroidRuntime or ReactNativeJS error log.

The Google APIs emulator image showed a system Bluetooth crash dialog during this follow-up, so the AOSP image was used for functional verification. Its screenshot capture is black; UI hierarchy and app logs were used to check the new flow. The fresh-to-fresh numeric change branch remains unverified because the public equity references are stale.
