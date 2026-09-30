# Casa Batik match recording

First review milestone: responsive player interface and Supabase schema groundwork.

## Run

Requires Node.js 20.9+ and npm.

```sh
npm install
npm run dev
```

Open http://localhost:3000. No credentials are required for the preview.

```sh
npm run typecheck
npm run build
```

## Current behavior

Three explicitly labeled sample courts; two are selectable and one is busy. The recording preview runs an elapsed timer, stops manually or at 15 minutes, simulates processing, and shows a sample email state. No camera is opened, video created, email sent, or Drive link fabricated. Sign-in opens an explanation rather than collecting credentials.

The supplied original logo is preserved in `public/casa-batik-logo.jpg`. Court artwork is an original SVG illustration. Fonts use Google Fonts with local system fallbacks.

## Foundation and configuration

Copy `.env.example` to `.env.local` and enter credentials locally. No secrets are committed. Rotate previously exposed credentials before configuring live services.

The SQL migration under `supabase/migrations` defines the initial schema, RLS and a unique active-capture constraint. It has **not been applied or verified against a live database**. Supabase Auth is proposed for account identity; account provisioning, server session verification, login UI, job queues and integration routes remain for the functional stage. Never put camera secrets in player-readable configuration snapshots.

## Agreed next stages

1. Owner reviews the player interface.
2. Complete Supabase authentication, account provisioning and admin screens.
3. Pair a local recorder to discover supported network/USB cameras; keep camera credentials on the recorder.
4. Implement durable capture jobs, explicit transitions, recovery, per-camera locking and server-side time limits.
5. Authorize owner Google account; use Picker for the existing Drive folder with drive.file; request gmail.send. Implement private sharing, resumable uploads, delivery retries and retention cleanup.
6. Verify with actual hardware and two player identities, then deploy the web app to Vercel.

Default duration is 900 seconds and retention is 86400 seconds after successful upload. Venue time zone, recorder OS and camera model remain unconfirmed. The local recorder must run independently of the player's browser; Vercel hosts the control app, not the local camera connection.
