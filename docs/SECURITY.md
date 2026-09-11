# Security

## Authentication
- Better Auth with provider sign-in (Google, Apple, X). No custom password cryptography; the development e-mail login is compiled out in production.
- Sessions: 14-day expiry, cookie cache, secure cookies in production, "sign out everywhere" (`revokeSessions`).
- Account linking only for providers returning verified e-mails.

## Authorization
- `src/server/authz/policy.ts` resolves a viewer's relationship to an assignment (CUSTOMER, ORG_MEMBER with org role, PROFESSIONAL with contribution roles, PROSPECT, ADMIN_OBSERVER, ADMIN) and evaluates each action.
- Not-found and not-authorized are indistinguishable to prevent enumeration; public ids are random.
- Admins get metadata only; content requires a time-limited grant (audited).
- Billing members can pay but cannot see content.

## Input, output, uploads
- All action inputs validated with zod; sizes bounded.
- Uploads: purpose-based MIME allowlist, magic-byte sniffing, size limits (documents 25 MB, audio 200 MB), unpredictable storage keys, private storage only, downloads proxied through `/api/files/[id]` with authorization and `Content-Security-Policy: sandbox`.
- React escapes output; the embed route escapes manually and sets a strict CSP.

## Rate limiting
- Database-backed fixed windows (`rate_limit_bucket`) for messages, offers, invitations, uploads, versions, comments, assignment creation, public verification.
- Better Auth's own limiter covers auth endpoints.

## Headers
- HSTS, CSP, X-Content-Type-Options, X-Frame-Options (except the embed route which allows framing), Referrer-Policy, Permissions-Policy.

## Integrity
- Signed versions immutable (trigger). Ledger, audit, signatures and status history append-only (triggers). Check constraints on amounts and ratings.
- Idempotency keys on payments and ledger postings; webhooks verified by provider signature.

## Secrets and logging
- Secrets only in environment; validated at boot (`src/lib/config/env.ts`).
- Logger scrubs keys that look like content/tokens; audit metadata is filtered defensively. Content bodies, documents, tokens and signed URLs are never logged.
- IP addresses are stored only as salted hashes.

## Privacy
- Data classes separated in the schema (public profile, private account, verification documents with retention, customer work, financial, audit).
- Export and deletion workflows; deletion anonymizes personal data while retaining ledger/audit/provenance metadata.

## Dependency review
- Pinned major versions; lockfile committed. Review `pnpm audit` before releases.
