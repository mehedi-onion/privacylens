# Milestone 8 verification

Verified October 7, 2026 against published baseline `af35fbff0b929d2051db609c4d9bd213cdc195ce`.

- **290 tests passed, 0 failed**: all 250 baseline tests retained, plus 40 guidance/transparency/privacy/accessibility cases. Existing UI assertions now use What was noticed / Why this matters / Consider; worker assertions include the new temporary transmission-state enum. No risk thresholds changed.
- All **56 JavaScript files** pass syntax checks; JSON, relative imports, local HTML assets, version consistency and Git whitespace pass. Manifest differs only by version 0.8.0: no required/optional permission, host, CSP or Chrome-minimum change.
- Source and complete-project secret/privacy scans pass with legitimate existing VT/key-storage/active-tab/host-explanation references classified in [security-audit-m8.md](security-audit-m8.md). No secret values, extra endpoint, result storage, telemetry, mutation or history database found. Request adapter, key-store and quota-limiter are unchanged.
- Status summaries and per-source states are explicit. Normal includes its no-guarantee caveat. Website overview rules remain URL/site/navigation/requested-reputation; page/download labels stay separate. Review explanations identify observation, reason and consideration. No permission is treated as proof of activity or intent.
- Privacy summary correctly distinguishes not checked/unavailable, local reads, external sharing after confirmation, possible transmission after failure/cancellation, and existing key/quota memory. HTTP errors do not erase transmission disclosure; clearing a report cannot conceal prior sharing in the same popup.
- Native details/summary controls, headings, labels, live status text, explicit status words/symbols, table caption/row-column scopes, focusable overflow and visible light/dark focus support accessibility. Contrast checks cover reading text and focus. Assistive technology integration still needs personal Chrome review.

## Presentation preview

Actual modules were previewed locally with synthetic Chrome APIs and a mocked request adapter: A Normal, B brand Review, C combined synthetic High Attention, D three allowed sensitive site settings, E explicit structural page scan, F redirect/context guidance, G temporary double-extension download, H vendor result plus failed authentication and sticky sharing disclosure, I dedicated extension audit, J transparency. Keyboard expansion, readable light/dark layouts and absence of console warnings/errors were checked. Popup preview image is outside the repository. No real key, inventory, file contents or live reputation request was used.

A preview is not actual MV3 loading or lifecycle verification. The [current manual checklist](manual-testing.md) covers real Chrome prompts, popup sizing, direct/redirect/page/download cases, keyboard/screen reader, profile/session cleanup and optional live VirusTotal request with a fresh private key.

## Publication scope

Milestone 8 is one separate commit: `feat: improve PrivacyLens trust and privacy transparency`, normally pushed to origin/main. No later milestone or new scanner is included. The [privacy table](privacy.md) and bundled transparency page distinguish temporary memory from optional key persistence and authentication transmission.

---

The following sections are historical verification records.

# Milestone 7 verification

Verified October 7, 2026 against the published redirect-awareness baseline `6f260b6bcce59ee85db823d6594c48bbe55a241c`.

## Automated and privacy checks

