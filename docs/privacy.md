# PrivacyLens privacy boundaries

**See → Understand → Decide → Forget.** Milestone 7, October 7, 2026.

| Feature | Leaves browser? |
| --- | --- |
| Local URL analysis | No |
| Site permissions | No |
| Extension audit | No |
| Page scan | No |
| Download metadata | No |
| Navigation awareness | No |
| VirusTotal lookup | Yes, only after explicit user request and confirmation |

PrivacyLens has no account, backend, analytics, telemetry, browsing database, scan history or cloud storage. Ordinary website loads, Chrome's own services and other extensions have separate privacy behavior; this table describes PrivacyLens.

## Optional external lookup

The popup first displays the selected **hostname**. It sends nothing until you press **Confirm hostname lookup** and grant the optional HTTPS API host access if Chrome asks. No lookup occurs automatically on startup, popup opening, tab changes, navigation, page scanning or downloads. Declining either confirmation/grant leaves all local features available.

One GET goes to `https://www.virustotal.com/api/v3/domains/{hostname}`. It sends the exact public hostname (including subdomains) and your API key in the `x-apikey` header, plus normal network metadata such as IP address and browser headers. Cookies and referrer are omitted; redirects are refused. There is no request body.

It does **not** send URL credentials, ports, paths, query parameters, fragments, page contents, typed form values, browsing history, extension inventory, permission settings, local file contents or file hashes. There is no full-URL lookup, submission, upload or rescan endpoint. Reserved/local/internal names, IP addresses and private tabs are excluded; syntactically public but confidential names cannot reliably be detected. Review the disclosed hostname yourself.

**VirusTotal may share queried indicators.** Its [domain lookup notice](https://docs.virustotal.com/reference/domain-info) says queried as well as submitted indicators may be scanned and incorporated into its shared dataset/community. GET is not a privacy guarantee. PrivacyLens cannot recall a received request or control VirusTotal's retention. Do not check confidential or personal hostnames. See its [privacy policy](https://docs.virustotal.com/docs/privacy-policy), [terms](https://docs.virustotal.com/docs/terms-of-service) and [public API restrictions](https://docs.virustotal.com/reference/public-vs-premium-api).

Only four vendor counts and optional timeout are retained from the existing report for the open popup. A 404 means no existing report found; PrivacyLens does not submit it. Reports can be incomplete/outdated. Counts indicate vendor judgments, not confirmed misuse or guaranteed safety.

## Optional key storage

| Item | Where | Lifetime |
| --- | --- | --- |
| Key, default mode | `chrome.storage.session`, trusted extension contexts only | Browser memory; cleared on browser restart or extension reload/disable/update |
| Key, Remember checked | `chrome.storage.local`, trusted extension contexts only | Browser profile until Forget or extension removal; no sync |
| Anonymous quota day/count/deadlines | `chrome.storage.session` | Memory-only; survives worker suspension, clears with the session |
| Reputation result/hostname | Popup memory and text only | Discarded on closing, new check or reload |

Saving is a local action and sends no test request. Only the key string can be written to disk. PrivacyLens does not encrypt it as a secret vault; profile access may reveal it. The settings field is cleared after Save and never prefilled. No key is returned to the popup, logged, placed in an error message or shipped in the repository. No `chrome.storage.sync` is used. Storage failure stops optional lookups without stopping local features.

Forget removes both key copies and aborts pending work; it does not revoke the key at VirusTotal. Changing/forgetting a key does not reset quota counters. The four anonymous quota numbers have no domain, URL, report or per-event log. They enforce spacing and a conservative UTC daily budget through worker suspension, rather than preserving browsing activity. VirusTotal's account-wide limits still apply across other clients or session restarts.

## Local data lifetimes

URL and site-setting results live in the popup. Page scans run once after a click and never read field values. Extension audit data exists only in its open view. Existing navigation/download features retain at most one sanitized current snapshot each in worker memory, with five-minute upper bounds and earlier worker/lifecycle cleanup. No domain, timestamp log, permission state, extension list, download list, finding or reputation response is written to any storage area.

Closing a view clears its displayed data and ignores late replies. A finite pending reputation request is aborted when its popup closes; a request already sent may have reached VirusTotal. There are no periodic tasks, automatic retries, reputation monitoring or hidden submissions.
