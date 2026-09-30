# Casa Batik match recording

Fourth milestone: player start/stop recording, durable capture jobs, local MP4 saving and recorder recovery. The original interactive design preview remains at `/preview`.

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
- One-time recorder pairing, scoped revocable machine tokens, heartbeats, ONVIF network discovery, Windows USB discovery, and single-frame connection tests. Hardware health is not editable by an admin browser.
- Players select an available court and start/stop its primary camera. Session settings are snapshotted at Start; the local worker enforces the duration even without a browser or cloud connection. Only the owner or an administrator can request Stop.
- Successful clips are marked **Saved locally**, not Ready for delivery. Drive upload, playback links and mail delivery remain the next stage.
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

Browser clients cannot set roles or hardware health. Camera records hold only local device identifiers; stream URLs and passwords stay on the local service. Do not put credentials in recording snapshots or audit details. `SUPABASE_SECRET_KEY` is now required in the web server environment for the protected recorder APIs. Never expose it through a `NEXT_PUBLIC_` variable or install it on the recorder.

## Local recorder setup (Windows)

The venue PC must stay awake, have Node.js and this repository installed, and share a reachable network with the cameras. USB/integrated cameras connect to this PC, not the player's phone. Vercel hosts only the control app. The recorder makes outbound HTTPS requests; no inbound port forwarding is needed.

1. Run `npm install` and `npm run recorder -- doctor` on the venue PC. FFmpeg is bundled by the dependency installer.
2. In Admin → Cameras & recorders, add a recorder and select it. Click **Get pairing code**.
3. From the project directory run `npm run recorder -- pair`. Enter the app origin (locally `http://127.0.0.1:3000`; later your Vercel HTTPS origin), then the one-time code. Codes expire in ten minutes. Redeeming a new code revokes the prior machine token.
4. Run `npm run recorder -- start` and leave it running. The dashboard refreshes every ten seconds. A recorder becomes offline after 45 seconds without a heartbeat.
5. Click **Discover cameras**. USB cameras and ONVIF cameras advertising on the local network appear under the selected recorder. Discovery does not open a video feed. ONVIF must be enabled on the camera; guest Wi-Fi isolation, VLAN separation, firewalls and proprietary cloud-only cameras may prevent discovery.
6. For network credentials, stop the recorder with Ctrl+C, run `npm run recorder -- configure DEVICE_REFERENCE`, and answer the prompts locally. For a camera that cannot be discovered, omit the reference and enter its RTSP URL. Restart the service and discover again. `npm run recorder -- discover` can also enumerate devices locally before pairing.
7. Click **Assign to court**, choose the court, enable its primary camera, and save. Then **Test connection**. This opens the feed briefly, decodes one video frame, and discards it; no clip, image or audio is saved or uploaded. A passing result is valid for five minutes and only while the recorder is connected. Retest after registration or a device change.

The service currently supports Windows USB via DirectShow and ONVIF/RTSP network cameras. The number of cameras is configurable; each discovery is capped at 64 devices to bound payloads. Network credentials and the scoped machine token live in `.local/recorder/config.json`, protected with Windows account ACLs and excluded from Git. Do not copy this file into cloud hosting. Stop the service before local configuration changes. `CASA_RECORDER_HOME` can specify a different protected local directory.

For a hidden background process, after pairing run `powershell -File recorder/start-hidden.ps1` from the project directory. It writes local service logs and runs until the process is stopped or the user signs out. This build does not install an automatic boot service. For visible operation use `npm run recorder -- start` and Ctrl+C. **Revoke pairing** immediately denies subsequent recorder API requests; an already-running capture worker will still enforce its local duration limit. Re-pair the same recorder to reconcile its saved results.

Discovery/test commands use 90-second leases, at most three attempts, and a ten-minute queue lifetime. Completion is checkpointed locally and retried after network failures; stale lease completions are rejected. Discovery results alone never establish healthy cameras. Diagnostic checks are deferred while that recorder has pending/active captures.

## Test a match recording