- **250 tests passed, 0 failed**: all 186 baseline checks remain, with manifest/network-storage guard expectations updated for the explicitly scoped optional feature. The 64 added cases cover key modes/removal/restricted access/failures, public-host sanitization, report whitelisting, conservative combined guidance, 200/400/401/403/404/429/5xx/malformed/network errors, finite timeout, session-safe throttling/daily budget, explicit two-step consent, no startup/tab-change lookup, authenticated message boundaries, host denial, changed-tab rejection, cancellation/closure/races, settings and text-only UI.
- All VirusTotal calls in tests and the browser preview are **mocked**. No real API key was accessed, committed, or used, and no live reputation lookup/submission occurred.
- Syntax checks pass for **51 JavaScript files**. JSON parsing, version consistency (0.7.0), relative imports, local HTML assets and Git whitespace checks pass. No external dependencies were added.
- The only new required permission is **storage**. The exact HTTPS VirusTotal host is optional and requested from the second confirmation click; no required host permissions, all-sites grant, history/webRequest/tabs additions or mutation APIs were introduced. Chrome minimum is 102 for session storage/access restrictions. CSP permits only the domain-report API path, with local scripts/styles.
- The sole request adapter is a fixed HTTPS domain GET with x-apikey header, omitted cookies/referrer, no body/cache, refused redirects and a 12-second abort timeout. No full URL, path/query/fragment, page/form data, file/hash, permission state, history or extension inventory is sent. No POST, upload, rescan, automatic lookup, timer retry or polling exists.
- Storage is isolated to the key adapter. Both areas are restricted to trusted extension contexts before key access. Default key and four anonymous quota numbers use memory-only session storage; an explicit Remember choice saves **only the key** to local disk storage. No sync or scan/report/domain persistence exists. Forget removes both key copies without resetting quota; failures are reported honestly. Storage-operation tests reject extra quota fields and verify no domain/result reaches storage.
- Requests are spaced at least 20 seconds and budgeted at most 500 per UTC day in this browser session, including worker recreation. 429 cooldown respects bounded Retry-After; QuotaExceededError waits conservatively until UTC midnight. Account quotas remain authoritative, including other clients, session resets and monthly limits. No retries or bypass behavior occur.
- Fixed error messages never echo raw exceptions, server bodies or keys. Source guards retain no logging, telemetry, unsafe HTML, management/download mutations, browser history monitoring or website field-value access. All prior read-only and collector value-trap tests continue passing.
- Publication secret scan covers all tracked/new files for VirusTotal-style keys, API/service tokens, real passwords, private keys, credential files and URL credentials. Reviewed exceptions are synthetic test markers, Boolean password-field metadata and the dynamic x-apikey header variable, never a real key. No secret was detected.
- Clean external reports do not lower local Review/High Attention, including site settings. Any flag can add Review, while multiple vendor flags alone remain Review. New High Attention requires at least three malicious verdicts plus both local brand mismatch and username/@ syntax; visible explanation identifies that combination. Counts indicate vendor judgments, not proof of misuse.

## Browser preview and remaining checks

The actual popup, options, worker/message/key adapters and count renderer were exercised on loopback under the manifest CSP, with a synthetic key, Chrome mock and replaced request adapter. Verified: no-key guidance; zero calls on configuration/first-click disclosure/cancel; one call after confirmation; sanitized hostname path without query/fragment; counts/Review integration; private fixed invalid-key guidance; session Save, explicitly checked Remember and Forget; empty field after Save; no errors/warnings; reload clearing the previous result. A preview image is saved beside the project. No real browser inventory, credential or external report was used. The temporary harness is outside the repository and is removed from the active browser/server after verification.

This does not prove actual Chrome unpacked loading, the optional-host prompt, profile/session storage lifetimes, or a real VirusTotal account's restrictions/report/CORS behavior. Those remain [the exact personal Chrome checks](manual-testing.md). Use a fresh key only in settings and a public hostname whose disclosure is acceptable. Mock coverage supplies suspicious/error/quota cases without consuming live quota or visiting malicious sites.

## Documented disclosure and Git scope

The [core privacy table](privacy.md), popup disclosure, settings, README and platform record distinguish local features from the confirmed external domain lookup. They explicitly disclose VirusTotal's queried-indicator sharing policy, public API limits/restrictions, unencrypted profile key storage and no guaranteed-safety result.

Milestone 7 is a separate commit after `6f260b6`, with message `feat: add opt-in VirusTotal reputation checks`. Publication uses a normal push to origin/main, never force push. No later milestone, URL/file submission, backend, analytics or scan-history database is included.

---

The following verification sections are historical records for earlier baselines.

# Milestone 6 verification

Verified October 7, 2026 against published download baseline `3662f3c05c362cadfedab299c9bcbd71eed85e6a`.

## Automated and privacy checks

