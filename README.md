# PrivacyLens

**Understand what websites and browser extensions can access before you trust them.**

PrivacyLens is an early privacy-oriented browser extension prototype. **Milestone 4** analyzes the current URL locally, reads current-site content settings where Chrome allows it, audits installed-extension permissions, and scans current-page structure only when you ask. All explanations are local. It does not maintain browsing history, save an extension inventory, or store page scans.

**See → Understand → Decide → Forget.**

It analyzes signals, not intent. A warning means **“review this”**, not **“this site is malicious.”** Normal is not a guarantee of safety. PrivacyLens does not provide antivirus functionality, malware detection, guaranteed phishing detection, or complete browser protection.

## Load in Chrome or Chromium

1. Use desktop Chrome/Chromium 92 or newer with Manifest V3 support.
2. Open `chrome://extensions` (in Brave, `brave://extensions`).
3. Enable **Developer mode**, click **Load unpacked**, and select this `privacylens` folder containing `manifest.json`.
4. Pin PrivacyLens from the browser's extensions menu.
5. Open an HTTP/HTTPS website and click the PrivacyLens toolbar icon.
6. Expand a URL finding or site-permission row to read its explanation.
7. Click **Review browser extensions** to open the separate extension audit. Expand an extension for its permissions, explanations, and Chrome warnings. Search by name or filter by review label locally.
8. Click **Scan this page** to inspect the current top-level page’s structural metadata. Expand a finding for its reason and suggestion. Closing the popup discards this page scan.

No installation command, build step, packages, or account are required. Reload when upgrading and accept added permissions if Chrome prompts. Milestone 4 adds `scripting`; the function-injection API requires Chrome 92. The existing `management` permission may say it can manage apps, extensions, and themes because it includes mutation capabilities. PrivacyLens deliberately uses only its read APIs. The existing `contentSettings` permission also bundles reading and writing; this code only reads settings.

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
| High Attention | A non-internal HTTP address also contains sensitive-action words, a brand mismatch, or username/@ syntax. Site settings alone never cause this label. |

Camera alone, notifications alone, and even camera plus microphone do not automatically escalate the status. When all three sensitive settings are Allowed, the popup asks whether you still need them. It makes no inference about intent.

There are no percentage scores. HTTPS does not prove trustworthiness; HTTP alone does not imply malware. Words like `login` or `payment` are informational by themselves. See [URL rules](docs/rules.md) and [platform limits](docs/platform-limits.md).

## Extension privacy audit

The audit reads installed items on demand with `chrome.management.getAll()` and reads Chrome-generated warnings with `getPermissionWarningsById()`. It shows each returned extension's name, description when present, enabled/disabled state, type, version, install type, API permissions, host patterns, and warnings. IDs are used only for the local warning lookup and are dropped from the display model.

PrivacyLens itself is excluded using `chrome.runtime.id`, rather than its name. Returned apps and themes are omitted from this extension-only view. Login-screen extensions, if returned, are labeled as such. Missing, malformed, or unavailable information is stated plainly. Disabled items keep their capability label with an explicit explanation that this does not mean current activity.

The local catalog explains what each permission allows, common legitimate uses, and a practical recommendation. Host explanations cover `<all_urls>`, all-host HTTP/HTTPS patterns, wildcard subdomains, specific domains, port scopes, and local-file patterns. Chrome site-access and file-access controls may further limit actual access. These are browser-reported permission lists, not a full original manifest or proof of behavior.

| Audit label | Deterministic rule |
| --- | --- |
| Normal | No review rule matched. Empty permissions, storage, notifications, bookmarks alone, and clipboardWrite can remain Normal. |
| Review | Broad hosts or any of: tabs, history, cookies, downloads, clipboardRead, geolocation, management, webRequest, webNavigation, scripting, contentSettings, debugger, proxy, nativeMessaging. Incomplete metadata or unrecognized host patterns also ask for review. |
| Stronger Review explanation | History + cookies, history + broad hosts, cookies + broad hosts, or webRequest + broad hosts adds a visible combination reason; the label stays Review. |
| High Attention | Broad hosts combined with debugger, nativeMessaging, or proxy. A single powerful permission without broad hosts remains Review. |

The audit label is separate from the current website's status. Chrome warnings are displayed as returned, without using their wording to infer behavior. **Permissions indicate capability, not proof of misuse.** Review whether the capabilities match the extension's purpose and the features you use. Normal is not a guarantee.

## Manifest permissions

