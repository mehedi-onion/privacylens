# Milestone 2 verification

Verified on October 6, 2026. Milestone 1's record is preserved below.

## Current checks

- `node --test`: **39 passed, 0 failed** (the 21 baseline tests plus 18 new permission/popup tests). All Chrome API calls in tests are mocked; no live networking occurs.
- Syntax checks pass for all shipped JavaScript, local reference lists, and tests.
- Manifest permissions are exactly `activeTab` and `contentSettings`; no host patterns, background worker, content scripts, or storage capabilities were introduced.
- The only new browser API usage is the six `chrome.contentSettings.<type>.get()` calls, with a sanitized current-site origin and the tab's incognito flag. Tests provide setter/clearer methods that fail if called; none were called.
- Source/data static checks find no network, persistence, analytics, unsafe HTML, logging, or secrets. The strict connection-blocking content security policy is unchanged.
- The popup clears URL and permission results on pagehide and prevents pending responses from repainting after closure. No domains, findings, states, timestamps, or history are persisted.
- Permission rules cannot cause High Attention. Camera alone stays Normal on a normal URL; camera, microphone, and location all Allowed can produce Review.

## Browser preview

The actual popup files and strict manifest policy were tested through a temporary loopback preview with mocked tab and content-setting APIs. The preview harness is outside the repository, is not shipped, and was stopped after testing.

Verified mixed Allowed/Blocked/Ask rows, camera-only Normal, all-three-sensitive Review, six Unavailable rows on unsupported input, explanation expansion/collapse using keyboard controls, and calm layout. A preview image is saved beside the project folder.

Actual unpacked installation, Chrome's new permission prompt, and readings after changing real site settings remain personal browser checks. The preview does not validate Chrome's real permission lifecycle or OS device access. Follow [the exact manual steps](manual-testing.md).

## Changes and Git

The repository still has no commits. Its files remain untracked, so ordinary `git diff` has no tracked baseline. A Milestone 1 file snapshot was saved before editing; the final comparison is generated using `git diff --no-index` between that snapshot and an equivalent current snapshot, excluding `.git` metadata. No commit, staging operation, or remote was added.

Suggested focused commit message:

```text
feat: add local site permission awareness
```

Milestone 2 stops at site-setting awareness. No Milestone 3 features were added.

---

## Milestone 1 verification (historical)

Verified on October 6, 2026.

## Automated checks

- `node --test`: **21 passed, 0 failed**, with no external dependencies or network calls.
- The analyzer covers all requested URL signals and brand-domain boundary cases, including Google and bKash examples.
- Popup integration tests verify the current-tab query, explanations, missing URLs, restricted schemes, rejected Chrome API calls, and replacement of previous findings.
- The manifest has exactly `activeTab`, Manifest V3, and valid popup file references. It declares no background worker, content scripts, host permissions, storage permissions, or extra capabilities.
- Source and local data inspection found no outgoing-request APIs, remote assets, persistence APIs, logging of URLs, analytics, secrets, or unsafe HTML rendering.
- Content security policy blocks connections with `connect-src 'none'` and allows scripts/styles only from the extension itself.
- JavaScript syntax and the package file structure were inspected.

## Browser preview checks

The actual popup files were served temporarily on loopback with the manifest's content security policy and a small **simulated Chrome tab API**. This development harness is outside the repository and is not part of the extension.

- Brave/Chromium rendered the bKash lookalike Review state and its expandable explanation.
- The in-app browser rendered Normal, Review, High Attention, and unsupported-address states after the module-loading fix.
- Findings displayed Detected, Why it matters, and Suggestion; the layout was inspected visually in dark mode.
- The strict policy initially blocked JSON module loads. Reference data now uses ordinary local JavaScript modules, avoiding any need to allow connections or add a build step.
- No suspicious domains were opened; all test addresses were passed as strings to the local analyzer.

The extension was **not installed in the user's browser profile** during this verification. Chrome's actual unpacked loading, toolbar access grant, popup sizing, and closing behavior still require the [personal browser checklist](manual-testing.md). The preview verifies rendering and module loading, not Chrome's permission lifecycle.

## Scope and limitations

This is a local URL-signal prototype. It makes no malware, confirmed phishing, or guaranteed-safety verdict. Its small reference lists and hostname heuristics are incomplete. No later-milestone features were added.

## First commit

The repository is initialized on `main`, with all project files untracked and no commit or remote added. Suggested first commit message:

```text
feat: build local-only PrivacyLens URL analysis prototype
```
