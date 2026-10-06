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
10. On `chrome://extensions`, check PrivacyLens for errors. Right-click the popup → Inspect and look for script/API errors. In its Network panel, only local extension resources should load, with no extension-initiated HTTP(S) requests. Storage must contain no scan records. Verify the manifest has only `activeTab` and `contentSettings`, no host patterns or background worker.
11. Test keyboard expansion, long hostnames, system light/dark mode, and scrolling. Chrome limits popup height, so expanded explanations must remain reachable by scrolling.

If a Chromium derivative reports a row as Unavailable, compare against its own site-settings page and read [platform limits](platform-limits.md). An Allowed setting describes the browser's content setting, not current feature use or a guarantee that device access succeeds. Temporary one-time grants and embedded-frame settings may not be fully represented.

## URL regression checks

Open `https://google.com` and `https://accounts.google.com`: no Google brand mismatch. HTTPS explanation must not guarantee trust. HTTP alone on a public test page means Review, not malware. Local HTTP/custom ports get development context. Close/reopen on another tab to refresh.

Do not visit lookalike domains merely to test warnings. Use the offline suite for synthetic lookalike, IP, punycode, shortener, malformed-address, and sensitive-word examples.
