# Security policy

secmgr holds other people's secrets, so we treat every report as urgent.

## Reporting a vulnerability

Email **security@secmgr.xyz** with:

- what you found and where (file, endpoint or command),
- steps to reproduce it,
- the impact you expect.

Please do not open a public issue, pull request or discussion for a vulnerability.

We reply within 2 business days, confirm or rule out the issue within 7 days, and credit you in the release notes unless you ask us not to. We ask that you give us 90 days, or until a fix ships, before disclosing publicly.

## Scope

In scope: this repository, the hosted service at `secmgr.xyz` and `app.secmgr.xyz`, the `secmgr` CLI and the official Docker image.

Out of scope: denial of service by volume, social engineering, findings that need a compromised machine, and reports from automated scanners without a working proof.

## How secrets are protected

- Every value is encrypted with AES-256-GCM under a per-project data key before it reaches the database.
- Data keys are stored only in wrapped form. The master key that wraps them lives in a key management service, or in `SECMGR_MASTER_KEY` when you self-host, and never in the database.
- Each ciphertext is bound to its project, environment, key and version, so it cannot be moved to another row.
- Every read of a value, from the dashboard, the CLI or a token, is written to the audit log.
- Service tokens are stored as SHA-256 hashes and shown once.
