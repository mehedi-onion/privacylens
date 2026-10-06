# Milestone 6 platform check

Checked **before coding** on October 7, 2026 against official [webNavigation](https://developer.chrome.com/docs/extensions/reference/api/webNavigation), [worker events](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/events), [worker lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle), [tabs](https://developer.chrome.com/docs/extensions/reference/api/tabs), [windows](https://developer.chrome.com/docs/extensions/reference/api/windows), and [runtime messaging](https://developer.chrome.com/docs/extensions/reference/api/runtime) documentation.

## Minimum access and actual signals

Only **webNavigation** is added. Its events/read methods require that permission; no host grants, webRequest, history, tabs, or storage permission is necessary. Basic tab ID/active/incognito/window fields, tab cleanup events and window focus events do not require the tabs permission. The existing activeTab grant supplies the popup's current URL. Exact manifest permissions are activeTab, contentSettings, management, scripting, downloads, webNavigation.

`onCommitted` reports frameId, tabId, final URL, transitionType and transitionQualifiers. frameId **0** is the top-level frame. The documented qualifiers (Chrome 44+) are:

| Qualifier | Documented meaning |
| --- | --- |
| server_redirect | One or more redirects caused by HTTP headers from the server. |
| client_redirect | One or more redirects caused by JavaScript or page refresh tags. |
| forward_back | The user initiated navigation with Back or Forward. |
| from_address_bar | Navigation began from the address bar. |

The event does **not** contain an ordered chain, previous redirect URLs, hop count or expected domain. PrivacyLens deliberately does not reconstruct those. A missing snapshot differs from an observed event with an empty qualifier list. Neither establishes site safety. Transition type is normalized internally; the UI only explains the useful qualifiers, not technical enum/IDs.

`documentId`, documentLifecycle and frameType are Chrome **106+**. A document ID changes on a new document and remains stable across its lifecycle. These are optional here; minimum Chrome remains **92** for the existing page scanner. On 106+, the popup read verifies the current document ID. On older Chrome, it verifies origin and relies on navigation-start/commit invalidation; this is less precise. `getFrame` uses its callback form because Promise support starts at Chrome 93. Callback errors are consumed without logging raw URLs/errors. Incognito/unknown contexts, restricted/non-HTTP(S) pages and non-active lifecycle documents are unavailable.

## Event/lifecycle and privacy boundary

The module worker registers listeners synchronously during initial script execution: top-level onCommitted plus onBeforeNavigate for invalidation; tabs.onRemoved/onActivated/onReplaced and windows.onFocusChanged for cleanup. It does not subscribe to subframe-specific analysis, onHistoryStateUpdated, traffic events or browser history. An event's basic tab/frame IDs are inspected first; a query of only the focused active tab checks regular scope before URL normalization. The full event URL exists only during that local callback and is reduced to its origin. Event timestamps are never inspected or retained.

One current snapshot contains origin/domain/scheme, type/qualifiers and internal tab/window/document correlation. It is replaced or cleared, never appended. One five-minute deadline/timer bounds memory lifetime; these internal expiry values are not Chrome navigation timestamps or a log. There are no startup scans, backfill, per-tab lists, polling, keep-alive ports, alarms, storage or outgoing communication. Finite popup messages read only this memory after tab/frame validation.

Chrome normally stops an idle worker after about **30 seconds**, losing globals. A later event wakes a fresh worker with no earlier snapshot. PrivacyLens deliberately chooses Unavailable instead of storage or reconstructing history. Background-tab navigations are ignored, switching tabs/windows clears the snapshot, and prerender/tab replacement can leave no observed active commit. Same-document URL changes can keep the initial qualifiers if the same document/origin still matches. Chrome's internal upgrades, BFCache and Chromium derivatives may affect reported signals; no complete redirect coverage is promised.

---

# Milestone 5 platform check

Checked before implementation on October 7, 2026 against official [downloads](https://developer.chrome.com/docs/extensions/reference/api/downloads), [worker events](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/events), [worker lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle), [module workers](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/basics), [runtime messaging](https://developer.chrome.com/docs/extensions/reference/api/runtime), and [incognito](https://developer.chrome.com/docs/extensions/reference/manifest/incognito) documentation.

## API and minimum permission

The only new permission is **downloads**. It supplies onCreated/onChanged/onErased events and the read-only `search({ id }, callback)` metadata lookup. No downloads.open, downloads.shelf, downloads.ui, storage, notifications, or host permission is added. Minimum Chrome stays **92**. finalUrl and its delta are documented from Chrome 54; core fields/events predate this baseline. Promise forms of downloads.search start at Chrome 96, so this code uses callbacks and consumes runtime.lastError without displaying/logging raw errors. Runtime messaging also uses callbacks.

The downloads permission bundles more than observation: it can initiate/manage downloads and query Chrome’s download history. There is no narrower event-only permission. Read-only behavior is enforced in code and API-proxy tests, not by the permission itself. PrivacyLens never calls download, cancel, erase, removeFile, open, show, pause, resume, setShelfEnabled, setUiOptions, acceptDanger, getFileIcon, or showDefaultFolder; it never registers onDeterminingFilename or suggests names.

## Exposed metadata and selection

| Chrome field | PrivacyLens treatment |
| --- | --- |
| id | One internal identifier for the current event’s lookup/erasure; omitted from normal UI and responses. No ID list. |
| incognito | Required to be false. Incognito or unknown scope is discarded before filenames/sources are read. The popup also skips download reads in private/unknown tab contexts. |
| filename | Chrome supplies an absolute path. Immediately reduce to basename, flag structural patterns, and escape directional/control formatting. No directory path is retained. |
| url / finalUrl | Original and final source after Chrome’s redirects. Retain only origin/domain/scheme and local URL-rule findings. No credentials, path, query, fragment, or redirect chain. |
| danger | Browser-reported classification, not PrivacyLens’s file assessment. See values below. |
| state | in_progress, interrupted, complete; otherwise Unavailable. Completion describes transfer, not safety. |
| mime | Sanitized browser-reported type only; no byte-based type verification or mismatch inference. |
| fileSize | Byte count after decompression; -1 means unknown. Invalid/missing counts also show Unknown. |
| paused | Boolean reported status; malformed/missing becomes Unavailable. |
| referrer, start/end/estimated times, bytesReceived, exists, hashes and other fields | Not retained or used for scoring. No file reading or hashing. |

onCreated supplies a DownloadItem when a download starts; a filename/size/danger may change later. onChanged supplies a delta and ID rather than a complete item. Relevant deltas cause a **single ID-only query for that event**, even after worker restart. There is no empty-query search, historical list, newest-by-time search, backfill on popup opening, or timer-based polling. Chrome’s own metadata search can refresh its file-existence information. Those exists-only deltas are ignored to avoid a feedback loop; PrivacyLens does not read file contents. onErased clears the matching temporary check and invalidates pending reads.

## Actual Chrome danger values

Core documented values: `safe`, `file`, `url`, `content`, `uncommon`, `host`, `unwanted`, `accepted`. The current API does **not** document `dangerous`, `dangerous_url`, or `dangerous_content`; these use the unknown-value fallback instead of fabricated aliases.

Other current documented values: `allowlistedByPolicy`, `asyncScanning`, `asyncLocalPasswordScanning`, `passwordProtected`, `blockedTooLarge`, `sensitiveContentWarning`, `sensitiveContentBlock`, `deepScannedFailed`, `deepScannedSafe`, `deepScannedOpenedDangerous`, `promptForScanning`, `promptForLocalPasswordScanning`, `accountCompromise`, `blockedScanFailed`, `forceSaveToGdrive`, `forceSaveToOnedrive`.

Availability and policy behavior vary by Chrome version/organization. Where the reference only names a workflow value, PrivacyLens shows that exact code and generic policy/version guidance without inferring more. Unknown/malformed values are explained conservatively. Only file/url/content/host/unwanted warnings can combine with another filename/source review signal for High Attention. Uncommon, accepted, enterprise and unknown classifications do not automatically get that combination label.

## Worker and privacy tradeoff

A bundled module worker registers the three listeners synchronously during top-level startup. It stores one sanitized object and an internal expiry deadline in ordinary memory; there are no storage APIs. Each accepted event replaces the object and schedules one cleanup after five minutes. There is no periodic task or attempt to keep the worker alive. A relevant change after shutdown can create a new current-event check from its ID; previous events are not reconstructed.

Chrome normally terminates an idle worker after roughly 30 seconds, losing global variables. A popup read wakes it but cannot recover a lost record without a new download event; it honestly shows **No recent PrivacyLens-observed download**. Popup results also expire within their remaining lifetime and clear on closure. While the worker still has the record, reopening may briefly display the same check. This is deliberate limited availability rather than persistent history. Keeping worker DevTools open can alter termination behavior during testing.

Messages are accepted only from the exact PrivacyLens popup URL and its extension ID. No external messaging, open port, notifications, network, telemetry, or browser-navigation subscription is used. The default incognito mode is not changed or enabled. If Chrome delivers a private item, its metadata is discarded; a changed-event ID lookup may be necessary to learn its incognito flag before discarding it. Incognito items are never cached or shown.

The tool cannot know user expectations or trust, inspect file bytes or archives, determine OS file associations, independently verify Chrome warnings, or guarantee protection. Browser derivatives can differ; Firefox/mobile support is not promised. Normal remains a limited signal result, never a safety guarantee.

---

# Milestone 4 platform check

Checked before implementation on October 7, 2026 against official Chrome documentation for [activeTab](https://developer.chrome.com/docs/extensions/develop/concepts/activeTab), [scripting](https://developer.chrome.com/docs/extensions/reference/api/scripting), and [content scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts).

## Minimum access and user action

The only new manifest permission is `scripting`. Existing `activeTab` supplies temporary access after the user opens the toolbar popup. The explicit **Scan this page** button then calls `chrome.scripting.executeScript()` once. No broad/persistent host permissions, declared content scripts, background worker, dynamic script registrations, events, polling, or monitoring are added. URL/site-setting reads on popup opening do not inject this function.

`executeScript()` defaults to the top frame and isolated world. PrivacyLens supplies only `target: { tabId }`, the bundled collector `func`, and a brand-name `args` list. It does not set `allFrames`, choose the page's MAIN world, change styles, or inspect embedded documents. Isolation separates extension JavaScript variables from page variables, but both worlds share the DOM. Read-only behavior and avoiding field values are implementation boundaries: `scripting` itself can execute code that changes pages.

The management and content-settings permissions remain unchanged and read-only in this implementation. Exact manifest permissions are `activeTab`, `contentSettings`, `management`, `scripting`.

## Version and browser limits

- The scripting API starts with Chrome 88 / MV3; Promise-based `executeScript()` starts with Chrome 90. The `func` and `args` fields used here start with Chrome 92. The project's minimum is therefore raised to **Chrome 92**. It does not specify a `world` option requiring a later version.
- Desktop Chromium derivatives can restrict APIs differently. Firefox and mobile support are not promised.
- Browser pages, Chrome Web Store pages, and other protected documents can prevent injection. PrivacyLens also deliberately rejects file and non-HTTP(S) URLs. Failures show Unavailable without logging raw browser errors or inventing a result.
- Temporary access can be lost on navigation. The reader verifies the returned top-frame origin matches the queried tab origin and ignores results after popup closure. An injection already sent to Chrome cannot be cancelled; it still performs only a one-time bounded read. Same-origin navigation or DOM changes can make any snapshot stale.

## Structural scope and privacy limits

The function reads types/autocomplete tokens, action/method attributes, submit-button action overrides, eligible visible link labels and hrefs, iframe src attributes, and resource src/href attributes. It never reads `.value`, default values, textarea contents, form contents, page HTML, frame documents, or page JavaScript variables. Links inside forms/editable areas or containing controls have their labels skipped. Link text is reduced locally to domain/known-brand labels; raw text is not returned. Sanitized origins, recognized domain/brand labels, Boolean structural flags, and aggregate counts pass back to extension code; credentials, paths, queries, and fragments are dropped. The analyzer returns grouped explanation text, not the original metadata arrays.

The scanner does not submit forms, crawl links, fetch destinations, resolve redirects, inspect TLS, observe downloads, or infer where scripts send data. It cannot cover shadow DOM, embedded-frame forms, unrecognized custom controls, or changes after the scan. Relative URLs resolve using the document base; empty form actions use the current page. Different origin means a different scheme, hostname, or port. Host comparisons do not group registrable domains with a public-suffix database.

Iframes are counted using source attributes, not current frame contents or sandbox-origin information. External-hostname counts include DOM references from links/resources/iframe sources, not proof of network requests, distinct organizations, or trackers. Password/payment metadata and iframe/reference counts are informational alone.

Collection limits: 50 forms, 100 controls per form, 400 inputs, 400 links, 200 destination/label patterns, 100 frames, 400 resource references, 100 external hostnames. This bounds processing of selected DOM elements; selectors themselves still operate on the document. A cap note identifies partial results. Link deduplication uses sanitized origin plus recognized label metadata, so different paths at one origin are not retained.

Scan results live only in popup memory/rendered text, are replaced by another explicit scan, and are cleared on pagehide. No storage, cookies, history, telemetry, or outgoing requests are introduced. Chrome/page activity remains separate from this extension.

---

# Milestone 3 platform check

Checked October 7, 2026 before coding against the [Manifest V3 management reference](https://developer.chrome.com/docs/extensions/reference/api/management).

- `management` is the only added permission. No host grants are needed. The API also permits mutations; PrivacyLens uses only `getAll()` and `getPermissionWarningsById()`.
- `ExtensionInfo` exposes name, description, enabled state, type, version, install type, API permissions, and host permissions. IDs support local warning lookup; they are omitted from the display model. This is not a full original/optional-permission manifest or evidence of use.
- Generated warnings may be read by ID. A failed warning read is Unavailable; an empty list does not prove safety.
- Promise forms are available from Chrome 88, matching this project's minimum. Desktop Chromium derivatives can differ. Firefox/mobile support is not promised.
- Returned themes and app types are omitted; login-screen extensions are labeled. Managed items use the same capability rules. Built-ins, other profiles, and Store reputation are not guaranteed to be exposed.

[Host-pattern documentation](https://developer.chrome.com/docs/extensions/develop/concepts/match-patterns): wildcard schemes mean HTTP/HTTPS; wildcard domains include subdomains; paths are ignored for host permissions; explicit ports can narrow scope. Browser site/file-access controls can limit actual reach.

[Chrome permission warnings](https://developer.chrome.com/docs/extensions/reference/permissions-list) describe capabilities. Read-only behavior is enforced in code and tests, not by a read-only variant of `management`.

---

# Milestone 2 platform check

Checked before implementation on October 6, 2026 against the [Chrome Manifest V3 contentSettings reference](https://developer.chrome.com/docs/extensions/reference/api/contentSettings).

## API and minimum permissions

Use `chrome.contentSettings.<type>.get()` for the current top-level site's origin. The only new manifest permission is `contentSettings`. Keep `activeTab` to obtain the current URL on a toolbar click. No host patterns, page injection, `tabs`, device permissions, or storage permissions are required.

| Popup row | Content-setting type | Supported return values |
| --- | --- | --- |
| Camera | `camera` | `allow`, `block`, `ask` |
| Microphone | `microphone` | `allow`, `block`, `ask` |
| Location | `location` | `allow`, `block`, `ask` |
| Notifications | `notifications` | `allow`, `block`, `ask` |
| Pop-ups | `popups` | `allow`, `block` |
| Automatic downloads | `automaticDownloads` | `allow`, `block`, `ask` |

The UI maps these to Allowed, Blocked, and Ask. Unavailable means the reader is absent, the page is unsupported, the call failed, or the returned value was not valid for that setting. It is not a fourth Chrome setting.

Chrome's documented defaults are Ask for five types and Block for pop-ups, but PrivacyLens reads each result rather than applying defaults itself. The `get()` response does not identify a site override versus an inherited default. A literal `default` or pop-ups `ask` response is treated as Unavailable. The UI does not invent a separate Default state.

## Read-only use of a read/write API

There is no read-only variant of the `contentSettings` manifest permission. It permits both reading and modifying content settings, which is why Chrome can show a settings-changing permission warning. PrivacyLens uses only `.get()`, never `.set()` or `.clear()`. This is an implementation boundary, not a restriction enforced by the permission itself.

The permission does not itself provide camera video, microphone audio, location coordinates, notification contents, download events, or browsing history. PrivacyLens requests none of those APIs. It reads existing browser settings without asking the website to use a feature.

## Browser and scope limitations

- The callback form of `get()` works with the existing Chrome/Chromium 88+ Manifest V3 baseline. Promise support for this API starts at Chrome 96, so the reader wraps callbacks instead of raising the minimum version.
- The six setting types predate Manifest V3. A Chromium derivative can still omit, restrict, or implement a setting differently; the reader checks each row. Firefox and mobile extension support are not promised.
- Queries use `primaryUrl` and `secondaryUrl` for the same top-level origin, including scheme and non-default port. Credentials, paths, fragments, and query values are omitted.
- Camera/microphone settings in embedded documents and location settings with a different requesting origin are outside this check. The extension does not inspect frames or claim a complete permission inventory.
- Allowed does not prove access is happening or will succeed. Secure-context requirements, embedded-frame policies, OS settings, device availability, browser rules, or temporary grants may affect actual access. The API does not reveal one-time grant duration, setting provenance, current feature use, or misuse.
- The tab's incognito flag is passed to the getter. PrivacyLens does not enable incognito access, change incognito settings, or retain results. Failed reads show Unavailable.
- Restricted pages and non-HTTP(S) addresses get six Unavailable rows without a content-setting query. Unsupported rows do not manufacture risk findings.
- Settings are a snapshot when the popup opens. Reopen after changes; there are no listeners, polling loops, background checks, or timestamps.

Only the six requested settings are included. Clipboard, cookies, JavaScript, sound, and newer content types are outside Milestone 2.
