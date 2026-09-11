# HumanAuth (internal codename)

Verified human authorship, review and expert sign-off platform. A marketplace and trust infrastructure where identifiable, verified professionals write, review, fact-check and sign the exact version a customer publishes — producing a permanent, opaque-id authorship record.

The public brand name, domain and logo are configured through environment variables (`NEXT_PUBLIC_BRAND_NAME`, `RECORD_ID_PREFIX`, …); see `src/lib/config/brand.ts`.

## Stack

- Next.js 15 (App Router, Server Actions, Node runtime) — Vercel-first
- PostgreSQL (Neon-compatible) with Drizzle ORM and SQL migrations
- Better Auth (Google, Apple, X; account linking; dev-only e-mail login)
- Tailwind CSS 4
- Resend (e-mail), Twilio (SMS), Vercel Blob / Postgres / local disk (private file storage), Stripe or manual (payments), OpenAI-compatible AI Gateway (optional)
- Vitest

## Quick start

```bash
cp .env.example .env            # edit DATABASE_URL and BETTER_AUTH_SECRET
pnpm install
pnpm db:migrate                 # applies ./drizzle/*.sql
SEED_DEMO=true pnpm db:seed     # reference data + demo users (dev login only)
pnpm dev
```

Demo accounts (when `AUTH_DEV_LOGIN=true` and `SEED_DEMO=true`, password `humanauth-demo`):
`admin@example.com` (super admin), `customer@example.com`, `eva@example.com` (verified Swedish editor), `johan@example.com` (automotive technician), `anna@example.com` (copywriter).

`pnpm db:seed` without `SEED_DEMO` is idempotent and safe in production: it upserts languages, service categories and the domain taxonomy.

## Scripts

| Script | Purpose |
| --- | --- |
| `pnpm dev` / `pnpm build` / `pnpm start` | Next.js |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm test` | Vitest unit tests (state machine, hashing, ledger, policy, authz) |
| `pnpm db:generate` | Generate a migration from schema changes |
| `pnpm db:migrate` | Apply migrations |
| `pnpm db:seed` | Seed reference data (+ demo with `SEED_DEMO=true`) |

## Deploying to Vercel

1. Create a Neon (or other Postgres) database; set `DATABASE_URL` (pooled URL).
2. Set `BETTER_AUTH_SECRET`, `APP_URL`, `BETTER_AUTH_URL`, provider credentials (`GOOGLE_*`, `APPLE_*`, `X_*`).
3. Set `EMAIL_PROVIDER=resend` + `RESEND_API_KEY`, `STORAGE_PROVIDER=vercel-blob` + `BLOB_READ_WRITE_TOKEN`, `PAYMENT_PROVIDER=stripe` + `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` (webhook URL: `/api/webhooks/payments`).
4. Run `pnpm db:migrate && pnpm db:seed` against the production database (once per release with schema changes).
5. Set `BOOTSTRAP_ADMIN_EMAILS` to promote the first administrator on sign-in.
6. Leave `AUTH_DEV_LOGIN` unset in production (it is hard-disabled for production builds regardless).

## Documentation

- `docs/ARCHITECTURE.md` — layers, domain model, workflow, confidentiality, AI policy, hashing
- `docs/SECURITY.md` — authorization model, threat considerations, operational controls
- `docs/DATA-MODEL.md` — entity overview and retention classes
