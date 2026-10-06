# Real Chromium validation — 0.8.0

Tested October 7, 2026, from Milestone 8 commit `7a9f89115cbd6133a2c41a3c20675241f7e49314`.

## Environment and scope

- Brave 1.96.60, Chromium 154.0.8037.93, official arm64 build.
- macOS 26.5.1 (25F80).
- New isolated browser profile; PrivacyLens loaded unpacked from this repository.
- Real Chrome extension APIs, toolbar popup and DevTools. Local inert fixtures exercised forms, redirects and downloads; no dangerous website, executable execution or browser-warning bypass.
- Google Chrome itself is not installed here. These results establish Chromium/Brave behavior, not a claim that every Chrome version or browser derivative was tested.

## Reproduced bug and fix

**Navigation always showed Unavailable after newly observed visits.** The normalizer accepted only hyphenated UUIDs. This Chromium build returns a 32-character hexadecimal document identifier. A read-only `webNavigation.getFrame` diagnostic confirmed its length and format without recording the identifier or URL.

The fix accepts compact and hyphenated UUID representations and preserves the exact identifier for current-document correlation. Malformed identifiers still fail closed; identifiers are not displayed or persisted. The [official API reference](https://developer.chrome.com/docs/extensions/reference/api/webNavigation) describes a UUID without promising hyphens. No permission, API, collection boundary or risk rule changed.

Two regression tests failed before the fix and passed afterward: compact identifier normalization, and observer redirect reporting with replacement-document rejection. Real server redirects, client redirects, direct visits and Back navigation then showed the appropriate informational findings.

## Observed checks

| Scenario | Real-browser result |
| --- | --- |
| Unpacked extension and worker | 0.8.0 loaded; no manifest/load error; normal inactive-worker lifecycle observed. |
| Normal HTTPS | example.com Normal, no guarantee of safety; explicit scan found one ordinary link and no review signal. |
| HTTP / IP | Loopback HTTP and 127.0.0.1 received calm internal-address/port context. Public HTTP/IP rules remain covered offline. |
| Lookalike fixture | bkash-login-example.localhost produced Review with brand mismatch explanation, without an accusation. No unrelated public lookalike visited. |
| Site permissions | Actual defaults read, then camera/microphone/location Allowed, notifications Blocked, pop-ups Allowed, automatic downloads Blocked matched isolated-profile site settings. Several sensitive settings produced Review, not an activity claim. |
| Extension audit | Inert storage-only extension Normal; inert history/cookies/all-sites extension Review; real Chrome warnings visible; manual disable reflected Disabled on reread. PrivacyLens excluded; no modification controls. |
| Page structure | Same-origin login Normal; structural fixture Review with cross-origin sensitive forms, misleading PayPal label, shortener/IP/punycode links and iframe context. Synthetic input text absent from findings. Closing/reopening reset results. |
| Navigation after fix | Direct visit: no reported redirect; server/client fixtures: corresponding qualifier; Back: Back/Forward qualifier. Redirects alone stayed Normal. No chain invented. |
| Downloads | Harmless PDF Normal; harmless text named invoice.pdf.exe Review for runnable/double extension. No files opened or read by PrivacyLens. |
| Accessibility and transparency | Native disclosures expanded/collapsed using Space; semantic headings, labels, table headers and text statuses present. Seven permissions, optional host and nine data boundaries visible. Full screen-reader certification remains untested. |
| Initial storage/network | local/session key names empty after local checks. Transparency reload requested ten bundled extension assets only. Website/browser traffic is separate from PrivacyLens traffic. |
| VirusTotal consent and lookup | Opening/cancelling produced zero worker requests. One confirmed lookup returned HTTP 200 for `https://www.virustotal.com/api/v3/domains/example.com`: 0 malicious, 0 suspicious, 60 harmless, 32 undetected. The visited page's test query/fragment were absent from that endpoint. The popup disclosed hostname and authentication-key sharing. |
| VirusTotal key and errors | Real key used in session mode, then forgotten. A synthetic invalid string tested Remember across extension reload and a real authentication rejection. Error UI did not echo it and still disclosed sharing. Reopening discarded the report. Forget left local/sync empty and only the anonymous session quota slot; final extension reload cleared session state. No key values or request headers were inspected/exported. |
| Cleanup | Localhost permission overrides reset to defaults; real and synthetic keys forgotten; extension reloaded. Test extensions and harmless downloads remain only in the isolated validation profile/scratch folder, not the repository. |

## Platform behavior and remaining checks

- Brave closed the popup during the first optional VirusTotal host grant. Reopen the popup and confirm the hostname again; no automatic retry is added. Extension reload also closes its open pages.
- Navigation becomes Unavailable when switching tabs/windows, after expiry, or after worker suspension. Download metadata may disappear earlier than five minutes when the worker stops. Neither feature reconstructs missing history.
- Repeat the checklist in **Google Chrome**, which was not installed. Public non-loopback HTTP/IP destinations, an HTTP-to-HTTPS upgrade, OS-level browser restart, and a full VoiceOver pass remain manual checks. The normal same-site server/client fixtures and ordinary worker inactivity were tested here.
- Live 403/404/429/server failures and malformed responses were not deliberately induced. Offline mocks cover them; consuming an account quota or visiting a malicious site is unnecessary.
- Input values have regression tests that throw if read. The real fixture used only a synthetic text marker; password-value noncollection is supported by collector inspection and the throwing-getter tests, not a claim that every form implementation was exercised live.

## Final source and privacy audit

**292 tests pass**, including all 290 baseline tests and two navigation regressions. JavaScript syntax, JSON/import paths, whitespace and secret scans pass. The manifest is byte-for-byte unchanged: activeTab, contentSettings, management, scripting, downloads, webNavigation, storage; optional `https://www.virustotal.com/*`. No new product API or detection rule.

The complete-project search was classified rather than blindly deleting legitimate matches:

| Occurrence | Reviewed use |
| --- | --- |
| `globalThis.fetch` / injected request | Existing VirusTotal domain GET adapter only; actual worker Network showed the confirmed hostname endpoint. No other product network client. |
| `chromeApi.storage` and area aliases | Existing key store: optional session key, explicitly remembered local key, four anonymous session quota numbers. No sync writes or scan/history/inventory/download database. Real slot-name inspections matched these boundaries. |
| tabs API | Existing active-tab queries and navigation cleanup events. No tabs/history permission or history API. Chrome may describe webNavigation as browsing-history access even though PrivacyLens keeps no history. |
| `<all_urls>` | Interpretation of another extension's reported host pattern, tests and documentation; absent from PrivacyLens grants. |
| cookies/history/management/download capabilities | Explanation catalog plus read-only browser adapters. No cookies/history calls or management/download mutation methods. The UI's `reputationCheck.cancel()` cancels a requested reputation check, not a download. |
| analytics/telemetry and prohibited APIs | Negative documentation, guard tests and transparency text. No analytics package, remote logging, XMLHttpRequest, WebSocket, sendBeacon, localStorage or IndexedDB implementation. |
| keys/password/token words | Existing key-entry/authentication flow, structural form metadata, obvious synthetic fixtures and guard tests. Secret scan found no real key/token/password or local credential file. Shipped code has no console logging. |

No unexpected privacy-boundary violation was found. The navigation bug suppressed useful information rather than transmitting or saving it. A remembered key remains readable to someone with profile access; VirusTotal can retain queried hostnames. Those limitations remain disclosed.

This is suitable for an admissions portfolio as a tested student prototype. It is reasonable to publish the source with these limitations, after the user's final review; repository visibility was not changed. This is not a Chrome Web Store release certification or a guarantee about websites, files or extensions.
