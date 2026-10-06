# Personal Chrome checks — Milestone 3

These real Chrome checks remain necessary; offline mocks and a layout preview cannot verify your installed extensions or Chrome's permission prompt. No third-party extension needs to be installed just for testing.

1. Pull `origin/main` normally if testing in a different checkout. Open `chrome://extensions` and Reload PrivacyLens, or Load unpacked this folder if new. Confirm version 0.3.0.
2. Accept the new **management** permission if Chrome prompts. Chrome may describe managing apps, extensions, and themes. PrivacyLens uses the API read-only.
3. Open the PrivacyLens popup and click **Review browser extensions**. Confirm a separate audit tab opens.
4. Confirm installed browser extensions appear. PrivacyLens itself, apps, and themes should be omitted; the summary explains this. Review counts include disabled extensions.
5. Expand a simple extension, if you have one. Compare its name, state, API permissions, type, and version with **Details** in `chrome://extensions`. Storage/notifications/bookmarks alone should remain Normal.
6. Expand an extension with broad website access, if available. Expect Review, a visible broad-host reason, and a host-pattern explanation. Read **Why this label** and the API explanations. Every label should have an understandable reason; no misuse accusation should appear.
7. Compare displayed host access and Chrome-generated warnings with the permissions/site-access information in `chrome://extensions` → Details. Warning wording can be localized or grouped and may differ from that UI. The API may not reveal a complete original manifest, optional declarations, or every site-access control. Empty/unavailable warnings must be explained honestly.
8. Manually disable one optional extension using Chrome's own control. Avoid disabling a tool you currently need. PrivacyLens itself must stay enabled.
9. Close the audit and reopen it from the popup, or click **Read again**. The changed extension must say Disabled, with its capability label still shown and a note that this does not imply activity. Restore its prior enabled state manually in Chrome.
10. Verify the audit offers only search, label filters, **Read again**, and explanation expansion. It must have no disable, uninstall, launch, settings-change, or permission-change control.
11. Try each filter and a name search. Then close/reopen or reload the audit. Search/filter state must reset and a fresh read must replace the results. No audit-history UI or saved inventory may appear. Closing only the popup leaves the separate audit open until you close that tab.
12. Check PrivacyLens in `chrome://extensions` for errors. In the audit's DevTools, inspect Network and Application/Storage: only bundled local resources should load, with no outgoing HTTP(S) requests or saved audit records. Check keyboard expansion, light/dark mode, a narrow window, and long names. Reopen the site popup to confirm URL findings and the six site settings still work.

If the API or warnings are unavailable in your browser, expect a clear message rather than invented data. Follow [platform limits](platform-limits.md). Permissions describe capability, not proof of behavior.

---

# Personal Chrome checks — Milestone 2

Use a recent desktop Chrome/Chromium release (extension minimum: Chrome 88). These steps test actual browser permissions, which offline mocks cannot verify. No camera recording, location request, notification subscription, or file download is needed.

1. Open `chrome://extensions`, enable Developer mode, and Load unpacked this `privacylens` folder. If already loaded, click Reload and handle Chrome's added `contentSettings` permission prompt if shown. Pin the toolbar icon.
2. Visit a normal HTTPS site such as `https://example.com`. Open PrivacyLens. Expect the existing URL findings plus Camera, Microphone, Location, Notifications, Pop-ups, and Automatic downloads. Expand a row and read all five explanation parts.
3. Close PrivacyLens. Click the site-information icon beside the address → **Site settings**. Set **Camera = Block**, **Location = Block**, and **Notifications = Block**. Return to the original website tab (not the settings tab), reload the site if Chrome requests it, and reopen PrivacyLens. All three should say Blocked.
4. In the same site's settings, set **Camera = Allow**, keeping Microphone and Location blocked. Return and reopen PrivacyLens. Camera should say Allowed. On this normal HTTPS URL, camera alone must not change Normal to High Attention or claim misuse.
5. Set **Location = Allow** and **Notifications = Allow**, then return and reopen. Their rows should update to Allowed. Notifications alone should not cause High Attention. Keep Microphone blocked for this step.
6. Set Camera, Microphone, and Location all to **Allow** for this test site. Return and reopen. Expect **Review**, a separate permission note asking whether you still need these features, and unchanged URL findings. No spying or confirmed-phishing accusation should appear. Restore your preferred site settings after this test.
7. For Camera/Location/Notifications, select **Ask** or **Ask (default)** if offered, or reset that individual override to the browser's current default. Return and reopen. Compare with Chrome's effective default: Ask if the default is Ask, Blocked if the default is Blocked. PrivacyLens must not guess an extra Default state. Do not change global defaults just to run this test.
8. Compare **Pop-ups and redirects** set to Allow then Block: PrivacyLens should show Allowed then Blocked. Chrome's extension API has no Ask state for this setting. Compare **Automatic downloads** set to Ask, Allow, and Block. No download needs to be started; the row reads the multiple-files setting only.
9. Try a restricted page such as `chrome://extensions` or a file page. Expect URL assessment unavailable and six Unavailable permission rows. Return to the normal website, close/reopen, and confirm the new scan replaces the old one. There must be no scan-history UI.
10. On `chrome://extensions`, check PrivacyLens for errors. Right-click the popup → Inspect and look for script/API errors. In its Network panel, only local extension resources should load, with no extension-initiated HTTP(S) requests. Storage must contain no scan records. Verify the manifest has exactly `activeTab`, `contentSettings`, and `management`, no host patterns or background worker.
11. Test keyboard expansion, long hostnames, system light/dark mode, and scrolling. Chrome limits popup height, so expanded explanations must remain reachable by scrolling.

If a Chromium derivative reports a row as Unavailable, compare against its own site-settings page and read [platform limits](platform-limits.md). An Allowed setting describes the browser's content setting, not current feature use or a guarantee that device access succeeds. Temporary one-time grants and embedded-frame settings may not be fully represented.

## URL regression checks

Open `https://google.com` and `https://accounts.google.com`: no Google brand mismatch. HTTPS explanation must not guarantee trust. HTTP alone on a public test page means Review, not malware. Local HTTP/custom ports get development context. Close/reopen on another tab to refresh.

Do not visit lookalike domains merely to test warnings. Use the offline suite for synthetic lookalike, IP, punycode, shortener, malformed-address, and sensitive-word examples.
