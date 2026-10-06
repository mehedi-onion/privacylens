# Explainable Milestone 1 rules

The URL parser normalizes case, Unicode domains, numeric IP formats, and default ports. A final hostname dot is removed before comparisons. Only HTTP and HTTPS URLs are assessed. Unsupported pages and malformed inputs receive “Review” with an explicit statement that no website assessment was made.

| Signal | Exact rule | Finding priority |
| --- | --- | --- |
| HTTPS | Scheme is `https` | Information; not a trust or certificate check |
| HTTP | Scheme is `http` | Review for public addresses; information for internal addresses |
| Raw IP | Parsed hostname is IPv4 or bracketed IPv6 | Review if public; information if internal |
| Internal | See internal rules below | Information, not a safety assurance |
| Long hostname | More than 60 hostname characters, excluding IPs | Review |
| Hostname depth | More than 5 dot-separated labels, excluding IPs | Review |
| Port | Parsed URL has an explicit port different from its scheme's default | Review if public; information if internal |
| Username/@ | Parsed credentials, or @ in the original HTTP(S) authority | Review; do not show credentials |
| Punycode | Any hostname label starts with `xn--` | Review; international names can be legitimate |
| Shortener | Exact local shortener domain or its dot-boundary subdomain | Review; no redirect resolution |
| Brand reference | Case-insensitive brand name as a whole dot/hyphen-delimited hostname token, with no official-domain match | Review, never confirmed phishing |
| Sensitive words | Whole alphabetic tokens in decoded hostname, path, or query | Information alone |

Sensitive words: login, verify, account, secure, payment, wallet, otp, password, update, recovery. URL fragments and credentials are not searched for these words. Query text is examined only in memory; only matched words are returned. Invalid percent encoding falls back to the undecoded text.

Official domains match exactly or through a dot boundary: `accounts.google.com` matches `google.com`; `google.com.example.org` does not. `notgoogle.com` does not match the Google brand token. There is no fuzzy matching or visual Unicode lookalike detection beyond a punycode notice. The rule does not detect joined names such as `bkashlogin.example`.

Internal handling recognizes single-label names; `localhost`, `.localhost`, `.local`, `.internal`; IPv4 0/8, 10/8, 127/8, 169.254/16, 172.16/12, 192.168/16 and shared address space 100.64/10; IPv6 unspecified/loopback, fc00/7 and fe80/10; and IPv4-mapped IPv6 for those ranges. No DNS lookup is made. A hostname could resolve to a private IP without being recognized here. Other special-use or reserved ranges are not classified exhaustively. Internal names are not automatically trusted. HTTP and custom ports on them are informational; brand mismatches and other review rules still apply.

The risk model returns High Attention only for a non-internal HTTP address with sensitive words, user information, or a brand mismatch. Otherwise any review finding gives Review; all-information findings give Normal. Adding arbitrary warning counts never produces a fake score or malicious verdict.

## Local reference dataset

The first list contains one representative official domain for each brand, rather than all domains or regional alternatives. An unlisted legitimate brand domain may therefore receive a review signal. Keep the explanation and verify additions from the brand's own site.

Official website references checked on October 6, 2026:

- [Google](https://www.google.com/) — `google.com`; its sign-in link uses `accounts.google.com`.
- [Microsoft](https://www.microsoft.com/) — `microsoft.com`.
- [Facebook](https://www.facebook.com/) — `facebook.com`.
- [PayPal](https://www.paypal.com/) — `paypal.com`.
- [bKash](https://www.bkash.com/en) — `bkash.com`.
- [Nagad](https://www.nagad.com.bd/) — `nagad.com.bd`.

The shortener list is also a representative list, not a live reputation service. No dataset is updated remotely. Links in this documentation are references for humans; extension code never opens them.

## Milestone 2 overall status

The rules above still produce the URL-only status. Permission advice is shown separately below URL findings. Camera, microphone, and location all Allowed can add Review to an otherwise Normal URL result. Camera alone, notifications alone, or camera plus microphone do not escalate status. Permission states never produce High Attention or establish feature use or intent. Missing permission data is shown as Unavailable without manufacturing a risk finding. See [platform limits](platform-limits.md).
