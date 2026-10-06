# Product cleanup review

October 7, 2026. Based on `5b40ece7ff768c0294099a68c906bce19b7a3b49`, version 0.8.0. No feature, detector, risk threshold, browser API, permission, host grant, network endpoint or storage category was added.

## View audit

A = essential now. B = useful on expansion. C = technical/reference detail. D = redundant.

| View | A — kept | B — collapsed or shortened | C — relocated | D — removed |
| --- | --- | --- | --- | --- |
| Popup | Brand, domain, status, one sentence, six check rows and tools | Each check and compact Privacy row | Connection below Website; overall-status scope inside Privacy | Repeated LOCAL badges, introductory philosophy/footer, repeated caveats |
| Website | Address warning summary | Every finding's detection, reason and suggestion | Scheme remains inside the section | Duplicate default guidance |
| Permissions | Short allowed-access summary | Camera/microphone/location/notifications, with More permissions for pop-ups/downloads; all six explanations retained | Chrome setting limitations inside expansion/transparency | Six identical default rows on the first screen |
| Page | User action, warning count and meaningful form/link findings | Routine password/login/payment/frame facts and coverage | DOM counts and cap details inside Scan coverage | Repeated visible status pill, generic no-warning paragraph, repeated close-to-clear note |
| Navigation | Small current observation | Redirect/Back/address-bar explanations | Full API/lifetime restrictions in transparency/docs | Repeated status badge, qualifier terminology in routine labels |
| Download | Compact empty state or recent filename/status; Chrome warning/source | Filename guidance and File details | MIME, size, final source and state inside details | Permanently visible metadata paragraph and repeated signal-title list |
| Reputation | Optional action, confirmation, four counts and vendor interpretation | Result meaning, timeout and caveat | Full provider/key/retention details in transparency | Combined-status badge, repeated clearing disclaimer and repeated optional-intro paragraph |
| Extension audit | Name, enabled state, status, capability summary, search/filter | Why this status; exact permissions, hosts and Chrome warnings | Version/install type/description under Extension details | Repeated capability disclaimers and duplicate unfiltered counts |
| Settings | Key field, Remember, Save/Forget, configuration state | Short session/local note and key-use link | Profile-access risk, quota/terms, authentication and retention in transparency | Long default explanation blocks and redundant footer claims |
| Transparency | Own permission uses, data table, external sharing, limits | Broader Chrome powers, temporary lifetimes and full key details | Historical validation moved to docs/archive | Repeated introductory explanations |

## Code and assets

Shared text-only finding rendering replaces four repeated explanation loops. Two unused text exports and obsolete CSS selectors/mobile overrides were removed. All current source modules and bundled fixtures remain reachable or documented; no meaningful test fixture was dropped. Historical verification/security logs moved to `docs/archive/` instead of remaining alongside current guidance.

The supplied logo is copied unchanged into `assets/logo.png`. Popup, settings, audit, transparency and README use it. A separate eye/lens variant supplies transparent 16/32/48/128 PNG icons; its provenance/prompt is in [assets/README.md](../assets/README.md). The only content-policy adjustment is `img-src 'self'` for bundled artwork. No external image source is allowed.

## Checks

- 305 offline tests pass: all 292 baseline cases retained, with presentation assertions updated, plus 13 cleanup regressions.
- Permission/host arrays and connection policy stay unchanged. All seven permissions still serve existing features.
- Network implementation remains only the confirmed VirusTotal domain GET. Mocks supply reputation preview examples without live requests or real keys.
- Existing key store, quota limiter, worker, page collector, download observer, extension reader and navigation observer are unchanged. No scan/result/history/inventory/download persistence or raw-input collection was added.
- Local/external disclosures preserve shared, possible and locally rejected states. The compact row says “no results saved”, avoiding a false claim that a remembered key is not saved.
- Real unpacked Brave reload confirms the artwork and compact popup. Loopback mocked visual previews cover Normal/Review/High Attention, allowed permissions, page findings, redirects, recent downloads, no/used reputation, audit, settings and transparency. These are visual regression checks, not a repeat of every live validation scenario.

The earlier [real-browser record](real-browser-validation.md) still defines platform gaps: Google Chrome, full VoiceOver and complete browser-restart coverage remain unverified. No additional feature work is recommended for this finished prototype.
