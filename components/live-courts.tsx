import type { Account } from "@/lib/auth";
import { serverSupabase } from "@/lib/supabase-server";
import { Clock3, Film, Mail, Video } from "lucide-react";

export default async function LiveCourts({
  account,
  problem,
}: {
  account: Account | null;
  problem?: string;
}) {
  if (!account)
    return (
      <div className="empty-panel">
        <Video size={28} />
        <h3>Your court is waiting.</h3>
        <p>
          {problem ||
            "Sign in with your player account to view the venue’s courts."}
        </p>
        <a className="primary" href="/login">
          Sign in to choose a court →
        </a>
        <a className="auth-switch" href="/preview">
          Explore the interface preview
        </a>
      </div>
    );
  const db = await serverSupabase();
  const [courts, settings, sessions] = await Promise.all([
    db.rpc("player_court_status"),
    db
      .from("venue_settings")
      .select("max_duration_seconds,retention_seconds")
      .eq("id", true)
      .single(),
    db
      .from("recording_sessions")
      .select("id,status,created_at")
      .eq("player_id", account.id)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);
  if (courts.error || settings.error || sessions.error)
    return (
      <div className="empty-panel">
        <h3>Court information is unavailable.</h3>
        <p>
          The venue’s database setup may still be in progress. Please try again
          shortly.
        </p>
        <a href="/" className="primary">
          Reload courts
        </a>
      </div>
    );
  return (
    <>
      <div className="record-grid">
        <div>
          <div className="subheading">
            <h3>Your venue’s courts</h3>
            <span>{courts.data.length} active courts</span>
          </div>
          <div className="court-list">
            {courts.data.length ? (
              courts.data.map(
                (court: {
                  id: string;
                  name: string;
                  location: string;
                  camera_status: string;
                }) => (
                  <article className="court-card" key={court.id}>
                    <div className="court-thumb">
                      <Video size={27} />
                    </div>
                    <div className="court-info">
                      <h4>{court.name}</h4>
                      <p>{court.location || "Casa Batik"}</p>
                      <div className="camera-label">
                        {court.camera_status === "online"
                          ? "Camera connection checked"
                          : "Camera not connected"}
                      </div>
                    </div>
                    <span className="status-tag">
                      {court.camera_status === "online"
                        ? "Connected"
                        : "Offline"}
                    </span>
                  </article>
                ),
              )
            ) : (
              <div className="empty-panel">
                <h3>No courts configured yet.</h3>
                <p>The venue administrator will add courts here.</p>
              </div>
            )}
          </div>
          <p className="form-note">
            Camera connections can now be checked. Match recording is coming in
            the next stage.
          </p>
        </div>
        <aside className="session-panel">
          <div className="eyebrow">YOUR NEXT RECORDING</div>
          <h2>Stay in the game.</h2>
          <div className="session-facts">
            <div>
              <Clock3 size={17} />
              <span>Recording limit</span>
              <strong>{settings.data.max_duration_seconds / 60} minutes</strong>
            </div>
            <div>
              <Film size={17} />
              <span>Available after upload</span>
              <strong>{settings.data.retention_seconds / 3600} hours</strong>
            </div>
          </div>
          <div className="recipient">
            <Mail size={17} />
            <div>
              <span>Your verified recipient</span>
              <strong>{account.email}</strong>
            </div>
          </div>
          <button className="primary record-button" disabled>
            Recording not available yet
          </button>
          <p className="form-note">
            No match is being recorded. Recording controls are not enabled yet.
          </p>
        </aside>
      </div>
      <div className="session-history">
        <h3>Your recent sessions</h3>
        {sessions.data.length ? (
          <ul>
            {sessions.data.map((session) => (
              <li key={session.id}>
                <span>{session.status}</span>
                <time>
                  {new Date(session.created_at).toISOString().slice(0, 10)}
                </time>
              </li>
            ))}
          </ul>
        ) : (
          <p className="form-note">
            Your completed and attempted recordings will appear here.
          </p>
        )}
      </div>
    </>
  );
}
