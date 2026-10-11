# Android emulator QA

## October 12 v0.2.1 pass: market-closed weekends

On the phone, v0.2.0 showed every market as `UNAVAILABLE` with `xStocks returned incomplete data` over the weekend. xStocks trades 24/5, and while the US market is closed its `price-data` endpoint returns `{"quote":null}` for every token. The app treated that as a failure and also hid Jupiter's live price.

| Area | Result |
| --- | --- |
| Closed, phone with earlier reads | Markets show Jupiter's live price and compare it with the last xStocks price the phone read, labelled with its time (SPYx $784.09 vs $778.60 read October 10, +0.71%). |
| Closed, fresh install (emulator) | With no earlier read, each market shows Jupiter's live price, `MARKET CLOSED` and `Paused` instead of an error. |
| Check and protect while closed | TSLAx $100 at 1.00%: within the limit; the result and protect cards say xStocks' last price was used. |
| History and alerts | Comparisons against a paused price are not recorded and do not trigger alerts. |
| Transient errors | A first-launch Jupiter HTTP 503 on the emulator cleared on relaunch; queries now retry twice (not for a paused price). |
| Layout | The protect card's `ON-CHAIN` pill no longer overflows; reserve age reads `14 MIN OLD` instead of `14M OLD`. |
| Stability | No ReactNativeJS or AndroidRuntime errors; 10 unit tests pass; the APK verifies with the release certificate. |

## October 9 v0.2.0 pass: protect, alerts, history, widget, share

Physical phone: Android 13 arm64 (model IV2201). Emulator: Android 16 Google APIs x86_64, headless. Screenshots are local in `artifacts/qa/phone/` and `artifacts/qa/oct9/` (ignored by Git); screens of the phone's personal home pages were deleted and are not part of the record.

| Area | Result |
| --- | --- |
| Update | v0.2.0 installed over v0.1.2 on the phone as an update. |
| Intro | The three-step intro showed on first launch and led to Markets. |
| Markets | Plain-language cards, and the US session from xStocks (`US MARKET OPEN · CHANGES 1:30 am` at 00:02 IST). |
| Protect | $100 SPYx at a 1.00% limit: max slippage 0.38%, minimum received 0.128118 SPYx, limit price $780.53 (100 ÷ 780.53 = 0.128118). Copy put the minimum on the clipboard; Open in Jupiter opened `jup.ag` with USDC → SPYx selected. |
| Over the limit | At 0.10%: `OVER YOUR LIMIT`, `DON'T SWAP YET`, and Alert me. |
| Alerts | Alert me raised Android's notification permission prompt; after Allow, the alert was listed in Checks and a WorkManager job was registered. A delivered notification was not observed: it needs the route to move within the limit. The transition logic is covered by tests. |
| Refetch defect | Returning from the permission prompt refetched the quote and removed the result and protect card. Fixed: the last result stays on screen during a refetch. |
| Widget | Placed from the app via the launcher's pin prompt on the phone and the emulator. On the emulator it showed all four tokens; the first build wrapped `%` onto a second line, fixed by a smaller single-line value. A forced run of the background job (`cmd jobscheduler run -f`) finished headlessly and updated the widget (`Updated 1:04 AM`) with the app closed. |
| History | After six samples, the SPYx chart showed six bars against the dashed 0.50% limit. The first scale started at zero and hid small moves; it now scales to the observed range. |
| Share | Share this check rendered the result card as an image in Android's share sheet. The footer line was truncated and was shortened. |
| Tests | `npm test`: 10 passing (protection invariant over 5,000 random cases, alert transitions). |
| Stability | No Closing Bell entry in the phone's crash log. |

Not yet re-run on v0.2.0: Solflare connect against the new identity host `guts805.github.io` (that host serves `application/json; charset=utf-8`).

## October 8 physical phone and production wallet pass (v0.1.1 → v0.1.2)

Test device: Android 13 arm64 phone (model IV2201), 1080 × 2400 at density 480, Solflare 2.29.1. Local screenshots are in `artifacts/qa/phone/` (ignored by Git). Screens inside Solflare were not captured.

The phone carried an October 6 debug-signed prototype, which cannot be updated by a release-signed APK, so it was uninstalled and the v0.1.1 release installed.

| Area | Result |
| --- | --- |
| Market check | $1,000 SPYx at a 0.50% limit returned `ABOVE LIMIT` at +0.64%. |
| Save, restart | The saved check was listed after a force stop and relaunch. |
| Update | v0.1.2 installed over v0.1.1 as an update; the saved check remained. |
| Recheck | `Check SPYx again` restored the amount and limit; a $2,500.50 recheck showed `SINCE YOUR SAVED CHECK`. |
| Backing | Issuer reserve records loaded. |
| Wallet without MWA | With only the Jupiter app installed, Connect wallet showed `No compatible wallet is installed…`. |
| Production wallet | Connect wallet opened Solflare; after the tester approved, the app showed the returned address and `No supported xStocks found at this address` from mainnet RPC. Disconnect cleared the address. No signing was requested. Whether Solflare displayed a verified-domain indicator was not recorded. |
| Keyboard (v0.1.1) | **Defect:** with edge-to-edge display, the keyboard covered the amount field and `Check this route`, and would cover the address field. |
| Keyboard (v0.1.2) | The focused amount and address fields move above the keyboard, the content can be scrolled to `Check this route` with the keyboard open, and the tab bar hides while typing. A comma typed from the phone keyboard was read as a decimal point (`2500,5` → `2500.5`). |
| Stability | No Closing Bell entry in the crash log during the session. |

