# Casa Batik match recording

Second milestone: Supabase accounts, protected admin configuration, and database-backed player courts. The original interactive design preview remains at `/preview`.

## Run

Requires Node.js 20.9+ and npm.

```sh
npm install
npm run dev
```

Open http://localhost:3000. Sign in at `/login` or `/admin/login`. `/preview` needs no credentials and is explicitly simulated.

```sh
npm run typecheck
npm run build
npm test
```

## Current behavior

- Real Supabase email/password sign-in and logout; server-managed HttpOnly cookies, token refresh, and server-side user verification.
- Every admin mutation validates the request origin, signed-in account, active profile, database role and input; database RLS also restricts access.
- Admin overview, court creation/editing/deactivation, recorder entries, dynamic network/USB camera assignments and primary-camera configuration.
- Duration/retention/time-zone settings, recent activity, and latest 100 recording sessions with email/court/status/date filters.
- Signed-in players see active courts from the database, their verified recipient email, saved limits, and their own session history.
- Camera entries remain **not connected**. No capture, Drive upload or mail delivery is implemented in this milestone. Hardware health is not editable by an admin browser.
- `/preview` retains the original simulation, isolated from live data and clearly labeled.

The supplied original logo is preserved in `public/casa-batik-logo.jpg`. Court artwork is an original SVG illustration. Fonts use Google Fonts with local system fallbacks.

## Foundation and configuration

Copy `.env.example` to `.env.local` and enter credentials locally. No secrets are committed. Rotate previously exposed credentials before configuring live services.

The application uses Supabase's HTTPS API; direct PostgreSQL access is only needed for migrations. Set `MIGRATION_DATABASE_URL` to the session pooler URI (port 5432) from your project's Connect panel, replacing the password placeholder without brackets. Download the server CA certificate from Supabase Database Settings and set `DATABASE_CA_CERT_PATH` to its local path. TLS certificate verification stays enabled. The transaction pooler `DATABASE_URL` is reserved for future direct server queries.

```sh
npm run db:migrate
npm run account:create -- owner@example.com admin "Venue owner"
npm run account:create -- player@example.com player "Test player"
```

The migration runner records checksums and applies each new file in a transaction. Never edit already applied migrations. It refuses modified checksums and serializes concurrent runs.

Account provisioning is a trusted local operation for explicitly confirmed owner/test emails. It auto-confirms seeded emails without sending mail, assigns the requested role server-side, and generates a random password in a git-ignored `.local/account-<id>.json` file. It does not reset existing users' passwords. Deliver these credentials privately; no public signup or email-based password reset UI is included yet. The owner must supply the lasting admin/test-player identities. Passwords and tokens must never enter Git.

Browser clients cannot set roles or hardware health. Camera records hold only local device identifiers; stream URLs and passwords stay on the local service. Do not put credentials in recording snapshots or audit details. The Supabase server secret is only needed by provisioning and verification scripts in this stage, not the application routes.

## Verification

`npm test` runs validation tests and both SQL migrations in an isolated PostgreSQL engine (PGlite), verifying RLS, role escalation prevention, session isolation, limits and camera constraints. The test bootstrap models Supabase auth roles; production checks also run against the configured Supabase project.

With the local web app running, explicitly run this integration check:

```sh
node --env-file=.env.local scripts/test-live.mjs
```

It creates three temporary test identities and its own court/recorder/camera/session fixtures, verifies live login, cookies, roles, CRUD, isolation and logout, then removes its fixtures. It sends no emails, opens no cameras, and does not change venue settings. Do not use it as a load test. Check its cleanup result if it fails.

## Agreed next stages

1. Provision the owner's confirmed admin and two player accounts; configure the actual courts and venue time zone.
2. Pair a local recorder to discover supported network/USB cameras; keep camera credentials on the recorder.
3. Implement durable capture jobs, explicit transitions, recovery, per-camera locking and server-side time limits.
4. Authorize the owner Google account; use Picker for the existing Drive folder with drive.file; request gmail.send. Implement private sharing, resumable uploads, delivery retries and retention cleanup.
5. Verify with actual hardware and two player identities, then deploy the web app to Vercel.

Default duration is 900 seconds and retention is 86400 seconds after successful upload. Venue time zone, recorder OS and camera model remain unconfirmed. The local recorder must run independently of the player's browser; Vercel hosts the control app, not the local camera connection.
