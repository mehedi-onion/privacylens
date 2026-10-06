# PrivacyLens

**Understand what websites and browser extensions can access before you trust them.**

PrivacyLens is a privacy-focused browser extension that explains what a website or browser extension can access and highlights signals worth reviewing. Most checks happen locally, and PrivacyLens does not keep browsing history.

This early prototype explains the current address, site permissions, installed-extension capabilities, page structure after a click, recent temporary download metadata and Chrome-reported navigation. An optional VirusTotal domain lookup sends a hostname and your authentication key only after confirmation. It works without VirusTotal. **Milestone 8** makes these boundaries and explanations easier to understand; it adds no detection subsystem or privileges.

**See → Understand → Decide → Forget.**

It analyzes signals, not intent. A warning means **“review this”**, not **“this site is malicious.”** Normal is not a guarantee of safety. PrivacyLens does not provide antivirus functionality, malware detection, guaranteed phishing detection, or complete browser protection.

## Load in Chrome or Chromium

1. Use desktop Chrome/Chromium 102 or newer with Manifest V3 support.
2. Open `chrome://extensions` (in Brave, `brave://extensions`).
3. Enable **Developer mode**, click **Load unpacked**, and select this `privacylens` folder containing `manifest.json`.
4. Pin PrivacyLens from the browser's extensions menu.
5. Open an HTTP/HTTPS website and click the PrivacyLens toolbar icon.
6. Expand **Website address** or **Site permissions**, then a finding to read what was noticed, why it matters and what to consider.
7. Click **Review browser extensions** to open the separate extension audit. Expand an extension for its permissions, explanations, and Chrome warnings. Search by name or filter by review label locally.
8. Click **Scan this page** to inspect the current top-level page’s structural metadata. Expand a finding for its reason and suggestion. Closing the popup discards this page scan.
9. After downloading a file, open the popup promptly and inspect **Recent download**. Use **Check recent download** for a fresh read of the current temporary record.
10. After navigating in the focused active tab, open the popup promptly and inspect **Navigation**. Expand a reported qualifier for its explanation. Missing data is explicitly unavailable.
11. Optional: open **VirusTotal settings**, enter your own fresh key, and save without Remember for session-only use. Then click **Check reputation with VirusTotal**, read the hostname disclosure, and confirm only if you want to share it.

No installation command, build step, packages, or account are required for local checks. VirusTotal alone needs your own eligible account/key. Reload when upgrading and accept added permissions if Chrome prompts. Milestone 7 adds `storage` for the optional key and anonymous session-only quota counters; Chrome 102 is required for session storage and restricted storage access. VirusTotal host access is optional and requested only from the lookup confirmation click. The existing `management` permission may say it can manage apps, extensions, and themes because it includes mutation capabilities. PrivacyLens deliberately uses only its read APIs. The existing `contentSettings` permission also bundles reading and writing; this code only reads settings.

## What it shows

The popup starts with the domain, connection scheme, overall status and one sentence of guidance. Separate expandable sections show **Website address**, **Site permissions**, **Page scan**, **Navigation**, **Recent download** and **VirusTotal (optional)**, with a short state and LOCAL or EXTERNAL label. URL analysis uses deterministic rules and small bundled brand/shortener lists. The permission reader uses `chrome.contentSettings.<type>.get()` for the current site's origin.

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
| High Attention | A non-internal HTTP address also contains sensitive-action words, a brand mismatch, or username/@ syntax. Site settings alone never cause this label. A separately requested reputation report can also justify High Attention only for at least three malicious vendor verdicts alongside both a local brand mismatch and username/@ syntax. |

Camera alone, notifications alone, and even camera plus microphone do not automatically escalate the status. When all three sensitive settings are Allowed, the popup asks whether you still need them. It makes no inference about intent.

There are no percentage scores. HTTPS does not prove trustworthiness; HTTP alone does not imply malware. Words like `login` or `payment` are informational by themselves. See [URL rules](docs/rules.md) and [platform limits](docs/platform-limits.md).

## Trust and transparency