- **186 tests passed, 0 failed**: all 147 baseline tests remain plus 39 navigation tests. Coverage includes each qualifier, both redirect types, conservative benign/login/local cases, visible URL review combinations, unavailable/malformed events/replies, subframe exclusion, private-tab rejection before URL inspection, one-document replacement, tab/window/document matching, closure/focus/activation/replacement/start cleanup, expiry, worker recreation, delayed callbacks, whitelist responses, popup clearing and slow setting-read expiry, and source/manifest boundaries.
- Syntax checks passed for **40 JavaScript files**; JSON parsing, relative imports, bundled HTML assets, version consistency and exact permissions passed. Manifest is activeTab, contentSettings, management, scripting, downloads, webNavigation; minimum remains Chrome 92. No history, webRequest, tabs, host or storage permission was added.
- Only top-level committed/start events and basic tab/window cleanup events are used. A focused active regular-tab query gates URL inspection; getFrame reads only the requested current top-level frame to verify its document/origin. API-proxy tests reject unrelated navigation/tab methods. No startup reads, chain reconstruction or background-tab inventory exists.
- One origin/qualifier snapshot stays in worker memory for at most five minutes, with internal IDs/deadline solely for correlation/expiry. New navigation, tab/window changes, closure/replacement, expiry, reload and worker shutdown discard it. Popup text clears on pagehide/expiry; late replies cannot revive closed/expired or different-document data. URL paths, queries, fragments, credentials, previous URLs and Chrome event timestamps are never retained.
- Source scans found no outgoing request APIs, persistence, browser history/request monitoring, telemetry/logging, polling/alarms, management/download mutations or file reads/hashing. Secret scan covers all tracked/new files for VirusTotal-style keys, tokens, real passwords, private keys and local credential files; eight existing/new synthetic credential/query markers and three structural Boolean field flags were reviewed.
- Redirect alone never creates Review or High Attention. Existing final-URL Review signals receive separate navigation context; existing URL High Attention rules are preserved. Missing navigation data is explicitly unavailable, never proof of no redirect.

## Preview and remaining browser checks

The actual popup, worker adapters, reader and advisor were exercised on loopback under the manifest CSP with synthetic Chrome events/messaging. Confirmed initial unavailable state, no qualifier with address-bar initiation, server-only/client-only/both redirects, Back/Forward, Review with a synthetic brand mismatch, expanded guidance, and clearing back to unavailable. No preview console errors appeared. The screenshot/harness are outside the repository; the temporary tab and server were closed.

This was not a real MV3 event/lifecycle test. Actual Chrome permission acceptance, qualifier delivery (including HSTS/HTTPS-first/BFCache differences), document IDs, active-window/private handling, suspension and Network/Storage inspection remain in [the manual checklist](manual-testing.md). Harmless loopback fixtures support direct and same-site client/server redirects without visiting deceptive domains. No full redirect chain or expected domain is claimed.

## Git scope

Milestone 6 is a separate commit after `3662f3c`, with message `feat: add local redirect awareness`. Publication uses a normal push to origin/main, never force push. No later milestone, VirusTotal, traffic recorder, history database, backend or persistent storage is included.

---

# Milestone 5 verification

Verified October 7, 2026 against published Milestone 4 commit `e1416c259a9d47591e679133149d2a79233b1b58`.

## Automated and privacy checks

- `node --test`: **147 passed, 0 failed**. All 106 baseline checks remain, with manifest expectations updated for the download permission/worker. The 41 download tests cover the current 24 Chrome danger values, unknown/unsupported spellings, safe PDFs/archives, installers, naming patterns, HTTP/source changes, missing/malformed fields, metadata whitelisting, incognito rejection, ID-only event lookups, error/race/erasure handling, worker recreation, five-minute cleanup, message access, UI expiry/closure, text-only rendering, and API guardrails.
- Exact permissions: activeTab, contentSettings, management, scripting, downloads. Minimum Chrome remains 92; downloads.search and runtime messaging use callbacks. The only background work is synchronous registration for download creation/change/erasure plus the popup’s authenticated local read message.
- The downloads adapter uses only event listener registration/removal and search with exactly one event ID. Proxy tests reject all other methods. No startup/history query, polling, persistent ID list, file-content/hash access, or download-management call exists.
- One sanitized worker record is replaced on each accepted event and cleared by a one-shot timer, browser erasure, worker shutdown or reload. No storage API is introduced. Popup results expire within their remaining lifetime and clear on pagehide; delayed reads cannot restore closed/expired/erased records.
- Incognito records are rejected before filenames and sources are inspected or retained. Absolute paths, credentials, URL paths/queries/fragments, referrers, download timestamps and unneeded fields are discarded. Only basenames and source origins/domain explanations are temporarily kept; raw browser errors are never logged.
- Filename or installer type alone never produces High Attention. Uncommon and enterprise/unknown states plus an installer remain Review. Only a documented strong Chrome warning plus another filename/source review signal reaches High Attention. Different final hostnames and normal archives alone remain informational.
- Syntax checks pass for all 35 JavaScript files; JSON/local-reference checks and Git whitespace checks pass. Source scans find no outgoing request APIs, persistence, telemetry, file reads/hashing, management mutations, or downloads mutations. Secret scan covers tracked/new files for VirusTotal-style keys, tokens, real passwords, private keys and credentials; synthetic fixtures are reviewed explicitly.

