# PrivacyLens

**Understand what websites and browser extensions can access before you trust them.**

PrivacyLens is an early privacy-oriented browser extension prototype. **Milestone 2** analyzes the current URL locally, reads current-site content settings where Chrome allows it, and explains those settings in plain language. It does not maintain browsing history or audit other extensions.

**See → Understand → Decide → Forget.**

It analyzes signals, not intent. A warning means **“review this”**, not **“this site is malicious.”** Normal is not a guarantee of safety. PrivacyLens does not provide antivirus functionality, malware detection, guaranteed phishing detection, or complete browser protection.

## Load in Chrome or Chromium

1. Use Chrome/Chromium 88 or newer with Manifest V3 support.
2. Open `chrome://extensions` (in Brave, `brave://extensions`).
3. Enable **Developer mode**, click **Load unpacked**, and select this `privacylens` folder containing `manifest.json`.
4. Pin PrivacyLens from the browser's extensions menu.
5. Open an HTTP/HTTPS website and click the PrivacyLens toolbar icon.
6. Expand a URL finding or site-permission row to read its explanation.

No installation command, build step, packages, or account are required. When upgrading from Milestone 1, reload the extension and review Chrome's added `contentSettings` permission prompt if shown. Chrome's wording can mention changing settings because that API bundles reading and writing; PrivacyLens only reads them.

## What it shows

The popup displays the domain, connection scheme, overall status, **URL findings**, and a separate **Site permissions** section. URL analysis uses deterministic rules and small bundled brand/shortener lists. The permission reader uses `chrome.contentSettings.<type>.get()` for the current site's origin.

| Site setting | States the API can report |
| --- | --- |
| Camera, microphone, location, notifications, automatic downloads | Allowed, Blocked, Ask |
| Pop-ups | Allowed, Blocked |

An absent API, failed read, unsupported page, or malformed response appears as **Unavailable**. Chrome returns the effective setting without identifying a default versus a site-specific choice, so PrivacyLens does not invent a separate Default state. It reads browser content settings, not current feature activity, OS device access, or every embedded frame's permissions.

Each row explains what the feature allows, common legitimate uses, when to review access, and a practical recommendation. An Allowed setting does not mean the site is using or misusing it. Automatic downloads refers to multiple automatic files after the first download, not monitoring downloads.

| Label | Meaning |
| --- | --- |
| Normal | No rule requires review; informational findings or Unavailable permission rows may still appear. |
| Review | A URL review signal, an unavailable URL assessment, or camera + microphone + location all Allowed. |
| High Attention | A non-internal HTTP address also contains sensitive-action words, a brand mismatch, or username/@ syntax. Permissions alone never cause this label. |

Camera alone, notifications alone, and even camera plus microphone do not automatically escalate the status. When all three sensitive settings are Allowed, the popup asks whether you still need them. It makes no inference about intent.

There are no percentage scores. HTTPS does not prove trustworthiness; HTTP alone does not imply malware. Words like `login` or `payment` are informational by themselves. See [URL rules](docs/rules.md) and [platform limits](docs/platform-limits.md).

## Manifest permissions

| Exact permission | Why it is needed | What it does not provide |
| --- | --- | --- |
| `activeTab` | Temporary access to read the active tab's URL when you click the extension. | Continuous all-site access or browsing history. No page-injection permission is requested. |
| `contentSettings` | Read the six existing browser settings for the current site's origin. Chrome bundles read/write capability; this code calls only `get`, never `set` or `clear`. | Camera video, microphone audio, coordinates, notification contents, or download events. It does not turn PrivacyLens into a device or activity monitor. |

There is no read-only variant of `contentSettings`; do not interpret this manifest permission as technically incapable of changing settings. Read-only behavior is enforced by the implementation and verified with mocked setter methods that must never be called.

References: [activeTab](https://developer.chrome.com/docs/extensions/develop/concepts/activeTab), [contentSettings](https://developer.chrome.com/docs/extensions/reference/api/contentSettings).

## Privacy

All analysis and setting reads happen locally. Chrome itself stores its existing site settings; **PrivacyLens only reads them**.

- No host patterns, `tabs`, storage, history, scripting, or network-monitoring permissions.
- No background worker, content script, server/backend, account, analytics, AI API, CDN, API keys, or secrets.
- No outgoing network requests. `connect-src 'none'` remains in the popup policy; scripts/styles/data are bundled locally.
- No saved domains, permission states, findings, timestamps, or permission history. No visited URLs or settings are transmitted.
- The reader sends only the origin to the browser's local API; it drops credentials, paths, query values, and fragments. No raw addresses or API errors are logged.
- Scan data exists only in popup memory and rendered text. Closing it discards the scan, clears its display, and prevents pending reads from repainting it. Reopening performs a fresh check.

The browser's own history, settings, and network activity remain separate from PrivacyLens.

## Offline tests

Use Node.js 22 or newer from this folder:

```sh
node --test
```

If npm is installed, `npm test` runs the same suite. Tests use Node's built-in runner with mocked Chrome APIs, no packages and no live network access. They cover URL rules, permission definitions and normalization, unsupported/default/malformed results, risk integration, read-only API use, incognito query scope, popup clearing, and source privacy guardrails.

## Files to learn

```text
manifest.json                              Browser entry point and permissions
src/popup/popup.html                       Popup layout
src/popup/popup.css                        Calm styling
src/popup/popup.js                         Current-tab adapter and scan lifecycle
src/popup/popup-view.js                    Text-only rendering
src/analysis/url-analyzer.js               Local URL parsing and checks
src/analysis/brand-rules.js                Brand tokens/domain boundaries
src/analysis/risk-model.js                 URL label rules
src/permissions/site-permission-reader.js  Chrome content-settings adapter
src/permissions/permission-definitions.js  Explanation text and supported states
src/permissions/permission-advisor.js      Conservative advice/status integration
data/                                     Small local brand/shortener lists
tests/                                    Offline tests
docs/rules.md                             URL thresholds and limitations
docs/platform-limits.md                    API evidence and scope
docs/manual-testing.md                    Personal Chrome checks
docs/verification.md                      Verification record
```

Chrome API access stays separate from explanation and analysis logic. There is no background folder because no background work is needed.

## Scope and limitations

Milestone 2 does not inspect page content, other extensions, TLS certificates, redirects, download events, or actual camera/microphone/location activity. It has no history/timeline, cloud storage, backend, VirusTotal, fuzzy matching, or offensive security features.

The URL reference lists remain deliberately small. Permission settings are top-level-site snapshots; inherited defaults, one-time grants, OS rules, embedded frames, and Chromium derivatives can limit what the API tells us. Missing data is shown honestly as Unavailable. See [platform limits](docs/platform-limits.md) and [manual testing](docs/manual-testing.md).
