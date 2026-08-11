# Security Policy

## Project status

io2p is at an **early stage**. This is the web application users interact with; it holds session
tokens in the browser and talks to `io2p-core` on the user's behalf. Its interface and APIs are
still evolving between releases.

An independent security audit has not been carried out yet. Until it has, we would rather hear
about a problem early than late, which is what the rest of this document is for.

## Supported versions

| Version        | Supported                  |
| -------------- | -------------------------- |
| Latest release | ✅ Security fixes provided |
| Anything older | ❌ Please upgrade first    |

We provide security fixes for the most recent release. If you are on an older version, reproduce the
issue on the latest one where you can — if you cannot upgrade, report it anyway and say so.

## Reporting a vulnerability

**Please do not open a public issue for a security problem.** A public report tells everyone,
including whoever would exploit it, before there is a fix to upgrade to.

Two private channels, in order of preference:

1. **GitHub private vulnerability reporting** — [open a draft advisory][advisory]. This is the
   preferred route: it is private, it gives us a private fork to develop and test the fix in, and it
   handles CVE issuance and coordinated publication.
2. **Email `info@maeconomy.org`** — if you do not have a GitHub account or prefer email. Please put
   `security` in the subject line.

[advisory]: https://github.com/maeconomy-org/io2p-ui/security/advisories/new

### What to include

The more of this you can provide, the faster we can confirm and fix:

- What the issue is and what an attacker could achieve with it
- Steps to reproduce, ideally a minimal proof of concept
- The affected version or commit
- Any relevant configuration, logs, or requests — with secrets redacted

### What to expect from us

- **Acknowledgement within 3 business days** that we received your report.
- An initial assessment — whether we can reproduce it, and our view of the severity — within
  10 business days.
- Progress updates as we work on a fix, and notice before we publish anything.
- **Credit in the advisory**, unless you would rather stay anonymous. Just tell us which.

We are a small team. If you have not heard back within the acknowledgement window, please send a
follow-up rather than assuming the report was ignored — it more likely means it went astray.

## Scope

**In scope:** the code in this repository — session and token handling in the browser, the
application's own `/api/*` routes and their rate limiting, file upload and download paths, and
anything permitting XSS, CSRF, or credential leakage.

**Out of scope:**

- **Third-party dependencies.** Report those to the upstream project. If a dependency issue is
  reachable through this project in a way upstream would not consider a vulnerability, that part is
  in scope and we want to hear about it.
- **Server-side authorisation.** What a user is allowed to read or write is enforced by
  `io2p-core` — report that there.
- **Any deployed instance we do not operate.** This is self-hosted software; a specific deployment
  belongs to whoever runs it.
- Findings from automated scanners with no demonstrated impact, missing hardening headers with no
  exploit path, and reports that require an already-compromised host or physical access.

## Safe harbour

We will not pursue or support legal action against anyone who reports a vulnerability in good faith
and follows this policy. Specifically, if you:

- report privately through one of the channels above and give us reasonable time to respond,
- act only against your own instance or test data — not other people's,
- do not access, modify, or destroy data that is not yours,
- do not degrade the availability of any service, and
- do not publicly disclose before we have had a chance to release a fix,

then we consider your research authorised, and we will say so if anyone asks.

If you are unsure whether something you want to test falls inside these lines, ask us first at
`info@maeconomy.org`. We would much rather answer the question than have you not look.

## The rest of the project

io2p spans several repositories. This policy applies to `io2p-ui`; the same policy and the same
contact apply across all of them, and the human-readable version lives at
<https://io2p.org/security>.