## Browser checks

The actual popup and worker observer/model were exercised on loopback with synthetic Chrome events and local messaging under the manifest’s strict CSP. Verified the empty state, safe PDF Normal, uncommon installer Review, warning-plus-double-extension High Attention, metadata/guidance expansion, replacement, and erasure returning to empty. No real download metadata was read and no browser danger state was triggered. The temporary harness is outside the repository; its tab and server were closed after testing. This does not test a real MV3 worker’s lifecycle.

Real Chrome permission acceptance, downloaded metadata, callback events, worker suspension, incognito behavior and Network/Storage checks still require [the manual checklist](manual-testing.md). Harmless local fixtures include a simple PDF and plain text with an executable-looking download name; no dangerous contents are used. No live browser danger classification is manufactured by the extension.

## Git scope

Milestone 5 is a separate commit after `e1416c2` with message `feat: add local download safety awareness`. Publication uses a normal push to origin/main, never force push. No VirusTotal, file upload, antivirus, backend, or later milestone is included.

---

# Milestone 4 verification

Verified October 7, 2026 against published Milestone 3 commit `c9e9a553998176a1b3781c7a3fdb7e8b1e04cc2c`.

## Automated and privacy checks

- `node --test`: **106 passed, 0 failed**. All 73 baseline checks remain, with the manifest assertion updated for scripting/Chrome 92. The 33 page-scan tests cover normal/sensitive forms, relative/empty/override actions, cross-origin destinations, matching/misleading labels, local brand/shortener/IP/punycode rules, ignored schemes, iframe/reference counts, grouping/caps, malformed snapshots, isolated function serialization, explicit-click lifecycle, stale/closed reads, and mocked injection errors.
- Value-access traps in DOM fixtures reject input/default-value reads, field-value attributes, textarea/form text serialization, page HTML, and frame document access. Synthetic password/email/card/text markers do not appear in collector output or findings. Form/editable/control-containing link labels are skipped. A static collector guard also forbids value reads, submissions, mutations, networking, and observers.
- Exact permissions are activeTab, contentSettings, management, scripting. Minimum Chrome 92 matches documented `func`/`args` support. There are no persistent host grants, background workers, registered content scripts, external dependencies, or storage permissions.
- The adapter calls only `scripting.executeScript()` once after the explicit button click, targeting the current top frame. Mock proxies reject other scripting methods. It checks origin/frame and ignores late results after closure. Existing management/content-settings read-only guards continue passing.
- Source/data inspection and static tests detect no outgoing request APIs, persistence, cookies, history use, telemetry libraries, unsafe HTML rendering, logging, or management mutations. The extension-page CSP still blocks connections. Destinations are sanitized to origins; raw labels, URL paths/queries/credentials, and form values are not returned or stored.
- Syntax checks cover all JavaScript and JSON. HTML script/style targets resolve locally and Git whitespace checks pass. A separate publication scan checks tracked/new files for VirusTotal-style keys, tokens, real passwords, private keys, and local credentials; synthetic test strings are reviewed explicitly.
- Password/payment fields alone remain Normal. Cross-origin sensitive forms or misleading links produce Review. High Attention requires a sensitive form to an external HTTP origin on HTTPS plus a misleading link to that same brand-like unrelated destination. Labels indicate signals, never proven misuse.

