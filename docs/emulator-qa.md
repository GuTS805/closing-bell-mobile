# Android emulator QA — October 6, 2026

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
