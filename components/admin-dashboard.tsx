"use client";
import KioskControls from "./kiosk-controls";
import GoogleDriveControls, { DriveRetry } from "./google-drive-controls";
import DriveHealthBanner from "./drive-health-banner";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  Camera as CameraIcon,
  LayoutGrid,
  Settings2,
  List,
  Monitor,
  Plus,
  CheckCircle2,
} from "lucide-react";
import type {
  AdminData,
  Camera,
  Court,
  Recorder,
  Device,
} from "@/lib/admin-types";
import RecorderControls from "./recorder-controls";
import { cameraOnline, recorderOnline } from "@/lib/recorder-status";

type Tab = "overview" | "courts" | "cameras" | "settings" | "logs";
function SaveForm({
  resource,
  children,
  convert,
  onSaved,
}: {
  resource: string;
  children: ReactNode;
  convert: (form: FormData) => object;
  onSaved?: (id?: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const router = useRouter();
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    setFailed(false);
    const body = convert(new FormData(e.currentTarget));
    try {
      const response = await fetch(`/api/admin/${resource}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok) {
        setMessage(result.error || "Unable to save.");
        setFailed(true);
      } else {
        setMessage("Saved successfully.");
        router.refresh();
        onSaved?.(typeof result.id === "string" ? result.id : undefined);
      }
    } catch {
      setMessage(
        "Could not reach the server. Your changes have not been saved.",
      );
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="stack-form" onSubmit={submit}>
      <fieldset disabled={busy}>{children}</fieldset>
      <div className="save-row">
        <button className="primary" disabled={busy}>
          {busy ? "Saving…" : "Save changes"}
        </button>
        {message && (
          <p
            role={failed ? "alert" : "status"}
            className={failed ? "form-error" : "save-success"}
          >
            {message}
          </p>
        )}
      </div>
    </form>
  );
}

function CourtForm({ court }: { court?: Court }) {
  return (
    <SaveForm
      resource="courts"
      convert={(f) => ({
        id: court?.id,
        name: f.get("name"),
        location: f.get("location"),
        active: f.has("active"),
      })}
    >
      <label>
        Court name
        <input
          name="name"
          defaultValue={court?.name}
          placeholder="Court 01"
          required
          maxLength={100}
        />
      </label>
      <label>
        Location or description
        <input
          name="location"
          defaultValue={court?.location}
          placeholder="Garden side"
          maxLength={150}
        />
      </label>
      <label className="check-label">
        <input
          name="active"
          type="checkbox"
          defaultChecked={court?.active ?? true}
        />{" "}
        Show this court to players
      </label>
      <p className="form-note">
        Deactivated courts stay in your logs and can be reactivated later.
      </p>
    </SaveForm>
  );
}

function CameraForm({
  camera,
  device,
  data,
  selectedRecorderId,
}: {
  camera?: Camera;
  device?: Device;
  data: AdminData;
  selectedRecorderId: string;
}) {
  const recorderId =
    camera?.recorder_id || device?.recorder_id || selectedRecorderId;
  const [sourceType, setSourceType] = useState(
    camera?.source_type || device?.source_type || "network",
  );
  const microphones = [
    ...new Map(
      data.devices
        .filter((d) => d.recorder_id === recorderId)
        .flatMap((d) => d.audio_sources || [])
        .map((m) => [m.device_reference, m]),
    ).values(),
  ];
  return (
    <SaveForm
      resource="cameras"
      convert={(f) => ({
        id: camera?.id,
        name: f.get("name"),
        recorder_id: f.get("recorder_id"),
        court_id: f.get("court_id"),
        source_type: f.get("source_type"),
        device_reference: f.get("device_reference"),
        audio_source: f.get("audio_source"),
        is_primary: f.has("is_primary"),
        enabled: f.has("enabled"),
      })}
    >
      <label>
        Camera name
        <input
          name="name"
          defaultValue={camera?.name || device?.name}
          required
          maxLength={100}
          placeholder="Garden court camera"
        />
      </label>
      <div className="form-columns">
        <label>
          Connection type
          <select
            name="source_type"
            onChange={(e) => setSourceType(e.target.value as "usb" | "network")}
            defaultValue={
              camera?.source_type || device?.source_type || "network"
            }
          >
            <option value="network">Wi-Fi / Ethernet</option>
            <option value="usb">USB camera</option>
          </select>
        </label>
        <input type="hidden" name="recorder_id" value={recorderId} />
      </div>
      <label>
        Local device reference
        <input
          name="device_reference"
          defaultValue={camera?.device_reference || device?.device_reference}
          required
          maxLength={120}
          pattern="[a-zA-Z0-9._:\-]+"
          placeholder="garden-camera-01"
        />
        <span className="form-note">
          A device identifier from the local service. Stream URLs and passwords
          stay on the venue computer.
        </span>
      </label>
      <label>
        Recording audio
        <select
          key={recorderId + sourceType}
          name="audio_source"
          defaultValue={camera?.audio_source || ""}
        >
          <option value="">Off — video only</option>
          {sourceType === "usb" &&
            camera?.audio_source.startsWith("mic-") &&
            !microphones.some(
              (m) => m.device_reference === camera.audio_source,
            ) && (
              <option value={camera.audio_source}>
                Configured microphone (rediscover to check availability)
              </option>
            )}
          {sourceType === "network" ? (
            <option value="stream">Camera stream microphone</option>
          ) : (
            microphones.map((m) => (
              <option key={m.device_reference} value={m.device_reference}>
                {m.name}
              </option>
            ))
          )}
        </select>
        <span className="form-note">
          Discover cameras to refresh microphones. Save, then Test connection to
          check video and selected audio. Players see when audio is enabled.
        </span>
      </label>
      <label>
        Assigned court
        <select name="court_id" defaultValue={camera?.court_id || ""}>
          <option value="">Unassigned</option>
          {data.courts.map((court) => (
            <option key={court.id} value={court.id}>
              {court.name}
              {court.active ? "" : " (inactive)"}
            </option>
          ))}
        </select>
      </label>
      <label className="check-label">
        <input
          type="checkbox"
          name="is_primary"
          defaultChecked={camera?.is_primary ?? false}
        />{" "}
        Primary recording camera for this court
      </label>
      <label className="check-label">
        <input
          type="checkbox"
          name="enabled"
          defaultChecked={camera?.enabled ?? true}
        />{" "}
        Enabled
      </label>
      <p className="form-note">
        One enabled primary camera per court. Unset the current primary before
        assigning another. Registration does not confirm camera connectivity.
      </p>
    </SaveForm>
  );
}

function RecorderForm({
  recorder,
  onSaved,
}: {
  recorder?: Recorder;
  onSaved?: (id?: string) => void;
}) {
  return (
    <SaveForm
      onSaved={onSaved}
      resource="recorders"
      convert={(f) => ({ id: recorder?.id, name: f.get("name") })}
    >
      <label>
        Computer name
        <input
          name="name"
          defaultValue={recorder?.name}
          required
          maxLength={100}
          placeholder="Venue front desk PC"
        />
      </label>
      <p className="form-note">
        Save this computer, then use its pairing code to connect the local
        service.
      </p>
    </SaveForm>
  );
}

export default function AdminDashboard({ data }: { data: AdminData }) {
  const [tab, setTab] = useState<Tab>("overview");
  const [courtId, setCourtId] = useState("");
  const [cameraId, setCameraId] = useState("");
  const [device, setDevice] = useState<Device>();
  const [recorderId, setRecorderId] = useState(
    () =>
      (
        data.recorders.find(recorderOnline) ||
        data.recorders.find((r) => r.paired_at) ||
        data.recorders[0]
      )?.id || "",
  );
  const [editingComputer, setEditingComputer] = useState(
    !data.recorders.length,
  );
  const selectedRecorder = data.recorders.find((r) => r.id === recorderId);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [date, setDate] = useState("");
  const router = useRouter();
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 10000);
    return () => clearInterval(timer);
  }, [router]);
  const zone = data.settings.venue_time_zone || "UTC";
  function timestamp(value: string) {
    return new Intl.DateTimeFormat("en", {
      timeZone: zone,
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  }
  function localDate(value: string) {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: zone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(value));
  }
  const filtered = data.sessions.filter(
    (session) =>
      (!status || session.status === status) &&
      (!date || localDate(session.created_at) === date) &&
      `${session.recipient_email} ${data.courts.find((c) => c.id === session.court_id)?.name || ""} ${session.id}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const nav = [
    { id: "overview", label: "Overview", icon: LayoutGrid },
    { id: "courts", label: "Courts", icon: LayoutGrid },
    { id: "cameras", label: "Camera setup", icon: CameraIcon },
    { id: "settings", label: "Settings", icon: Settings2 },
    { id: "logs", label: "Recording logs", icon: List },
  ] as const;
  return (
    <main className="shell admin-main">
      <div className="admin-title">
        <div>
          <div className="eyebrow">A LITTLE ORDER. MORE GOOD GAMES.</div>
          <h1>Your club, at a glance.</h1>
          <p>Manage the spaces and settings behind every match.</p>
        </div>
        <a className="sign-in" href="/">
          View player page →
        </a>
      </div>
      <DriveHealthBanner />
      <nav className="admin-tabs" aria-label="Admin sections">
        {nav.map((item) => (
          <button
            key={item.id}
            aria-current={tab === item.id ? "page" : undefined}
            onClick={() => setTab(item.id)}
          >
            <item.icon size={16} />
            {item.label}
          </button>
        ))}
      </nav>

      {tab === "overview" && (
        <>
          <div className="admin-stats">
            <article>
              <LayoutGrid size={22} />
              <strong>{data.courts.filter((c) => c.active).length}</strong>
              <span>Active courts</span>
            </article>
            <article>
              <CameraIcon size={22} />
              <strong>{data.cameras.length}</strong>
              <span>Registered cameras</span>
            </article>
            <article>
              <Monitor size={22} />
              <strong>{data.recorders.length}</strong>
              <span>Recorder entries</span>
            </article>
            <article>
              <CheckCircle2 size={22} />
              <strong>{data.sessions.length}</strong>
              <span>Recent sessions (up to 100)</span>
            </article>
          </div>
          <div className="admin-columns">
            <section className="admin-card">
              <div className="eyebrow">SETUP CHECKLIST</div>
              <h2>Ready for your next stage.</h2>
              <ul className="setup-list">
                <li>
                  <span>Player and admin accounts</span>
                  <b className="status-tag connected">Connected</b>
                </li>
                <li>
                  <span>Court configuration</span>
                  <b className="status-tag">
                    {data.courts.length ? "Configured" : "Add your first court"}
                  </b>
                </li>
                <li>
                  <span>Venue time zone</span>
                  <b className="status-tag">
                    {data.settings.venue_time_zone || "Needs configuration"}
                  </b>
                </li>
                <li>
                  <span>Local camera service</span>
                  <b className="status-tag">
                    {data.recorders.some((r) => recorderOnline(r))
                      ? "Connected"
                      : "Not connected"}
                  </b>
                </li>
                <li>
                  <span>Google Drive</span>
                  <button
                    className="sign-in"
                    onClick={() => setTab("settings")}
                  >
                    Manage connection
                  </button>
                </li>
              </ul>
              <p className="form-note">
                Completed matches upload to private Google Drive storage. Enable
                Gmail delivery in Settings to email playback links
                automatically.
              </p>
            </section>
            <section className="admin-card">
              <div className="eyebrow">RECENT ACTIVITY</div>
              <h2>Behind the scenes.</h2>
              {data.events.length ? (
                <ul className="activity-list">
                  {data.events.map((event) => (
                    <li key={event.id}>
                      <span>{event.action.replaceAll(".", " · ")}</span>
                      <time>{timestamp(event.created_at)}</time>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="form-note">
                  Court, camera, recorder, and settings changes will be logged
                  here.
                </p>
              )}
              <small>
                Times shown in {zone}
                {!data.settings.venue_time_zone && " (temporary fallback)"}.
              </small>
            </section>
          </div>
        </>
      )}

      {tab === "courts" && (
        <div className="admin-columns">
          <section className="admin-card">
            <div className="card-title">
              <h2>Your courts</h2>
              <button className="sign-in" onClick={() => setCourtId("")}>
                <Plus size={15} /> Add court
              </button>
            </div>
            {data.courts.length ? (
              <div className="admin-items">
                {data.courts.map((court) => (
                  <button
                    key={court.id}
                    aria-pressed={courtId === court.id}
                    onClick={() => setCourtId(court.id)}
                  >
                    <span>
                      <strong>{court.name}</strong>
                      <small>{court.location || "No location set"}</small>
                    </span>
                    <span className="status-tag">
                      {court.active ? "Active" : "Inactive"}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="form-note">
                No courts yet. Add your first court using the form.
              </p>
            )}
          </section>
          <section className="admin-card">
            <h2>{courtId ? "Edit court" : "A new place to play."}</h2>
            <CourtForm
              key={courtId}
              court={data.courts.find((c) => c.id === courtId)}
            />
          </section>
        </div>
      )}

      {tab === "cameras" && (
        <section className="admin-card camera-setup">
          <div className="card-title">
            <h2>Camera setup</h2>
            <Monitor size={24} />
          </div>
          <p className="form-note">
            Connect your venue computer, discover its cameras, then choose a
            court and microphone. One computer can manage multiple cameras.
          </p>
          <div className="camera-computer-bar">
            <label>
              Venue computer
              <select
                aria-label="Venue computer"
                value={recorderId}
                onChange={(e) => {
                  setRecorderId(e.target.value);
                  setCameraId("");
                  setDevice(undefined);
                  setEditingComputer(false);
                }}
              >
                <option value="" disabled>
                  {data.recorders.length
                    ? "Choose a computer"
                    : "Add your venue computer"}
                </option>
                {data.recorders.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} —{" "}
                    {recorderOnline(r)
                      ? "Connected"
                      : r.paired_at
                        ? "Offline"
                        : "Not paired"}
                  </option>
                ))}
              </select>
            </label>
            {selectedRecorder && (
              <button
                className="sign-in"
                onClick={() => setEditingComputer((v) => !v)}
              >
                {editingComputer ? "Close editor" : "Edit computer"}
              </button>
            )}
            <button
              className="sign-in"
              onClick={() => {
                setRecorderId("");
                setEditingComputer(true);
                setCameraId("");
                setDevice(undefined);
              }}
            >
              <Plus size={15} />
              Add computer
            </button>
          </div>
          {editingComputer && (
            <div className="camera-computer-form">
              <h3>
                {selectedRecorder
                  ? "Edit venue computer"
                  : "Connect a venue computer"}
              </h3>
              <RecorderForm
                key={recorderId || "new"}
                recorder={selectedRecorder}
                onSaved={(id) => {
                  if (id) setRecorderId(id);
                  setEditingComputer(false);
                }}
              />
            </div>
          )}
          {selectedRecorder && (
            <RecorderControls
              key={selectedRecorder.id}
              recorder={selectedRecorder}
              data={data}
              onRegister={(selected) => {
                setCameraId("");
                setDevice(selected);
                document
                  .getElementById("camera-form")
                  ?.scrollIntoView({ behavior: "smooth" });
              }}
            />
          )}
          <div className="camera-setup-columns">
            <section className="camera-setup-column">
              <div className="card-title">
                <h2>Cameras</h2>
                <button
                  className="sign-in"
                  onClick={() => {
                    setCameraId("");
                    setDevice(undefined);
                  }}
                >
                  <Plus size={15} /> Add camera
                </button>
              </div>
              <div className="admin-items">
                {data.cameras
                  .filter((c) => c.recorder_id === recorderId)
                  .map((camera) => (
                    <button
                      key={camera.id}
                      aria-pressed={cameraId === camera.id}
                      onClick={() => {
                        setCameraId(camera.id);
                        setDevice(undefined);
                      }}
                    >
                      <span>
                        <strong>{camera.name}</strong>
                        <small>
                          {data.courts.find((c) => c.id === camera.court_id)
                            ?.name || "Unassigned"}{" "}
                          · {camera.source_type === "usb" ? "USB" : "Network"}
                          {camera.is_primary ? " · Primary" : ""}
                        </small>
                      </span>
                      <span className="status-tag">
                        {!camera.enabled
                          ? "Disabled"
                          : cameraOnline(camera, data.recorders)
                            ? "Connection passed"
                            : "Test required"}
                      </span>
                    </button>
                  ))}
              </div>
              {!data.cameras.some((c) => c.recorder_id === recorderId) && (
                <p className="form-note">
                  No cameras assigned to this computer yet. Discover cameras
                  above to get started.
                </p>
              )}
            </section>
            <section className="camera-setup-column">
              <h2 id="camera-form">
                {cameraId ? "Edit camera" : "Register a camera"}
              </h2>
              {selectedRecorder ? (
                <CameraForm
                  key={cameraId || device?.id || recorderId}
                  device={device}
                  camera={data.cameras.find((c) => c.id === cameraId)}
                  data={data}
                  selectedRecorderId={recorderId}
                />
              ) : (
                <p className="form-note">
                  Connect a venue computer above before registering a camera.
                </p>
              )}
            </section>
          </div>
        </section>
      )}

      {tab === "settings" && <KioskControls />}
      {tab === "settings" && <GoogleDriveControls />}
      {tab === "settings" && (
        <section className="admin-card settings-card">
          <div className="eyebrow">YOUR VENUE, YOUR DEFAULTS</div>
          <h2>A little room to play.</h2>
          <SaveForm
            resource="settings"
            convert={(f) => ({
              duration_minutes: Number(f.get("duration_minutes")),
              retention_hours: Number(f.get("retention_hours")),
              venue_time_zone: f.get("venue_time_zone"),
            })}
          >
            <div className="form-columns">
              <label>
                Maximum recording duration (minutes)
                <input
                  type="number"
                  name="duration_minutes"
                  min={1}
                  max={120}
                  step={1}
                  defaultValue={data.settings.max_duration_seconds / 60}
                  required
                />
              </label>
              <label>
                Video retention after upload (hours)
                <input
                  type="number"
                  name="retention_hours"
                  min={1}
                  max={720}
                  step={1}
                  defaultValue={data.settings.retention_seconds / 3600}
                  required
                />
              </label>
            </div>
            <label>
              Venue time zone
              <input
                name="venue_time_zone"
                defaultValue={data.settings.venue_time_zone || ""}
                list="time-zones"
                placeholder="Choose your venue’s time zone"
                required
              />
              <datalist id="time-zones">
                <option value="Asia/Manila" />
                <option value="Asia/Taipei" />
                <option value="Asia/Singapore" />
                <option value="UTC" />
              </datalist>
            </label>
            <div className="admin-callout">
              <p>
                Duration changes apply to new sessions. Retention changes apply
                to newly uploaded videos. Existing recordings keep their saved
                limits and expiry.
              </p>
            </div>
            <label className="check-label">
              <input type="checkbox" required /> I confirm these settings for
              future recordings.
            </label>
          </SaveForm>
        </section>
      )}

      {tab === "logs" && (
        <section className="admin-card">
          <h2>Every match has a story.</h2>
          <p className="form-note">
            Latest 100 sessions, newest first. Times in {zone}.
          </p>
          <div className="log-filters">
            <label>
              Find a recording
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Player email, court, or session ID"
              />
            </label>
            <label>
              Status
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="">All statuses</option>
                {[
                  "requested",
                  "starting",
                  "recording",
                  "finalizing",
                  "local_ready",
                  "uploading",
                  "sharing",
                  "ready",
                  "failed",
                  "deleting",
                  "deleted",
                ].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label>
              Venue date
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>
          </div>
          {filtered.length ? (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Court</th>
                    <th>Player</th>
                    <th>Status</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((session) => (
                    <tr key={session.id}>
                      <td>{timestamp(session.created_at)}</td>
                      <td>
                        {data.courts.find((c) => c.id === session.court_id)
                          ?.name || "Unknown court"}
                      </td>
                      <td>{session.recipient_email}</td>
                      <td>
                        <span className="status-tag">
                          {session.status === "local_ready"
                            ? "Saved locally"
                            : session.status}
                        </span>
                      </td>
                      <td>
                        <details>
                          <summary>View</summary>
                          <p>ID: {session.id}</p>
                          <p>
                            Start:{" "}
                            {session.started_at
                              ? timestamp(session.started_at)
                              : "Not started"}
                          </p>
                          <p>
                            Stop:{" "}
                            {session.stopped_at
                              ? timestamp(session.stopped_at)
                              : "—"}
                          </p>
                          <p>Reason: {session.stop_reason || "—"}</p>
                          <p>Failure stage: {session.failure_stage || "—"}</p>
                          {(session.status === "local_ready" ||
                            ["upload", "sharing"].includes(
                              session.failure_stage || "",
                            )) && <DriveRetry sessionId={session.id} />}
                          {session.status === "ready" && (
                            <a
                              className="sign-in"
                              target="_blank"
                              rel="noopener noreferrer"
                              href={`/api/recordings/${session.id}/playback`}
                            >
                              View on Google Drive
                            </a>
                          )}
                          {session.status === "local_ready" && (
                            <p>
                              Video saved on the venue recorder in its protected
                              captures folder, under this session ID. Connect
                              Google Drive in Settings to upload it.
                            </p>
                          )}
                        </details>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-panel">
              <List size={26} />
              <h3>
                {data.sessions.length
                  ? "No matching recordings."
                  : "No recordings yet."}
              </h3>
              <p>
                {data.sessions.length
                  ? "Try another filter."
                  : "Session history will appear once the recording service is connected."}
              </p>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
