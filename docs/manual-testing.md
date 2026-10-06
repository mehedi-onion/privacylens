# Manual browser checklist

Use an isolated desktop Chrome/Chromium profile and harmless pages/files. Do not enter real credentials into fixtures, download malware or bypass browser warnings. Record browser/OS versions and any gaps. The completed [real Chromium validation](real-browser-validation.md) and [cleanup review](product-cleanup.md) distinguish real API checks from mocked visual examples.

## Load and inspect

1. Open `chrome://extensions` (`brave://extensions` in Brave), enable Developer mode and load this folder unpacked. Reload after updates.
2. Confirm version 0.8.0, the eye/lens toolbar icon, and no manifest or background-process errors. Existing permissions remain activeTab, contentSettings, management, scripting, downloads, webNavigation and storage; only VirusTotal host access is optional.
3. Pin PrivacyLens. On a normal HTTPS page, open the popup. Check the logo, domain, Normal summary and six compact rows. The default view should fit an ordinary popup. Expand Website for the connection and address explanations.
4. Check Review and High Attention using harmless local/mock examples, not a deceptive public website. Confirm calm wording and a reason/suggestion for each warning. A single password field or redirect must not create High Attention.
5. Check an unsupported page such as `chrome://extensions`. Unavailable must not be presented as a successful check.

## Local fixtures

From this repository, run:

```sh
python3 -m http.server 8767 --bind 127.0.0.1
```

This serves test pages only; PrivacyLens has no backend. Stop it afterward.

- `http://127.0.0.1:8767/docs/fixtures/page-scan.html`
- `http://127.0.0.1:8767/docs/fixtures/downloads.html`
- `http://127.0.0.1:8767/docs/fixtures/navigation-direct.html`
- `http://127.0.0.1:8767/docs/fixtures/navigation-client.html`

## Site permissions

1. On a test site, compare Camera, Microphone, Location and Notifications with Chrome's site settings. Expand **More permissions** for Pop-ups and Automatic downloads.
2. Change camera/location/notifications between Block, Ask/default and Allow; return to the website tab and reopen PrivacyLens. The effective state should match. Chrome does not identify default versus site-specific choices through this read API.
3. Camera alone must remain conservative. Camera + microphone + location all Allowed should produce Review and an explanation, without a claim that access is being used.
4. Restore the test site's settings when done.

## Page scan

1. Expand Page. It should be Not checked until **Scan this page** is clicked.
2. Scan a normal page and a normal same-origin login form. Routine password/login facts belong under **Other page details**, not among warnings.
3. Scan the bundled page fixture. Check cross-origin form destinations and misleading link text. Warnings should appear before routine facts. **Scan coverage** retains the snapshot limits.
4. Use only a synthetic marker if typing into the fixture. Confirm no input value or password appears in the UI or console. Automated throwing-getter tests separately guard against value reads.
5. Close/reopen the popup: old page results must be gone. Page results have their own label; they do not silently change the overall address status.

## Navigation

1. Visit the direct fixture in the focused active tab and open PrivacyLens promptly. If observed, expect **No redirect reported**. Missing/expired data says **No recent redirect info**, not proof that no redirect happened.
2. Follow the direct fixture's directory-redirect link: Python adds the trailing slash with a 301 response. Expect a server redirect.
3. Visit the client fixture and let its refresh return to the direct page. Expect a client redirect. Try Back/Forward and inspect the details when reported.
4. A normal redirect alone stays Normal. Switch tabs/windows and confirm stale data becomes unavailable. No redirect-chain or navigation-history list should exist.
5. Separately check a public HTTP→HTTPS upgrade in Google Chrome; browser upgrades/HSTS can affect what is reported.

## Download

1. Use the harmless download fixture to download its PDF. Open PrivacyLens promptly. Inspect the filename, Chrome warning and source.
2. Download its plain text file named `invoice.pdf.exe`. Do not open it. Expect Review for the name/type, not a malware verdict. Size/type are under **File details**.
3. Check again, then allow expiry or reload the extension. Only one temporary record may appear; there is no history or open/delete/cancel control. PrivacyLens never reads the payload.

## Installed extensions

1. Open **Review browser extensions**. Inspect a simple extension, a broad-access extension and one disabled manually in Chrome.
2. Compare names, enabled state, permissions and warnings with `chrome://extensions`. PrivacyLens is excluded from scoring; apps/themes are omitted.
3. Check search and all status filters. **Why this status**, **Permissions and Chrome warnings** and **Extension details** retain the explanations, exact permissions and technical fields.
4. Close/reopen: the inventory is read again, with no audit history. PrivacyLens has no disable/uninstall controls.

## Optional VirusTotal

1. With no key, local checks must still work. Open settings: it should show the key field, Remember, Save, Forget and the key-use link. No key is prefilled.
2. Enter a fresh key yourself, without copying it to chat or logs. Save with Remember unchecked. Saving must make no external request. Optionally test Remember, then reload and verify the stored mode without revealing the key.
3. Expand Reputation and click **Check with VirusTotal**. Confirm the selected hostname and sharing notice appear first. Cancel: no lookup should occur.
4. Confirm a known public domain only when you accept sharing. If Brave closes the popup during the optional host grant, reopen and confirm again. No automatic retry should occur.
5. In Network, inspect the endpoint only: `https://www.virustotal.com/api/v3/domains/{hostname}`. A page's path/query/fragment must be absent. Do not export headers/HAR files containing the key.
6. Check the four vendor counts and expandable explanation. The Privacy row must name VirusTotal and the hostname after sharing; a clean report must not remove local findings.
7. Use a synthetic invalid key to check the error display. Mock tests cover 403/404/429/server failures; do not exhaust quotas just to test them.
8. Close/reopen: the report must be gone. Forget removes local/session key copies without resetting anonymous quota counters. Finish by forgetting any test key and reloading the extension.

## Accessibility, transparency and privacy

1. Use Tab, Enter and Space for links, buttons and native disclosures. Check visible focus and textual statuses in light/dark mode. A full VoiceOver pass remains a separate manual task.
2. Open About & privacy. Check all seven permissions, optional VirusTotal access, nine data-boundary rows, key handling and limitations. Follow the settings key-use link to its section.
3. Inspect popup/background Console: no errors or raw secrets. Inspect Network before and after consent: bundled assets and only explicitly requested VirusTotal calls; no analytics or other endpoints.
4. Inspect storage by slot names without displaying secrets. Expected: optional `privacyLensVtKey` in session or explicitly chosen local storage, and `privacyLensVtQuota` in session. No sync writes, domains, reports, page contents, inventories, downloads or browsing history.
5. Close/reopen the popup, switch tabs, reload pages and let the background process stop where practical. No scan-history UI or stale result should return.
6. Repeat in Google Chrome and after a full browser restart before claiming those cases tested. Restore test settings, forget keys, stop the fixture server and close temporary preview tabs.
