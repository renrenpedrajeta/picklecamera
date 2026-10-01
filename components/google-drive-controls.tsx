"use client";
import { useEffect, useState } from "react";
import EmailControls from "./email-controls";
import CleanupControls from "./cleanup-controls";
type GoogleStatus = {
  configured: boolean; redirect: string;
  integration: {owner_email:string;connected_at:string;safe_error:string|null} | null;
  jobs: {file_id:string;status:string;attempts:number;message:string|null;recording_files:{session_id:string;status:string}}[];
};
export default function GoogleDriveControls() {
  const [data,setData]=useState<GoogleStatus>();
  const [message,setMessage]=useState("");
  useEffect(()=>{
    let alive=true;
    const refresh=async()=>{
      try {
        const r=await fetch("/api/integrations/google/status",{cache:"no-store"});
        const value=await r.json();
        if (!r.ok) throw new Error(value.error);
        if (alive) setData(value);
      } catch { if (alive) setMessage("Google status is temporarily unavailable."); }
    };
    const result=new URLSearchParams(window.location.search).get("google");
    if (result) setMessage(result==="connected"?"Google Drive connected successfully.":`Google connection needs attention: ${result.replaceAll("_"," ")}.`);
    void refresh(); const timer=setInterval(refresh,15000);
    return ()=>{alive=false;clearInterval(timer);};
  },[]);
  return <><section className="admin-card google-drive-card">
    <div className="eyebrow">PRIVATE MATCH PLAYBACK</div>
    <h2>Google Drive</h2>
    <p>{data?.integration ? `Authorization saved for ${data.integration.owner_email}. See the dashboard connection check for current readiness. Completed matches upload while the venue recorder is running.` : "Connect the owner’s Google account to upload matches and give each player private viewing access."}</p>
    {data?.integration?.safe_error && <p role="alert" className="form-error">Google access needs attention. Reconnect the owner's account, then retry affected uploads.</p>}
    <p className="form-note">This connection uses Drive access to the configured existing folder. The folder must be private. Recordings are shared only with their signed-in recipient. Google may need time to process videos before playback.</p>
    {data?.configured && <form method="post" action="/api/integrations/google/start"><button className="primary" type="submit">{data.integration?"Connect / reconnect Drive & Gmail":"Connect Google Drive & Gmail"}</button></form>}
    {data && !data.configured && <p className="form-error">Google credentials are missing from the server configuration.</p>}
    {data?.redirect && <p className="form-note">In Google Cloud Console → Google Auth Platform → Clients, select this app’s client and add this exact Authorized redirect URI (not JavaScript origin): <code>{data.redirect}</code>. A redirect_uri_mismatch must be corrected there before Google can return to this app.</p>}
    {message && <p role="status" className="form-note">{message}</p>}
    <p className="form-note">Expired videos are permanently deleted from Drive and the venue computer by the recorder's cleanup worker. No video backup is retained.</p>
    {!!data?.jobs.length && <><h3>Recent uploads</h3><ul className="activity-list">{data.jobs.map(job=><li key={job.file_id}><div><strong>{["deleted","deleting"].includes(job.recording_files.status)?"Expired":job.status}</strong><p className="form-note">{job.recording_files.session_id} · {job.attempts} attempts</p>{job.message && <p className="form-error">{job.message}</p>}{job.status==="failed" && <DriveRetry sessionId={job.recording_files.session_id}/>}</div></li>)}</ul></>}
  </section><EmailControls /><CleanupControls /></>;
}
export function DriveRetry({sessionId}:{sessionId:string}) {
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);
  async function queue() {
    setBusy(true);
    try {
      const r=await fetch("/api/admin/drive/retry",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({session_id:sessionId})});
      const body=await r.json();
      setMessage(r.ok?"Queued for upload. Keep the venue recorder running.":body.error);
    } catch { setMessage("Could not queue upload. Please retry."); }
    finally { setBusy(false); }
  }
  return <><button className="sign-in" disabled={busy} onClick={queue}>{busy?"Queueing…":"Upload / retry Drive"}</button>{message && <p role="status" className="form-note">{message}</p>}</>;
}