**Privacy of this scan** shows which local checks ran, which were not checked or unavailable, and whether this popup sent a confirmed VirusTotal request. It also distinguishes no saved browsing history/results from an optional session or remembered key and anonymous session quota counters. A failed or cancelled request may already have shared the hostname and authentication key; clearing its report does not erase that disclosure while this popup stays open.

The overall website label combines address, site-setting, navigation and explicitly requested reputation evidence. Page scans and downloads retain separate labels; a recent download may belong to a different site. Extension auditing stays in its dedicated view. Unavailable means the check could not supply evidence, not that it found no concerns. No risk thresholds changed in Milestone 8.

| Overall label | Plain-language guidance |
| --- | --- |
| Normal | No current signal from these checks needs your attention. This does not guarantee that a website is safe. |
| Review | PrivacyLens found something worth checking before you share sensitive information or grant access. |
| High Attention | Several strong privacy or security signals deserve careful review. |

Open **Audit PrivacyLens · transparency** from the popup, extension audit or settings. The [transparency page](src/transparency/transparency.html) explains every permission, the difference between Chrome's technical powers and PrivacyLens's actual read-only use, [data boundaries](docs/privacy.md), and what these checks cannot know. It gives instructions for comparing PrivacyLens with Chrome's own extension details, without awarding itself a trust score. Every review explanation distinguishes what was noticed, why it might matter and what you can consider doing.

Native expandable controls work with keyboard Enter/Space; visible focus, useful headings, text labels and status symbols supplement color. The table has labeled row/column headings and a keyboard-focusable scroll region. No new permission, host, storage field, request endpoint, framework or collection was added. See the [Milestone 8 security audit](docs/security-audit-m8.md) and [personal Chrome checklist](docs/manual-testing.md).

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
| `downloads` | Observe Chrome download events and read metadata only for the ID in a relevant change event. No narrower permission supplies these events. | This code never initiates, cancels, pauses, resumes, opens, reveals, deletes, accepts danger, or changes download UI. The permission also grants broader management/history access, so read-only behavior is enforced in code. No `downloads.open`, `downloads.shelf`, or `downloads.ui` permission is requested. |
| `storage` | Keep the optional key in browser-session memory by default; save only that key to local storage if Remember is checked. Anonymous numerical request counters/deadlines also remain in session memory across worker suspension. Storage is restricted to trusted extension contexts. | No sync, scan/report/domain storage, extension inventory, download history, or browsing database. It is a broad storage capability restricted by this implementation, not an encrypted secret vault. |
| `webNavigation` | Read top-level committed qualifiers and verify the current frame/document for the popup. This is the minimum permission for these signals; no host grants are needed. | It does not expose a complete redirect chain. PrivacyLens does not reconstruct history, collect earlier URLs, inspect traffic, change navigation, or retain background-tab records. Its broader capability is restricted by this code. |

**Optional host grant:** `https://www.virustotal.com/*` allows the one HTTPS API host after your confirmation. Chrome host grants cannot be limited to one path; the code uses only `GET /api/v3/domains/{hostname}`, and the connection policy allows only that domain-report path. There are no required host grants, all-sites patterns, URL submissions, uploads, or non-VirusTotal network adapters. Declaring the optional host does not grant it automatically. It can be revoked in Chrome’s extension settings.

There is no read-only variant of `contentSettings`; do not interpret this manifest permission as technically incapable of changing settings. Read-only behavior is enforced by the implementation and verified with mocked setter methods that must never be called.

The audit adapter calls only `getAll()` and `getPermissionWarningsById()`. Management mutations are forbidden: `setEnabled`, `uninstall`, `uninstallSelf`, `launchApp`, `createAppShortcut`, `generateAppForLink`, `setLaunchType`, and `installReplacementWebApp`. There are no extension-event listeners, polling, or background monitoring. Mock tests reject any management method outside the two read calls.

