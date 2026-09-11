# Architecture

## Principles

PRIVATE BY DEFAULT · PUBLIC BY EXPLICIT INTENT · AI PROCESSING BY POLICY · ACCESS BY AUTHORIZATION · ATTRIBUTION BY CONSENT · SIGNATURE BY DELIBERATE HUMAN ACTION

## Layers

```
src/app                 Next.js routes (public, app, admin, api)
src/components          UI (server components by default, small client islands)
src/server/actions      Server Actions: validate input (zod) → authorize → call domain service
src/server/authz        Central authorization (USER + ORG + ASSIGNMENT + ROLE + RESOURCE + ACTION)
src/server/domain       Domain services (assignments, artifacts, signing, professionals, matching, reviews, admin, privacy…)
src/server/finance      Payment/payout/invoice provider interfaces, append-only ledger
src/server/ai           The only AI entry point; policy gate + usage events; gateway client
src/server/email|sms    Adapters (Resend / console, Twilio / noop) + templates
src/server/storage      Private storage providers (database, local disk, Vercel Blob) + upload validation
src/server/notifications Unified in-app/e-mail/SMS notification model with preferences
src/server/audit        Append-only audit log
src/server/db           Drizzle schema, client, migrations, seed
```

Rules:
- UI never calls providers directly. Every mutation is a server action → domain service.
- No component may reach the AI gateway; only `src/server/ai/service.ts` may import `gateway.ts`.
- Client-supplied role, price, payment state or verification state is never trusted; all are re-derived server-side.

## Workflow state machine

`src/server/domain/assignments/state-machine.ts` defines the allowed transitions and which actor (CUSTOMER, PROFESSIONAL, ADMIN, SYSTEM) may perform each. `transitionAssignment()` locks the row, validates, updates, appends `assignment_status_history`, writes an audit event and a system message.

## Versioning and hashing

Every delivery inserts a new `artifact_version` (never updates). The content hash is `sha256(canonical text + sorted file hashes)` where canonical text = NFC normalization, CRLF→LF, trailing whitespace per line stripped, trailing newlines stripped (`src/lib/hash.ts`). Signing sets `immutable = true`; a database trigger (`drizzle/0001_integrity.sql`) rejects any later change to content, hash, number or immutability. Ledger, audit, signature and status-history tables are append-only by trigger.

## Signing ceremony

`signVersion()` re-authorizes, requires the professional's confidentiality agreement, recomputes the hash and refuses on mismatch, requires the latest submitted version, snapshots verification status and verified credentials/expertise, stores the signature (session id, hashed IP, user agent, confirmation statement), freezes the version, updates contributions, creates the authorship record (visibility PRIVATE) and moves the assignment to SIGNED.

## Provenance

`contribution` rows record every role on an assignment (KNOWLEDGE_SOURCE, AUTHOR, EDITOR, LANGUAGE_REVIEWER, DOMAIN_REVIEWER, FACT_CHECKER, TRANSLATOR, TRANSLATION_REVIEWER, FINAL_APPROVER). They are created from workflow events (offer accepted, knowledge source declared, signature), never typed in as marketing claims. The public record lists the signer and other signed/completed contributions the customer allowed.

## Dual competence model

Language competence (`professional_language`: level + editorial capability) and domain expertise (`expertise_claim` on a hierarchical, database-driven `domain` taxonomy) are separate. Assignments carry `required_language_level`, `editorial_required`, `domain_id`, `domain_requirement` (NOT_REQUIRED / PREFERRED / REQUIRED / VERIFIED_REQUIRED) and `knowledge_source_type`. `matchProfessionals()` scores both dimensions; when the customer supplies the knowledge, domain expertise contributes nothing, so a founder-to-writer brief is matched with language professionals rather than expensive experts. Offers can specify a `contribution_role`, enabling a second professional (e.g. a domain reviewer) on the same assignment (Mode B). Domain review is a standalone template with explicit verdicts (CORRECT … RECOMMENDED_CHANGE) on inline comments.

## Confidentiality and AI policy

`assignment.confidentiality` (STANDARD / PRIVATE / CONFIDENTIAL / STRICT_CONFIDENTIAL; default PRIVATE) and `assignment.ai_policy` (AI_DISABLED / AI_METADATA_ONLY / AI_ALLOWED) are enforced in `src/server/ai/policy.ts`. STRICT_CONFIDENTIAL cannot enable AI_ALLOWED, gets shortened file retention, super-admin-only content grants and additional warnings. Records for CONFIDENTIAL+ assignments can only be ANONYMIZED (no title, hash, customer or URL).

## Administration vs content access

`platform_role` grants administration (users, verification, disputes, settings). Assignment content requires an `admin_action` of type `ADMIN_CONTENT_ACCESS` with a reason and expiry (default 60 min), which is audited and surfaced as a system message in the assignment.

## Money

Integer minor units with explicit currency. `ledger_entry` is append-only and idempotent by key; balances are sums. Capture → escrow; completion → platform fee + professional earning; refund; payout. Provider interfaces: `PaymentProvider`, `PayoutProvider`, `InvoiceProvider` (`src/server/finance/providers`). The Stripe adapter uses Checkout Sessions and signed webhooks; the manual adapter supports off-platform settlement.

## Renaming

`src/lib/config/brand.ts` and `NEXT_PUBLIC_BRAND_NAME` / `RECORD_ID_PREFIX` control naming. No feature code hard-codes the product name.
