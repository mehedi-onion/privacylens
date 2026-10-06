# Milestone 8 security and privacy audit

Reviewed October 7, 2026 against `af35fbff0b929d2051db609c4d9bd213cdc195ce`.

This is a source review plus offline guard tests, not certification of Chrome, VirusTotal or website behavior. Milestone 8 changes presentation and disclosure metadata, not detector thresholds or collection boundaries.

## Privileges and data flow

The manifest diff is **version 0.7.0 → 0.8.0 only**. Required permissions remain activeTab, contentSettings, management, scripting, downloads, webNavigation, storage. Optional host remains `https://www.virustotal.com/*`; there are no required hosts, new endpoints, history/tabs/cookies/webRequest privileges or all-sites grant. Minimum Chrome 102 and CSP are unchanged.

The VirusTotal request adapter, key-store and quota-limiter files are unchanged. One separately confirmed fixed HTTPS domain GET uses a hostname and dynamic authentication header, not a bundled secret. No automatic request, URL/file submission, extra API or retry was added. Storage still permits only the optional session key, explicitly remembered local key and four anonymous session quota numbers. No result, hostname, scan or inventory is persisted. New summary state is in popup memory only.

## Complete-project search classification

All tracked and new project files were searched, including source, data, fixtures, tests, documentation and ignore rules. Literal API searches were supplemented with aliased Chrome API names, `globalThis.fetch`, request adapter calls, endpoint strings, storage-area aliases and imported dependencies. Test matches are offline mocks/assertions; documentation matches explain behavior or record earlier milestones. No packages or telemetry dependencies exist.

| Search / legitimate occurrence | Classification and reviewed boundary |
| --- | --- |
| fetch / outgoing request | `src/reputation/virustotal-client.js:6` supplies globalThis.fetch to the injected request function, invoked at line 16. Sole endpoint is the existing HTTPS domain-report path. Tests inject mocks. README/privacy/platform/manual/verification describe this exception; other source network-looking prose says no address was fetched. |
| XMLHttpRequest, WebSocket, sendBeacon | No shipped implementation. Only source-guard regexes and documentation of prohibited APIs. |
| chrome.storage / chromeApi.storage | `src/reputation/key-store.js:10` aliases the existing local/session areas; `reputation-worker.js:8` checks support. All get/set/remove/access-level operations remain in that adapter. Tests use isolated mocks; documentation names the actual key/quota exception. No sync. |
| localStorage, indexedDB | No shipped implementation. Only tests prohibiting use and privacy/manual/verification documentation. |
| chrome.history, chrome.cookies | No API calls. Their names/permission words occur only in guard tests, negative boundary documentation, and the extension capability explanation catalog. Explaining another extension's cookies/history permission does not grant it to PrivacyLens. |
| chrome.tabs / chromeApi.tabs | Existing active-tab queries: popup.js:19, page-reader.js:8, download-controller.js:26, reputation-controller.js:29/64, reputation-worker.js:14, navigation-observer.js:26/61. Existing navigation cleanup listeners at observer lines 50–52 and service-worker lines 21–23. No new tab method or tabs permission; no URL-history query. Tests mock active context and cleanup. |
| <all_urls> | `src/extensions/host-patterns.js:2` interprets another extension's reported pattern. Tests/fixtures exercise host-pattern handling and README/platform/manual describe the difference. It is absent from manifest grants and never requested. |
| analytics, telemetry | The transparency footer says **No account, analytics, remote logging, cloud sync or scan-history database.** Other occurrences are negative documentation and test guards. This exact negative HTML sentence is explicitly classified in the source guard; executable telemetry remains forbidden. No runtime SDK, service or logging implementation. |
| console logging | No shipped console calls. Guard tests and documentation reference logging to prohibit it. Fixed error messages do not echo keys, raw server bodies or exceptions. |
| API key, token, password, credential words | Options key field/save flow, key-store validation and dynamic authentication header are existing intentional key handling. Password fields in the collector are structural Boolean metadata only; URL credential syntax is inspected locally. Brand “tokens” are text-matching terms. Download danger labels and permission/advisor/transparency copy explain capabilities or limitations. Tests use obvious synthetic markers and throwing value getters, never real secrets. No raw key is returned to the popup/transparency renderer or displayed after Save. |
| .gitignore credential patterns | Defensive exclusions for local secrets, credentials and development artifacts, not credential files. Scratch tools and preview images are outside the repository. |

The full scan also reviewed historical documentation references separately from current implementation. No mechanical removal of required VirusTotal or key storage code occurred. No mutating management/download/content-setting API, file-content read, field-value collection, history database, remote logging or new background monitor was introduced. Existing API-proxy and value-trap tests remain passing.

## Concern found and corrected

A failed reputation lookup can already have transmitted the hostname and authentication key. Showing no report must not imply no external sharing. Worker replies now classify a received HTTP response as shared and uncertain network/cancellation as possibly shared. The popup records this disclosure before discarding a report for a changed tab; clearing/cancelling another check does not hide prior sharing until that popup closes. Local preflight/quota rejections still disclose no transmission. These flags are temporary metadata, not a request log.

Chrome's bundled permissions are broader than PrivacyLens's read-only implementation, and a remembered key is not encrypted by PrivacyLens. The transparency page now makes both limitations prominent. These existing risks remain: a profile-accessing party may read a remembered key, and VirusTotal may retain/share queried indicators. Forget cannot retract a received request or revoke the vendor key.

## Verification

All 250 baseline tests remain and 40 new tests cover guidance, boundaries, manifest completeness, labels/keyboard controls/contrast and disclosure lifecycles. **290 passed, 0 failed**. All 56 JavaScript files pass syntax checking; JSON, relative imports, local assets and whitespace checks pass. Secret scanning covers all tracked/new files for VirusTotal-shaped keys, tokens, real password assignments, URL credentials, private keys and local credential files. Reviewed exceptions are synthetic fixtures, Boolean field metadata and the dynamic header variable; no real secret was found.

Browser previews exercise all ten requested presentation scenarios using synthetic Chrome metadata and mocked VirusTotal responses, with no external request or real credential. Actual unpacked Chrome, optional host consent, real profile/session lifetimes, screen-reader behavior and live-account cases remain in [manual-testing.md](manual-testing.md).