References: [management](https://developer.chrome.com/docs/extensions/reference/api/management), [match patterns](https://developer.chrome.com/docs/extensions/develop/concepts/match-patterns), [activeTab](https://developer.chrome.com/docs/extensions/develop/concepts/activeTab), [contentSettings](https://developer.chrome.com/docs/extensions/reference/api/contentSettings), [scripting](https://developer.chrome.com/docs/extensions/reference/api/scripting), [content scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts), [downloads](https://developer.chrome.com/docs/extensions/reference/api/downloads), [webNavigation](https://developer.chrome.com/docs/extensions/reference/api/webNavigation).

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

## Download safety awareness

**PrivacyLens observes download metadata only to explain the current event. It does not keep a download history.** Chrome’s download history remains Chrome’s own record; PrivacyLens does not list or copy it.

A minimal module service worker listens synchronously for `downloads.onCreated`, relevant `onChanged` deltas (danger, filename, source/final URL, MIME, size, paused, state), and `onErased` to discard an erased record. Creation supplies metadata directly. A relevant change performs only `downloads.search({ id })` for that event ID, allowing a new worker to recover the current event without a stored ID list. There are no startup/history-list searches, polling, keep-alive ports, or download notifications. Chrome’s metadata search can cause Chrome itself to refresh file-existence metadata; PrivacyLens does not inspect file contents.

Only **one** sanitized record is held in worker memory: basename, source origins/domains, browser danger/status/type/size, filename flags, and an internal ID for matching erasure. Full paths, URL credentials/paths/queries/fragments, referrers, start/end times, hashes, and unneeded fields are discarded. Incognito items are rejected before filenames and sources are read or retained. The download UI also declines reads in incognito or unknown tab contexts.

Each accepted event replaces the record and starts a single five-minute cleanup timer. Worker shutdown erases it sooner; Chrome normally stops idle workers after about 30 seconds. Popup opening/refresh reads that memory without querying downloads. The UI clears on closing and has its own expiry bounded by the remaining lifetime. Reopening may briefly show the same current record while the worker still holds it, but there is no list, timeline, or persistent history. After expiry, shutdown, or reload it says **No recent PrivacyLens-observed download** unless another usable event occurs. A delayed change event can produce a new check for its own ID. This availability limitation deliberately avoids adding storage/session permissions.

| Signal | Treatment |
| --- | --- |
| Chrome `safe`, ordinary HTTPS PDF | Normal unless another rule matches; no guarantee of safety. |
| Chrome `file`, `url`, `content`, `host`, `unwanted` | Explain Chrome’s reported warning; Review by itself. PrivacyLens does not independently verify it. |
| Chrome `uncommon` or `accepted` | Review; uncommon does not prove misuse, and acceptance does not establish safety. |
| Documented enterprise/security workflow values | Show the exact code with generic policy/version guidance; do not guess unspecified meanings. |
| Unknown/unavailable danger code | Honest Review fallback. Example spellings `dangerous`, `dangerous_url`, `dangerous_content` are not current Chrome DangerType values. |
| `.exe`, `.msi`, `.bat`, `.cmd`, `.scr`, `.ps1`, `.js`, `.jar`, `.apk`, `.dmg`, `.pkg` | Review whether the runnable/installer type fits what you expected; extension alone never causes High Attention. |
| `.zip`, `.rar`, `.7z`, `.iso` | Informational archive/disk-image explanation; contents are not examined. |
| Document/image extension before a runnable extension, five or more spaces before the final extension, directional Unicode controls | Explain the naming signal with Review. Directional controls are displayed as visible escapes; ordinary non-English letters alone are not flagged. |
| Original/final source URL signals | Reuse local hostname rules. Public HTTP gets Review; different final hosts alone are informational because CDNs are common. No redirect chain is inspected. |
| Strong browser warning plus another filename/source Review signal | High Attention with a visible combination reason. `uncommon`, unknown, or policy codes plus an installer stay Review. |

Download status is separate from website/page/extension status. Transfer state, paused state, reported MIME and size are descriptive; completion and a MIME label do not establish safety. `fileSize = -1` or invalid/missing size appears as Unknown. Non-HTTP sources or malformed addresses limit domain comparisons. The scanner cannot know whether you trust or expected a source, determine OS file associations, inspect archive contents, or confirm a file’s real type. It never reads bytes, hashes, uploads, opens files, overrides warnings, or makes an antivirus/malware claim. Use only harmless fixtures for [manual testing](docs/manual-testing.md).

## Current-tab redirect awareness

The **Navigation** section shows Chrome's `onCommitted` qualifiers: server redirects (HTTP headers), client redirects (scripts/refresh instructions), Back/Forward, and address-bar initiation. Both redirect types are shown separately if both are reported. An observed navigation with no redirect qualifier is labeled **No redirect qualifier reported**, not a guaranteed direct route. Missing data is **Unavailable**, never an invented normal navigation.

Redirects are common for sign-in, HTTPS upgrades and moved pages. A redirect alone stays **Normal**. If the final URL already has Review findings, the navigation section adds a visible **Review** explanation referencing those same findings. It does not infer what the user expected, compare an unknown previous domain, manufacture hop counts, or create High Attention by itself. Existing strong URL combinations keep their existing High Attention label.

`webNavigation` supplies the final committed URL and qualifiers, not a complete ordered redirect chain. PrivacyLens does not reconstruct earlier URLs using history, request monitoring or more navigation events. It retains only the final origin/domain/scheme, transition type/qualifiers and internal tab/window/document identifiers. Credentials, paths, queries, fragments, event timestamps and earlier destinations are discarded. IDs are never shown or returned to the popup.

Only **one focused active regular tab's current top-level document** is retained in worker memory, for at most five minutes. Background tabs and subframes are not retained; incognito/unknown tabs are skipped before inspecting event URLs. A new document replaces the snapshot. Navigation start, tab activation, window focus change, tab closure/replacement, expiry, worker shutdown and extension reload discard it. Switching away and back can therefore produce Unavailable until a new navigation is observed. There is no per-tab inventory, timeline, startup/backfill query or persistent storage.

Opening the popup makes one local read. The worker verifies the active tab and its current top-level frame using `getFrame({tabId, frameId: 0})`; Chrome 106+ document IDs prevent stale document matches. Older Chrome uses origin matching plus observed navigation-start/commit cleanup, which cannot distinguish documents as precisely. The current URL analysis remains the popup's existing activeTab read. Same-document path/fragment changes retain the initial committed qualifiers when the document still matches. The popup clears on closing/expiry. Idle worker suspension can discard the snapshot after about 30 seconds; open promptly and accept Unavailable rather than treating it as no redirect.

## Optional VirusTotal reputation

PrivacyLens works fully without VirusTotal or a key. It is enrichment, not the local decision engine. Opening a popup, switching tabs, scanning a page, saving a key, receiving a download, or observing navigation never starts a reputation request.

**Check reputation with VirusTotal** first selects the current public hostname and shows a notice. Only **Confirm hostname lookup** requests optional host access and asks the worker for one lookup. Cancelling or denying Chrome’s grant sends nothing. Incognito/unknown contexts, local/internal/reserved names and raw IP addresses are excluded. Confidential public-looking hostnames cannot reliably be recognized: review the displayed name yourself.

The only endpoint is **GET `https://www.virustotal.com/api/v3/domains/{hostname}`** with the user-provided key in the `x-apikey` header. It checks the exact selected hostname, including subdomains, rather than guessing a registrable domain. It drops the URL’s scheme, port, credentials, path, query and fragment. There is no request body, cookie, or referrer; requests reject redirects and time out after 12 seconds. Page contents, typed values, history, installed extensions and downloaded files/hashes are never sent. VirusTotal naturally receives connection metadata such as your IP address.

**Lookup-only does not mean private.** VirusTotal’s [domain endpoint notice](https://docs.virustotal.com/reference/domain-info) says queried indicators may be scanned and included in its shared dataset/community. PrivacyLens does not submit/rescan an unknown domain: a 404 says **No existing VirusTotal report found**. What VirusTotal does with an indicator it receives is outside this extension’s control. Do not look up confidential or personal hostnames.

The popup shows the existing report’s malicious, suspicious, harmless and undetected vendor counts, plus timeout if supplied. Missing or malformed reports fail safely. Labels are **No strong warning found**, **Some security engines flagged this domain**, or **Multiple engines flagged this domain**. No verdicts means no vendor verdicts available. **A clean result does not guarantee safety**, and reports may be old or incomplete.

Any vendor flag can add Review; three or more combined flags receive the multiple-engines wording. A clean report never removes local Review or High Attention, including sensitive site-setting context. Vendor counts alone never cause High Attention. At least three malicious verdicts plus both a local brand mismatch and username/@ syntax can justify High Attention, with that combination explained. URL/reputation guidance is displayed separately from site-permission and page-scan details.

### Key and quota handling

Enter a fresh key only in the settings page. **Save key** does not validate it online. The password field is cleared immediately and the saved key is never prefilled or returned to the popup. There is no bundled key, remote secret store, or sync storage.

- Default: key in `chrome.storage.session`, memory only. Closing the settings page/popup does not lose it; browser restart or extension reload/disable/update does. It survives worker suspension.
- **Remember this key on this browser**: only the key string is saved in `chrome.storage.local`. PrivacyLens does not encrypt it as a secret vault; someone with profile access may recover it.
- **Forget key** removes both copies and aborts a pending lookup. It does not revoke the key at VirusTotal or recall a request already sent. Switching modes removes the prior copy. Storage access is restricted to trusted extension contexts before any key read/write.

The [public API](https://docs.virustotal.com/reference/public-vs-premium-api) allows **4 requests/minute and 500/day** and has personal/academic, non-commercial restrictions. It must not be used for commercial products/services or restricted business workflows, or have quotas bypassed through multiple accounts. Review the terms for your use.

PrivacyLens spaces manual requests at least **20 seconds** apart and caps its own browser-session budget at **500 per UTC day**. Only four anonymous numbers (UTC day, count, next allowed time, blocked-until time) remain in session storage; they contain no domains, reports or activity records. Worker restart preserves the budget; browser restart/extension reload clears session memory. VirusTotal’s account-wide quota remains authoritative, including other clients. Changing/forgetting the key does not reset the budget. No polling or automatic retry occurs.

A 429 shows **VirusTotal rate limit reached. Try again later.** Retry-After is respected with at least a minute cooldown (bounded at a day); a QuotaExceededError conservatively blocks until the next UTC midnight, even if the actual quota interval is different. Monthly/account limits may still apply afterward. Fixed messages explain 401, 403, 404, server errors, malformed responses and network failures without exposing keys or raw server errors.

## Privacy

Local URL analysis, site settings, extension auditing, page scans, download metadata and navigation explanations stay in the browser. Chrome maintains its own records; PrivacyLens only reads them. The [privacy table and data boundaries](docs/privacy.md) explain the optional external lookup.

- No browsing/navigation/download history, saved scans, reputation cache, extension inventory, analytics, telemetry, backend, AI API or remote assets.
- No persistent website host grants. VirusTotal alone has an optional API-host grant; the only external request is a separately confirmed domain GET.
- Only an explicitly remembered key is written to disk. The session key and anonymous quota numbers use memory-only session storage. No cookies, localStorage, IndexedDB, or sync are used.
- No raw URL/error/key logging. Local APIs receive sanitized origins where needed. The one-shot page collector never reads typed form values.
- Results live in the current view or the existing short-lived worker snapshots. Closing the reputation/page/audit view clears its display and rejects late responses; reopening does not restore reputation reports. Only one current navigation/download snapshot can briefly remain under their existing expiry rules.

## Offline tests

Use Node.js 22 or newer from this folder:

```sh
node --test
```

If npm is installed, `npm test` runs the same suite. Tests use Node's built-in runner with mocked Chrome APIs, no packages and no live network access. They cover URL rules, permission definitions and normalization, unsupported/default/malformed results, risk integration, read-only API use, incognito query scope, popup clearing, extension inventory normalization, host scope, conservative audit rules, generated warning display, filters, audit clearing/races, page structure/destination rules, caps, malformed snapshots, serialized injection, input-value privacy, explicit-click lifecycle, download danger/filename/source rules, incognito filtering, event-only ID lookups, expiry, worker recreation, navigation qualifiers/document matching/tab cleanup, local messaging, and source privacy guardrails. Reputation tests mock every request and cover opt-in confirmation, key modes/removal, quota state, sanitization, errors, response whitelisting, conservative integration and closing races. Transparency tests cover exact guidance, data boundaries, manifest completeness, native accessible controls, text/source labels, contrast, honest transmission disclosure after errors and absence of new collection/endpoints.

## Files to learn

```text
manifest.json                              Browser entry point and permissions
src/popup/popup.html                       Popup layout
src/popup/popup.css                        Calm styling
src/popup/popup.js                         Current-tab adapter and scan lifecycle
src/popup/popup-view.js                    Text-only rendering
src/ui/status-copy.js                     Shared status wording and evidence states
src/ui/privacy-summary.js                 In-memory local/external disclosure
src/transparency/                         Permission catalog, data table and limitations
src/analysis/url-analyzer.js               Local URL parsing and checks
src/analysis/brand-rules.js                Brand tokens/domain boundaries
src/analysis/risk-model.js                 URL label rules
src/permissions/site-permission-reader.js  Chrome content-settings adapter
src/permissions/permission-definitions.js  Explanation text and supported states
src/permissions/permission-advisor.js      Conservative advice/status integration
src/background/service-worker.js          Download/navigation events and authenticated local messages
src/options/                              Optional key settings, save/forget UI
src/reputation/domain-rules.js             Public-hostname sanitization
src/reputation/key-store.js                Key-only storage and anonymous session quota
src/reputation/quota-limiter.js            Conservative request spacing/budget
src/reputation/virustotal-client.js        One fixed HTTPS domain GET, no submission
src/reputation/reputation-worker.js        Confirmed lookup and key message access
src/reputation/reputation-advisor.js       Whitelisted counts and conservative guidance
src/reputation/reputation-controller.js    Two-click consent and result clearing
src/reputation/reputation-messages.js      Fixed errors, no raw secrets
src/reputation/reputation-view.js          Text-only evidence rendering
src/downloads/danger-definitions.js        Documented Chrome classifications and fallbacks
src/downloads/filename-rules.js            Explainable basename heuristics
src/downloads/download-analyzer.js         Whitelist/sanitization and local download advice
src/downloads/download-observer.js         One temporary event and read-only browser adapter
src/downloads/download-controller.js       Popup read, expiry and closure
src/downloads/download-view.js             Calm text-only download explanation
src/navigation/navigation-observer.js     One current navigation and browser/document adapter
src/navigation/navigation-reader.js       Local popup read and reply validation
src/navigation/navigation-advisor.js      Qualifier normalization and conservative URL context
src/navigation/navigation-view.js         Text-only navigation explanations
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
docs/fixtures/navigation-direct.html      Local direct/server-redirect entry points
docs/fixtures/navigation-client.html      Harmless same-site refresh redirect
docs/fixtures/page-scan.html               Local structural test page
docs/fixtures/downloads.html               Harmless download test links
docs/fixtures/download-sample.pdf          Simple harmless PDF
docs/fixtures/download-sample.txt          Plain-text naming fixture
docs/privacy.md                           Core privacy table and optional disclosure
docs/verification.md                      Verification record
```

Chrome API access stays separate from explanation and analysis logic. The background worker handles documented download/navigation events plus authenticated key/confirmed-lookup messages; other features keep their existing on-demand behavior.

## Scope and limitations

Milestone 8 does not inspect extension source, actual extension behavior, typed form contents, embedded-frame documents, TLS certificates, redirect chains, file contents, or actual camera/microphone/location activity. It does not verify publisher identity, Web Store reputation, or every original/optional permission declaration. It has no history/timeline, cloud storage, backend, URL submissions, file reputation/upload, fuzzy matching, or offensive security features.

The URL reference lists remain deliberately small. Permission settings are top-level-site snapshots; inherited defaults, one-time grants, OS rules, embedded frames, and Chromium derivatives can limit what the API tells us. Missing data is shown honestly as Unavailable. See [platform limits](docs/platform-limits.md) and [manual testing](docs/manual-testing.md).