1. Run migrations and restart the local recorder after updating the code. Its dashboard version should be `0.3.0`.
2. Ensure the court has an enabled primary camera. Run **Test connection** if its health check is older than five minutes.
3. Sign in as the demo player, select **Court 1**, then click **Start recording**. Wait for **Recording** before playing.
4. Click **Stop recording**. The UI will show **Saved locally** when finalization is confirmed. Closing/reloading the browser does not stop capture; reopening the page restores the active session.
5. On the recorder PC, open `.local/recorder/captures/<session-id>/video.mp4` to play the clip. The admin Recording logs show the session ID. Local files are private and are not served by the web app. Google Drive viewing/email will be implemented next.

The first capture profile is video-only H.264 MP4 at up to 1280 pixels wide and 30 fps. No microphone audio is captured. Fragmented MP4 preserves recoverable fragments during interruptions ([FFmpeg documentation](https://www.ffmpeg.org/ffmpeg-formats.html)). Default duration stays 15 minutes. The hardware check and recording cannot run on the same recorder concurrently; other apps holding the webcam may prevent capture.

Capture admission is transactional, with one active session per court, one per player, and one per device. Repeating a start idempotency key returns the original session. Start is limited to five new sessions per player per minute. Pending requests older than 60 seconds are failed when the recorder reconnects. Capture workers run independently of the control process, persist their result before reporting, and are never automatically relaunched for an existing session. A controller restart reconciles them using the existing session identity. Internet outages delay Stop delivery, but FFmpeg's duration limit and the worker's wall-clock limit continue locally.

An active capture lock is deliberately not released merely because its heartbeat expires: the camera could still be recording offline. After a worker crash, reconnecting the controller marks the session interrupted once its configured deadline plus a recovery allowance has passed and both the worker and its FFmpeg child are no longer running. An ambiguous or still-running orphan process keeps the court locked for administrator investigation. Valid partial files stay local for administrator review. Keep the PC awake and restart the recorder after OS restarts; automatic boot/service installation is not included. Low disk space rejects new captures or stops an ongoing one. Local clips are retained until the future upload/cleanup stage; the 24-hour Drive retention clock has not started for these files.

## Verification

`npm test` runs validation, hardware-parser and SQL migration tests in an isolated PostgreSQL engine (PGlite), including pairing expiry/replay, command leases, recorder isolation, health expiry, roles, session isolation and camera constraints. The test bootstrap models Supabase auth roles; production checks also run against the configured Supabase project.

With the local web app running, explicitly run this integration check:

```sh
node --env-file=.env.local scripts/test-live.mjs
```

It creates three temporary test identities and its own court/recorder/camera/session fixtures, verifies live login, cookies, roles, CRUD, isolation, recorder pairing/commands/revocation and logout, then removes its fixtures. Camera results are explicitly simulated protocol fixtures. It sends no emails, opens no cameras, and does not change venue settings. Do not use it as a load test. Check its cleanup result if it fails.

`node --env-file=.env.local scripts/test-recorder-agent.mjs` additionally launches the actual local service with a disposable recorder and verifies pairing, heartbeats, discovery and result delivery. It enumerates devices on the local computer/network but never opens a feed. It cleans up its own cloud records and temporary configuration directory. Run it only on the intended test computer.

`node --env-file=.env.local scripts/test-capture-live.mjs <local-player-credentials.json> "Court 1"` explicitly records from that configured court, tests idempotency and a second player's isolation, restarts the control process during capture, stops and fully decodes the MP4. It keeps the recording under the supplied player's account and removes its temporary second player. Run only when recording from that camera is intended. Unit tests use generated test patterns for accelerated automatic-stop and early-source-failure checks; no camera is opened by `npm test`.

## Agreed next stages

1. Authorize the owner Google account; use Picker for the existing Drive folder with drive.file; request gmail.send. Implement private sharing, resumable uploads, delivery retries and retention cleanup.
2. Verify the complete workflow with actual venue hardware and two player identities, then deploy the web app to Vercel.

Default duration is 900 seconds and retention is 86400 seconds after successful upload. Venue time zone and final camera hardware remain unconfirmed. Windows is the first supported recorder OS. The local recorder runs independently of the player's browser.