## October 8 network-failure and small-screen pass (v0.1.1)

Test device: Android 16 Google APIs x86_64 emulator, display overridden to 320 × 640 dp (640 × 1280 px at density 320) with system font scale 1.3. Local before/after screenshots are in `artifacts/qa/oct8/` (ignored by Git).

| Area | v0.1.0 finding | v0.1.1 result |
| --- | --- | --- |
| Offline errors | In airplane mode, market cards showed the raw platform error `fetch failed: java.net.UnknownHostException: Unable to resolve host "api.xstocks.fi"…`. | Market check, Backing and Wallet lookup each show a plain message naming the source, for example `Could not reach xStocks. Check your internet connection and try again.`, with a Try again button. Timeouts, HTTP 429, non-JSON responses (such as captive Wi-Fi pages) and RPC errors have separate messages. |
| Recovery | Not tested. | After airplane mode was turned off, Try again on the Wallet lookup loaded holdings without restarting the app. |
| Market card price | The Jupiter price wrapped mid-number (`$779.9` / `3`) because the status pill squeezed its column. | The price has its own full-width line and stays on one line. |
| Header | Brand and tagline wrapped onto five lines and took about 30% of the first screen, pushing every price below the fold. | Brand and tagline stay on one line each; the first SPYx price is visible on launch. |
| Limit buttons | `0.25%` and `0.50%` wrapped as `0.25` / `%`. | All four limits fit on one line. |
| Amount input | Not tested. | A comma decimal separator from locale keyboards is accepted as a decimal point. |

The 0.1.1 release APK installed as an update over the 0.1.0 release (`versionCode` 2, same certificate). No app crash appeared in the crash log. Saved-check persistence across this upgrade was not exercised: no check had been saved on the 0.1.0 install used for this pass. The emulator display and font scale were reset afterward.

Build note: the Android SDK, NDK and JDK previously used from `OneDrive\Desktop\ClockIN\.build-tools` failed release builds because OneDrive converted hard-linked native files (`libjsi.so`, `libfbjni.so`, `libc++_shared.so`) into cloud reparse points that Gradle cannot snapshot. v0.1.1 was built from a copy of the project, SDK and JDK outside OneDrive.

## October 7 independent app build

Installed the rebuilt APK on an Android 16 AOSP emulator at 320 × 640. The home screen showed the SPYx Jupiter route token price, the xStocks issuer indicative **token** price, their difference, and `AGE UNKNOWN` because the issuer price endpoint gives no publication timestamp. The app identified the network as mainnet.

Checked a $100 SPYx route with a 0.50% limit. The result showed the route price, issuer price, ceiling, difference, and `ABOVE LIMIT`, while explaining that the comparison is indicative and does not execute a trade. Saved the check, force-stopped and relaunched the app, then found it in Checks. `Check SPYx again` restored the prior amount and limit and offered a fresh check.

The Backing tab displayed SPYx shares held, token supply, and a dated issuer record whose age was eight minutes at inspection. The Wallet tab showed Connect wallet and a read-only address lookup. After installing Solana Mobile's official fake wallet, authorization handed off correctly, returned a wallet address to the app, showed `No supported xStocks found at this address`, and disconnected correctly. This test exposed an invalid Token-2022 program ID in the holdings RPC call; it was corrected and the fixed APK was installed for the successful retest. No `AndroidRuntime` or `ReactNativeJS` error appeared in the final log check. The AOSP image returned black screenshots, so UI hierarchy and logs were used for this pass. A real wallet and real signed transaction were not tested; this app does not offer a transaction action.

The first independent APK signature verified with `apksigner`. The rebuilt APK after the holdings fix has SHA-256 `9B62D936D1B66060A0CD7374C814193D581C811186E7B8CF621FB6DF691E477B`. This section supersedes the older Pyth-based flow below.

## October 7 release identity check

Generated a persistent release signing key. Its APK certificate SHA-256 fingerprint is `5E:87:B6:61:FC:97:F1:71:96:55:C1:7A:BE:25:F7:88:27:76:E9:AD:EC:2B:FF:85:17:CD:4B:6C:46:A8:B4:AB`. The live `https://closing-bell-eight.vercel.app/.well-known/assetlinks.json` associates that fingerprint with `com.closingbell.mobile` and returns HTTP 200 with the exact `application/json` content type. The endpoint is edge cached; a repeat request returned `X-Vercel-Cache: HIT`.

Installed the release-signed APK on the Android 16 AOSP emulator. Solana Mobile's fake wallet showed `Verification successful` for the domain. Authorized the app, confirmed the address and empty xStocks state, then disconnected. The final APK SHA-256 is `07C42596A51603D01BF275E86C5104FAF7A3A15CC81438A4C59EB3A2A147457D`; `apksigner` confirmed the expected certificate. No app crash appeared in the AndroidRuntime or ReactNativeJS error log. A physical-device test with a production wallet and a funded account is still pending; no transaction flow exists in this app.

Attempted a production-wallet check with Backpack 2.88.0 from its official Android APK download API on a second x86_64 emulator. Backpack itself exited at launch because its APK could not load `libreactnative.so` for that emulator architecture. The available Android SDK images here are x86_64, so this does not test the Closing Bell/Backpack handoff. A physical Android phone is required for that check.

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
