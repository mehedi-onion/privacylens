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