| Exact permission | Why it is needed | What it does not provide |
| --- | --- | --- |
| `activeTab` | Temporary access to the active tab after you open PrivacyLens, including its URL and an explicitly requested page scan. | Continuous all-site access or browsing history. It does not grant persistent access to every website. |
| `contentSettings` | Read the six existing browser settings for the current site's origin. Chrome bundles read/write capability; this code calls only `get`, never `set` or `clear`. | Camera video, microphone audio, coordinates, notification contents, or download events. It does not turn PrivacyLens into a device or activity monitor. |
| `management` | Read other installed extensions and their permission warnings for the audit. No narrower read-only permission exposes this inventory. | This implementation does not disable, uninstall, launch, change extensions, or modify permissions. The permission itself also permits management actions, so read-only behavior is a code boundary. |
| `scripting` | Run one bundled, read-only DOM collector in the active tab’s top frame after **Scan this page**. It works with temporary `activeTab` access; no persistent host permissions are needed. | This implementation does not modify pages, submit forms, read field values, inspect frame documents, inject CSS, register persistent scripts, or monitor page changes. The permission can support changes in other code; read-only behavior is enforced here. |

There is no read-only variant of `contentSettings`; do not interpret this manifest permission as technically incapable of changing settings. Read-only behavior is enforced by the implementation and verified with mocked setter methods that must never be called.

The audit adapter calls only `getAll()` and `getPermissionWarningsById()`. Management mutations are forbidden: `setEnabled`, `uninstall`, `uninstallSelf`, `launchApp`, `createAppShortcut`, `generateAppForLink`, `setLaunchType`, and `installReplacementWebApp`. There are no extension-event listeners, polling, or background monitoring. Mock tests reject any management method outside the two read calls.

