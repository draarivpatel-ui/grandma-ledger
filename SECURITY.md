# Security policy

## Reporting a vulnerability

Use the private GitHub Security Advisory form at [Report a vulnerability](https://github.com/draarivpatel-ui/grandma-ledger/security/advisories/new). Do not open a public issue, pull request or discussion with exploit details.

Never include a live secret, token, cookie, private key, victim hostname or proprietary payload in a report. Use synthetic values and redacted transcripts.

## Supported versions

| Version | Status |
| --- | --- |
| latest `main` | Supported |

Security fixes are applied to the latest state of the default branch.

## Scope

This policy covers the static Two-Crayon Kitchen and Bill Book browser application and its Node tests, including recipe scaling, pan conversion, bill splitting, care-card state, share links, saved-copy behavior, generated print output and digest or verification logic.

In scope:

- A cross-site scripting or HTML injection path through recipe text, ingredient names, household labels, care items, shared state or rendered output.
- A share-link decoder, serialization or validation flaw that bypasses bounds, corrupts another saved state or executes attacker-controlled code.
- A service worker or cache flaw that causes attacker-controlled content to be served as this application.
- A generated text, JSON, print or export flaw that makes generated output execute a formula or script when opened.
- A checksum, digest or determinism verification bypass that makes altered output validate as untampered.

Out of scope:

- Browser vulnerabilities, operating system compromise or physical access to the machine.
- Damage caused by modified copies of the static application that do not come from this repository.
- Cooking, household or care decisions without a security impact.
- Denial of service that only affects the attacker's own browser tab.

## Coordinated disclosure

- Acknowledgment: within 3 business days.
- Initial triage: within 14 calendar days.
- Fix or mitigation target: within 90 calendar days for confirmed reports.
- Coordinated public disclosure: up to 90 days by default, adjusted by mutual agreement when exploitation or user risk requires a different date.
