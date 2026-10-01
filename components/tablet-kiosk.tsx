"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Pointer, ChevronDown, Square } from "lucide-react";
import CourtArt from "./court-art";
type Court = {
  id: string;
  name: string;
  camera_status: string;
  audio_enabled: boolean;
};
type Session = {
  id: string;
  court_id: string;
  status: string;
  started_at: string | null;
  duration_seconds: number;
  stop_requested_at: string | null;
  email_status: string;
  failure_stage: string | null;
};
type State = {
  enabled: boolean;
  courts?: Court[];
  session?: Session | null;
  maxSeconds?: number;
};
const active = (s: Session) =>
  ["requested", "starting", "recording", "finalizing"].includes(s.status);
export default function TabletKiosk({
  preview = false,
}: {
  preview?: boolean;
}) {
  const [state, setState] = useState<State | null>(null),
    [screen, setScreen] = useState<"welcome" | "form" | "confirm">("welcome"),
    [court, setCourt] = useState(""),
    [email, setEmail] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [now, setNow] = useState(Date.now());
  const key = useRef(""),
    lastTouch = useRef(Date.now()),
    operation = useRef(false);
  const refresh = useCallback(async () => {
    if (preview) {
      setState({
        enabled: true,
        courts: [
          {
            id: "preview-court",
            name: "Court 1",
            camera_status: "online",
            audio_enabled: true,
          },
        ],
        maxSeconds: 900,
        session: null,
      });
      return;
    }
    try {
      const r = await fetch("/api/kiosk", { cache: "no-store" });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      setState(d);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Connection lost. Please retry.",
      );
    }
  }, [preview]);
  useEffect(() => {
    void refresh();
    const t = setInterval(() => {
      setNow(Date.now());
      if (!operation.current) void refresh();
    }, 2000);
    return () => clearInterval(t);
  }, [refresh]);
  function clearForm() {
    setEmail("");
    setCourt("");
    key.current = "";
    setScreen("welcome");
    setError("");
  }
  useEffect(() => {
    if (
      !state?.session &&
      screen !== "welcome" &&
      !busy &&
      now - lastTouch.current > 120000
    )
      clearForm();
  }, [now, state?.session, screen, busy]);
  async function action(action: string) {
    if (preview) {
      setError("Design preview only. Use the enabled venue tablet to record.");
      return;
    }
    if (operation.current) return;
    operation.current = true;
    setBusy(true);
    setError("");
    try {
      if (action === "start" && !key.current) key.current = crypto.randomUUID();
      const r = await fetch("/api/kiosk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          key: key.current,
          court_id: court,
          email,
          id: state?.session?.id,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      if (action === "reset") {
        setState((s) => (s ? { ...s, session: null } : s));
        clearForm();
      } else if (action === "start") {
        setState((s) =>
          s
            ? {
                ...s,
                session: {
                  id: d.id,
                  court_id: court,
                  status: "requested",
                  started_at: null,
                  duration_seconds: s.maxSeconds || 900,
                  stop_requested_at: null,
                  email_status: "pending",
                  failure_stage: null,
                },
              }
            : s,
        );
        setEmail("");
        setScreen("welcome");
      }
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please retry.");
    } finally {
      operation.current = false;
      setBusy(false);
    }
  }
  const session = state?.session,
    selected = state?.courts?.find((c) => c.id === court),
    minutes = Math.round((state?.maxSeconds || 900) / 60);
  useEffect(() => {
    if (!session || active(session)) return;
    const t = setTimeout(() => void action("reset"), 45000);
    return () => clearTimeout(t);
  }, [session?.id, session?.status]);
  const elapsed = session?.started_at
    ? Math.max(0, Math.floor((now - Date.parse(session.started_at)) / 1000))
    : 0;
  const remaining = Math.max(0, (session?.duration_seconds || 900) - elapsed);
  const clock = `${Math.floor(remaining / 60)
    .toString()
    .padStart(2, "0")}:${(remaining % 60).toString().padStart(2, "0")}`;
  return (
    <main
      className={`tablet${!session && screen === "welcome" ? " tablet--welcome" : ""}`}
      onPointerDown={() => (lastTouch.current = Date.now())}
      onKeyDown={() => (lastTouch.current = Date.now())}
    >
      {preview && (
        <span className="tablet-preview-label">
          Design preview · Recording disabled
        </span>
      )}
      <header className="tablet-header">
        <div className="tablet-brand">
          <img src="/casa-batik-logo.jpg" alt="Casa Batik" />
          <div>
            <strong>CASA BATIK</strong>
            <span>THE COURT CLUB</span>
          </div>
        </div>
        {!session && screen !== "welcome" && (
          <button
            className="tablet-back"
            onClick={() => {
              if (screen === "confirm") setScreen("form");
              else clearForm();
            }}
          >
            <ArrowLeft />
            Back
          </button>
        )}
      </header>
      {!session && screen === "welcome" && (
        <button
          className="tablet-welcome"
          aria-label="Tap to start recording your match"
          onClick={() => {
            setScreen("form");
            setError("");
            lastTouch.current = Date.now();
          }}
        >
          <div className="tablet-hero">
            <div className="tablet-copy">
              <p className="tablet-eyebrow">
                <i />
                GOOD GAMES DESERVE A REPLAY
              </p>
              <h1>
                Your court.
                <br />
                Your <em>moment.</em>
              </h1>
              <p className="tablet-tagline">
                The rallies. The close calls. That winning shot.
                <br />
                Record your match and take a little of the court home.
              </p>
            </div>
            <div className="tablet-art">
              <div className="tablet-orbit" />
              <CourtArt />
            </div>
          </div>
          <div className="tablet-tap">
            <div className="tap-hand">
              <span />
              <Pointer strokeWidth={1.7} />
            </div>
            <span>Tap to start</span>
          </div>
          <p className="tablet-powered">
            Powered by <strong>WrenLabs</strong>
          </p>
        </button>
      )}
      {!session && screen === "form" && (
        <section className="tablet-form-screen">
          <h1>Record your match</h1>
          <p className="tablet-subtitle">
            Choose your court and enter your email to get started.
          </p>
          {!state ? (
            <p role="status">Connecting to the venue…</p>
          ) : !state.enabled ? (
            <div className="tablet-setup">
              <p>
                This tablet needs a one-time setup by the venue administrator.
              </p>
              <a href="/admin">Open admin setup</a>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (selected?.camera_status === "online") setScreen("confirm");
              }}
            >
              <label htmlFor="court">Choose your court</label>
              <div className="tablet-select">
                <select
                  id="court"
                  required
                  value={court}
                  onChange={(e) => setCourt(e.target.value)}
                >
                  <option value="" disabled>
                    Select your court
                  </option>
                  {state.courts?.map((c) => (
                    <option
                      key={c.id}
                      value={c.id}
                      disabled={c.camera_status !== "online"}
                    >
                      {c.name}
                      {c.camera_status !== "online"
                        ? ` — ${c.camera_status === "busy" ? "Recording" : "Offline"}`
                        : ""}
                    </option>
                  ))}
                </select>
                <ChevronDown />
              </div>
              <label htmlFor="guest-email">Email address</label>
              <input
                id="guest-email"
                type="email"
                inputMode="email"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                maxLength={254}
                placeholder="player@gmail.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <button
                className="tablet-record"
                disabled={
                  busy ||
                  !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
                  selected?.camera_status !== "online"
                }
              >
                <i />
                <span>
                  Start
                  <br />
                  Recording
                </span>
              </button>
              <p className="tablet-helper">
                Select a court and enter a valid email to enable recording.
                <br />
                Recording limit: {minutes} minutes
              </p>
            </form>
          )}
        </section>
      )}
      {!session && screen === "confirm" && (
        <section className="tablet-session">
          <p className="tablet-eyebrow">ONE LAST CHECK</p>
          <h1>Ready to play?</h1>
          <p className="tablet-subtitle">
            {selected?.name} · Up to {minutes} minutes
          </p>
          <p>Your replay link will be emailed to</p>
          <strong className="tablet-recipient">{email}</strong>
          <p>Please check the address. No account is needed.</p>
          <p>
            Anyone holding the emailed link can watch your video.
            <br />
            {selected?.audio_enabled
              ? "Video and microphone audio will be recorded."
              : "This court records video without audio."}
          </p>
          <button
            className="tablet-solid"
            disabled={busy}
            onClick={() => void action("start")}
          >
            {busy ? "Starting…" : "Confirm & start recording"}
          </button>
          <button
            className="tablet-text"
            disabled={busy}
            onClick={() => setScreen("form")}
          >
            Edit details
          </button>
        </section>
      )}
      {session && (
        <section className="tablet-session" aria-live="polite">
          <p className="tablet-eyebrow">
            {state?.courts?.find((c) => c.id === session.court_id)?.name ||
              "YOUR MATCH"}
          </p>
          <h1>
            {["deleted", "deleting"].includes(session.status)
              ? "This replay has expired."
              : session.status === "recording"
                ? "Stay in the game."
                : session.status === "requested" ||
                    session.status === "starting"
                  ? "Getting ready…"
                  : session.status === "failed"
                    ? "Your recording needs help."
                    : session.status === "ready"
                      ? "Your replay is ready."
                      : active(session)
                        ? "Saving your match…"
                        : "Your match is saved."}
          </h1>
          {session.status === "recording" ? (
            <>
              <p className="tablet-countdown">{clock}</p>
              <p>Time remaining · Recording continues if this page closes.</p>
            </>
          ) : (
            <p className="tablet-subtitle">
              {["deleted", "deleting"].includes(session.status)
                ? "The retention period has ended. You can start a new match."
                : session.status === "ready"
                  ? session.email_status === "sent"
                    ? "Your replay link has been sent. Check your inbox."
                    : session.email_status === "failed" ||
                        session.email_status === "unknown"
                      ? "Email delivery needs attention. Please ask the administrator."
                      : "Preparing your email…"
                  : session.status === "failed"
                    ? "Please ask the venue administrator to check this session."
                    : active(session)
                      ? "Please wait while the venue recorder responds."
                      : "We’ll email your replay once the upload is complete."}
            </p>
          )}
          {active(session) ? (
            <button
              className="tablet-solid"
              disabled={busy || !!session.stop_requested_at}
              onClick={() => void action("stop")}
            >
              <Square size={18} />
              {session.stop_requested_at ? "Stopping…" : "Stop recording"}
            </button>
          ) : (
            <button
              className="tablet-solid"
              disabled={busy}
              onClick={() => void action("reset")}
            >
              Done · Back to welcome
            </button>
          )}
        </section>
      )}
      {error && (
        <div className="tablet-error" role="alert">
          {error}
          <button
            onClick={() => {
              setError("");
              void refresh();
            }}
          >
            Retry connection
          </button>
        </div>
      )}
    </main>
  );
}