## Browser checks

The actual popup files were previewed on loopback with a temporary Chrome API mock outside the repository and the manifest’s strict CSP. Verified no scan before the button click, separate URL/page labels, expandable plain-language details, and cleared results after reload. The real collector also ran on the bundled fixture in an in-app browser DOM: it recognized forms/links/frame attributes and returned no made-up typed field or textarea contents. No external test links were followed or forms submitted. Preview tabs/server were closed. This is not a test of actual Chrome extension injection.

Real unpacked loading, Chrome's permission prompt, temporary toolbar access, protected-page restrictions, and your browser's Network/Storage panels still require [the manual checklist](manual-testing.md). The bundled fixture blocks submissions and has no outgoing request code. It must be served on loopback for an ordinary HTTP tab.

## Git scope

Milestone 4 is a separate commit after `c9e9a5` with message `feat: add local on-demand page privacy scan`. Publication uses a normal push to origin/main, with no force push. No later-milestone work is included.

---

# Milestone 3 verification

Verified October 7, 2026 against the published Milestone 2 baseline `c405842`.

## Automated and privacy checks

- `node --test`: **73 passed, 0 failed**. The original 39 checks remain, with the manifest assertion updated for `management`; 34 new audit checks cover local explanations, broad/wildcard host scope, combination rules, enabled/disabled state, self/app/theme handling, empty and malformed responses, Chrome warnings, filters, fresh reads, stale response races, and closure during pending reads.
- JavaScript syntax checks pass for all 21 source, data, and test files. Manifest/package JSON parse successfully; local HTML script/style targets resolve. Git whitespace checks pass.
- Exact manifest permissions: `activeTab`, `contentSettings`, `management`. Minimum Chrome remains 88. There are no broad host grants, background workers, content scripts, external dependencies, or new storage permissions.
- The management adapter uses only `getAll()` and `getPermissionWarningsById()`. Mock API proxies reject all other methods. Static inspection also forbids every management mutation and extension-event subscription.
- Source/data scans detect no outgoing request APIs, remote assets, persistence, cookies, telemetry/analytics libraries, logging, unsafe HTML rendering, or secrets. Documentation URLs and synthetic URL strings in offline tests are references/fixtures, not runtime connections.
- A separate pre-commit scan covers tracked and new project files for VirusTotal-style keys, API tokens, real passwords, private keys, and credential-bearing files. Known synthetic test markers are explicitly reviewed; no real secret was detected. Credential exclusions remain in `.gitignore`.
- No extension names, IDs, permissions, hosts, warnings, findings, or timestamps are saved. The single in-memory display snapshot is cleared on pagehide. Late reads cannot restore a closed or superseded view. IDs are dropped after local warning lookup.
- Broad hosts paired with debugger, nativeMessaging, or proxy can justify High Attention. Those permissions alone remain Review. Other specified combinations add stronger Review explanations without a percentage score or behavior accusation. Storage/notifications/bookmarks alone remain Normal.

## Layout preview

The shipped audit files and manifest policy were served on loopback with a temporary synthetic Chrome management mock outside the repository. Verified Normal/Review/High Attention rows, disabled-state context, local search, label filters, explanation expansion, generated warning text, and replacement via Read again. No real installed-extension inventory was read. The preview tab and server were closed after verification.

Actual unpacked loading, accepting Chrome's management prompt, matching your real extension details, manually toggling a third-party extension in Chrome, and checking errors/storage/network still require [the manual Chrome checklist](manual-testing.md). The preview cannot verify the real permission lifecycle or all Chromium variants.

## Git scope

Milestone 3 is a separate commit following `c405842` with the message `feat: add read-only browser extension privacy audit`. Publication uses a normal push to `origin/main`, with no force push. No later-milestone work is included.

---

# Milestone 2 verification (historical)

Verified on October 6, 2026. Milestone 1's record is preserved below.

## Current checks