References: [management](https://developer.chrome.com/docs/extensions/reference/api/management), [match patterns](https://developer.chrome.com/docs/extensions/develop/concepts/match-patterns), [activeTab](https://developer.chrome.com/docs/extensions/develop/concepts/activeTab), [contentSettings](https://developer.chrome.com/docs/extensions/reference/api/contentSettings), [scripting](https://developer.chrome.com/docs/extensions/reference/api/scripting), [content scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts).

## On-demand page scan

**Scans this page only when you ask. Form values are never read or saved.** Opening the popup alone does not inject the collector. Clicking **Scan this page** runs one function through `chrome.scripting.executeScript()`, in the default isolated world and top frame only. It leaves no observer, event listener, or background scanner on the page. **Closing the scan view discards the result**; that view is the popup.

The collector reads field types and recognized autocomplete tokens, form action/method and submit-button action overrides, HTTP(S) link destinations, eligible visible link labels, iframe source attributes, and resource URL attributes. It never reads input values, passwords, email/card details, textarea contents, or form contents. Link labels inside forms, editable areas, or containing controls are skipped. Raw label text is reduced to a domain label and names from the bundled brand list before returning. Credentials, paths, queries, and fragments are removed from destinations. No forms are submitted and no linked pages are crawled or fetched.

| Page signal | Treatment |
| --- | --- |
| Password, authentication-like, or payment-like form | Informational by itself. A same-origin login form can remain Normal. |
| Form action points to another origin | Review. Compare scheme, hostname, and port; external sign-in and payment services can be legitimate. Empty actions mean the current page; relative actions resolve against its base URL. |
| Sensitive form points to another origin | Review with an explanation; no claim that data was sent. |
| Domain-looking link label differs from destination; brand label uses an unrelated hostname | Review. Known official domains and their subdomains are respected; the local brand list is incomplete. |
| Link uses a shortener, raw public IP, punycode, a brand-like hostname, unusual hostname/port, or username/@ syntax | Reuse applicable local URL rules and explain the signal. Non-HTTP(S) links are ignored. |
| HTTP link/form destination on an HTTPS page | Review; this does not establish that a request happened. |
| Iframes or at least 20 external hostnames in inspected links/resources | Informational. Different hostnames are not necessarily different organizations or trackers. Frame documents are never inspected. |
| Sensitive form to an external HTTP origin on HTTPS, plus a misleading link to that same origin with a brand/domain mismatch | High Attention for this explicit combination only. It remains a review signal, not proof of abuse. |

The page label is separate from the URL/site-permission label. There are no percentages. Domain comparisons use exact hostnames and subdomain boundaries, not a public-suffix database. Structural metadata can miss forms without recognizable types/autocomplete. Scripts can change destinations, intercept forms, or update the page after scanning; the scanner does not inspect that behavior.

The snapshot processes at most 50 forms, 100 controls per form, 400 inputs, 400 links, 200 distinct destination/label patterns, 100 iframes, 400 resource references, and 100 external hostnames. Repeated destinations on the same origin with the same label metadata are grouped; different paths are deliberately not retained. A visible note appears when a limit is reached. Hidden link labels, shadow DOM, frame contents, redirects, and loaded network activity are outside this snapshot. Restricted browser/Web Store pages may prevent injection and show **Unavailable**, not an invented result.

## Privacy

All URL analysis, setting reads, extension auditing, and page scans happen locally. Chrome itself stores its existing site settings; **PrivacyLens only reads them**.

- No persistent host patterns, `tabs`, storage, history, or network-monitoring permissions.
- No background worker, automatic/persistent content script, server/backend, account, analytics, AI API, CDN, API keys, or secrets. The only page injection is the one-shot collector after your click.
- No outgoing network requests. `connect-src 'none'` applies to all extension pages; scripts/styles/data are bundled locally.
- No saved domains, permission states, findings, timestamps, installed-extension names, IDs, permissions, host access, inventories, or history. No visited URLs or settings are transmitted.
- The reader sends only the origin to the browser's local API; it drops credentials, paths, query values, and fragments. No raw addresses or API errors are logged.
- Scan data exists only in popup memory and rendered text. Closing it discards the scan, clears its display, and prevents pending reads from repainting it. Reopening performs a fresh check.

The audit keeps one snapshot in page memory and rendered text. Closing the view clears it and prevents late reads from repainting. Reloading or using **Read again** performs a fresh read and replaces the previous result. Filters use memory only; they do not query Chrome or save the search. No cookies or persistence APIs are used.

The browser's own history, settings, installed-extension registry, and network activity remain separate from PrivacyLens. PrivacyLens only reads Chrome's existing records.

## Offline tests

Use Node.js 22 or newer from this folder:

```sh
node --test
```

If npm is installed, `npm test` runs the same suite. Tests use Node's built-in runner with mocked Chrome APIs, no packages and no live network access. They cover URL rules, permission definitions and normalization, unsupported/default/malformed results, risk integration, read-only API use, incognito query scope, popup clearing, extension inventory normalization, host scope, conservative audit rules, generated warning display, filters, audit clearing/races, page structure/destination rules, caps, malformed snapshots, serialized injection, input-value privacy, explicit-click lifecycle, and source privacy guardrails.

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
src/page/page-collector.js                 One-shot structural DOM collection
src/page/page-reader.js                    Chrome injection adapter
src/page/page-analyzer.js                  Local page rules and aggregate findings
src/page/page-controller.js                Explicit-click and clearing lifecycle
src/page/page-view.js                      Text-only expandable scan explanations
src/extensions/extensions.html            Separate audit page
src/extensions/extensions.css             Audit styling
src/extensions/extensions.js              On-demand lifecycle and local filters
src/extensions/extension-reader.js        Read-only Chrome management adapter
src/extensions/permission-catalog.js      Local permission explanations
src/extensions/host-patterns.js           Host-scope explanations
src/extensions/extension-advisor.js       Normalization and visible risk rules
src/extensions/audit-view.js              Text-only audit rendering
data/                                     Small local brand/shortener lists
tests/                                    Offline tests
docs/rules.md                             URL thresholds and limitations
docs/platform-limits.md                    API evidence and scope
docs/manual-testing.md                    Personal Chrome checks
docs/fixtures/page-scan.html               Local structural test page
docs/verification.md                      Verification record
```

Chrome API access stays separate from explanation and analysis logic. There is no background folder because no background work is needed.

## Scope and limitations

Milestone 4 does not inspect extension source, actual extension behavior, typed form contents, embedded-frame documents, TLS certificates, redirects, download events, or actual camera/microphone/location activity. It does not verify publisher identity, Web Store reputation, or every original/optional permission declaration. It has no history/timeline, cloud storage, backend, VirusTotal, fuzzy matching, or offensive security features.

The URL reference lists remain deliberately small. Permission settings are top-level-site snapshots; inherited defaults, one-time grants, OS rules, embedded frames, and Chromium derivatives can limit what the API tells us. Missing data is shown honestly as Unavailable. See [platform limits](docs/platform-limits.md) and [manual testing](docs/manual-testing.md).
