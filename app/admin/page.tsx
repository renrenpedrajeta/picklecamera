import { redirect } from "next/navigation";
import { getAccount } from "@/lib/auth";
import { serverSupabase } from "@/lib/supabase-server";
import AdminDashboard from "@/components/admin-dashboard";
import AccountControls from "@/components/account-controls";
import type { AdminData } from "@/lib/admin-types";

export default async function AdminPage() {
  const { account } = await getAccount();
  if (!account) redirect("/admin/login");
  if (account.role !== "admin")
    return (
      <main className="auth-page">
        <section className="auth-card">
          <h1>Administrator access required.</h1>
          <p>Your player account does not have access to venue settings.</p>
          <a href="/" className="primary">
            Back to your courts
          </a>
        </section>
      </main>
    );
  const db = await serverSupabase();
  const [courts, cameras, recorders, settings, sessions, events] =
    await Promise.all([
      db.from("courts").select("id,name,location,active").order("created_at"),
      db
        .from("cameras")
        .select(
          "id,name,recorder_id,court_id,source_type,device_reference,is_primary,enabled,health",
        )
        .order("name"),
      db.from("recorders").select("id,name,last_seen_at").order("created_at"),
      db
        .from("venue_settings")
        .select("max_duration_seconds,retention_seconds,venue_time_zone")
        .eq("id", true)
        .single(),
      db
        .from("recording_sessions")
        .select(
          "id,court_id,status,recipient_email,created_at,started_at,stopped_at,stop_reason,failure_stage",
        )
        .order("created_at", { ascending: false })
        .limit(100),
      db
        .from("audit_events")
        .select("id,action,created_at")
        .order("created_at", { ascending: false })
        .limit(20),
    ]);
  const failed = [courts, cameras, recorders, settings, sessions, events].some(
    (result) => result.error,
  );
  return (
    <>
      <header className="site-header shell">
        <a href="/" className="brand">
          <img src="/casa-batik-logo.jpg" alt="Casa Batik" />
          <span>
            CASA BATIK<small>VENUE MANAGEMENT</small>
          </span>
        </a>
        <AccountControls account={account} />
      </header>
      {failed ? (
        <main className="shell admin-main">
          <div className="empty-panel">
            <h2>Database setup needs attention.</h2>
            <p>
              The admin tables could not be loaded. Apply the project
              migrations, then reload this page.
            </p>
            <a className="primary" href="/admin">
              Reload dashboard
            </a>
          </div>
        </main>
      ) : (
        <AdminDashboard
          data={
            {
              courts: courts.data,
              cameras: cameras.data,
              recorders: recorders.data,
              settings: settings.data,
              sessions: sessions.data,
              events: events.data,
            } as AdminData
          }
        />
      )}
    </>
  );
}