- `node --test`: **39 passed, 0 failed** (the 21 baseline tests plus 18 new permission/popup tests). All Chrome API calls in tests are mocked; no live networking occurs.
- Syntax checks pass for all shipped JavaScript, local reference lists, and tests.
- Manifest permissions are exactly `activeTab` and `contentSettings`; no host patterns, background worker, content scripts, or storage capabilities were introduced.
- The only new browser API usage is the six `chrome.contentSettings.<type>.get()` calls, with a sanitized current-site origin and the tab's incognito flag. Tests provide setter/clearer methods that fail if called; none were called.
- Source/data static checks find no network, persistence, analytics, unsafe HTML, logging, or secrets. The strict connection-blocking content security policy is unchanged.
- The popup clears URL and permission results on pagehide and prevents pending responses from repainting after closure. No domains, findings, states, timestamps, or history are persisted.
- Permission rules cannot cause High Attention. Camera alone stays Normal on a normal URL; camera, microphone, and location all Allowed can produce Review.

## Browser preview

The actual popup files and strict manifest policy were tested through a temporary loopback preview with mocked tab and content-setting APIs. The preview harness is outside the repository, is not shipped, and was stopped after testing.

Verified mixed Allowed/Blocked/Ask rows, camera-only Normal, all-three-sensitive Review, six Unavailable rows on unsupported input, explanation expansion/collapse using keyboard controls, and calm layout. A preview image is saved beside the project folder.

Actual unpacked installation, Chrome's new permission prompt, and readings after changing real site settings remain personal browser checks. The preview does not validate Chrome's real permission lifecycle or OS device access. Follow [the exact manual steps](manual-testing.md).

## Changes and Git

The repository still has no commits. Its files remain untracked, so ordinary `git diff` has no tracked baseline. A Milestone 1 file snapshot was saved before editing; the final comparison is generated using `git diff --no-index` between that snapshot and an equivalent current snapshot, excluding `.git` metadata. No commit, staging operation, or remote was added.

Suggested focused commit message:

```text
feat: add local site permission awareness
```

Milestone 2 stops at site-setting awareness. No Milestone 3 features were added.

---

## Milestone 1 verification (historical)

Verified on October 6, 2026.

## Automated checks

- `node --test`: **21 passed, 0 failed**, with no external dependencies or network calls.
- The analyzer covers all requested URL signals and brand-domain boundary cases, including Google and bKash examples.
- Popup integration tests verify the current-tab query, explanations, missing URLs, restricted schemes, rejected Chrome API calls, and replacement of previous findings.
- The manifest has exactly `activeTab`, Manifest V3, and valid popup file references. It declares no background worker, content scripts, host permissions, storage permissions, or extra capabilities.
- Source and local data inspection found no outgoing-request APIs, remote assets, persistence APIs, logging of URLs, analytics, secrets, or unsafe HTML rendering.
- Content security policy blocks connections with `connect-src 'none'` and allows scripts/styles only from the extension itself.
- JavaScript syntax and the package file structure were inspected.

## Browser preview checks

The actual popup files were served temporarily on loopback with the manifest's content security policy and a small **simulated Chrome tab API**. This development harness is outside the repository and is not part of the extension.

- Brave/Chromium rendered the bKash lookalike Review state and its expandable explanation.
- The in-app browser rendered Normal, Review, High Attention, and unsupported-address states after the module-loading fix.
- Findings displayed Detected, Why it matters, and Suggestion; the layout was inspected visually in dark mode.
- The strict policy initially blocked JSON module loads. Reference data now uses ordinary local JavaScript modules, avoiding any need to allow connections or add a build step.
- No suspicious domains were opened; all test addresses were passed as strings to the local analyzer.

The extension was **not installed in the user's browser profile** during this verification. Chrome's actual unpacked loading, toolbar access grant, popup sizing, and closing behavior still require the [personal browser checklist](manual-testing.md). The preview verifies rendering and module loading, not Chrome's permission lifecycle.

## Scope and limitations

This is a local URL-signal prototype. It makes no malware, confirmed phishing, or guaranteed-safety verdict. Its small reference lists and hostname heuristics are incomplete. No later-milestone features were added.

## First commit

The repository is initialized on `main`, with all project files untracked and no commit or remote added. Suggested first commit message:

```text
feat: build local-only PrivacyLens URL analysis prototype
```
