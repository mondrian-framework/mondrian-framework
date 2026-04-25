# Security Policy

The Mondrian Framework team takes security seriously. We appreciate responsible disclosure of vulnerabilities and will work with you to verify and address them quickly.

## Supported versions

Security fixes are issued for the latest minor version on the `0.x` line. Older minors do not receive backports.

| Version | Supported          |
| ------- | ------------------ |
| latest  | :white_check_mark: |
| < latest minor | :x:         |

## Reporting a vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

To report a vulnerability:

1. Open a [private security advisory](https://github.com/mondrian-framework/mondrian-framework/security/advisories/new) on GitHub. This is the preferred channel.
2. If you cannot use GitHub Security Advisories, contact the maintainers directly via the email listed on the [organization profile](https://github.com/mondrian-framework).

Please include:

- A description of the vulnerability and its impact
- Steps to reproduce, ideally a minimal proof of concept
- Affected package(s) and version(s)
- Any mitigations you are aware of

## What to expect

- We will acknowledge your report within **3 business days**.
- We will provide an initial assessment (severity, planned fix timeline) within **10 business days**.
- We will keep you informed throughout the remediation process.
- Once a fix is released we will publish a [GitHub Security Advisory](https://github.com/mondrian-framework/mondrian-framework/security/advisories) crediting the reporter (unless you prefer to remain anonymous).

## Scope

In scope:

- Issues in any package published under `@mondrian-framework/*`
- Issues in the example app that demonstrate a real risk in framework usage (rather than the example's own setup)
- Issues in the documentation site (`packages/docs/`) that could mislead users into insecure configurations

Out of scope:

- Vulnerabilities in third-party dependencies — please report those upstream. If a transitive dependency is exploitable through a Mondrian API in a way that would not be obvious to a user, that *is* in scope.
- Findings from automated scanners without a demonstrated impact
- Social-engineering or physical attacks
- Denial of service that requires unbounded computational resources but is not enabled by a framework default

## Hardening recommendations

When deploying applications built with Mondrian, please:

- Set `maxSelectionDepth` on your modules in production (default is unlimited; recommend 3–10) to mitigate selection-set abuse on GraphQL/retrieve.
- Always declare security `policies(...)` for entities exposed via `retrieve` — the example in `packages/example/src/core/security-policies.ts` is the canonical reference.
- Use `model.<type>().sensitive()` for fields like passwords or tokens so they are excluded from logs and traces by default.
- Configure rate limiting (`@mondrian-framework/rate-limiter`) on public endpoints.
- Validate and constrain `take` / `skip` to reasonable maxima (the entity-level `retrieve` constraints exist for this).

Thank you for helping keep Mondrian Framework and its users safe.
