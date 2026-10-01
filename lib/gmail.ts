import { driveId } from "./google-drive";
export const GMAIL_SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send";
export class MailError extends Error {
  constructor(public code:string,public outcome:"retry"|"failed"|"unknown",public retryAfter=60000) { super(code); }
}
function email(value:string) {
  if (!/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(value) || /@example\.(com|net|org)$/i.test(value))
    throw new MailError("invalid_email_recipient","failed");
  return value;
}
export function recordingMessage(sender:string,recipient:string,file:string,drive:string,expires:string,zone:string,linkAccess=false) {
  email(sender); email(recipient);
  if (!/^[a-f0-9-]{36}$/.test(file)) throw new MailError("invalid_recording","failed");
  const deadline = new Intl.DateTimeFormat("en-PH",{timeZone:zone,dateStyle:"medium",timeStyle:"short"}).format(new Date(expires));
  const body = `Your Casa Batik match recording is ready.\n\nWatch your recording:\nhttps://drive.google.com/file/d/${driveId(drive)}/view\n\n${linkAccess ? "Anyone with this link can watch. Only forward it to people you want to share your recording with." : `Sign in to Google as ${recipient} to view this private recording.`}\nGoogle may need a little time to prepare video playback.\n\nPlease save a copy before ${deadline} (${zone}), the scheduled retention deadline.\n\nEnjoy your replay!\nCasa Batik`;
  const encoded = Buffer.from(body).toString("base64").match(/.{1,76}/g)!.join("\r\n");
  return Buffer.from([
    `From: Casa Batik <${sender}>`,`To: ${recipient}`,"Subject: Your Casa Batik match recording is ready",
    `Message-ID: <casa-batik-${file}@${sender.split("@")[1]}>`,
    "MIME-Version: 1.0","Content-Type: text/plain; charset=UTF-8","Content-Transfer-Encoding: base64","",encoded,
  ].join("\r\n")).toString("base64url");
}
export async function sendGmail(token:string,raw:string,request:typeof fetch=fetch):Promise<string> {
  let response:Response;
  try {
    response=await request("https://gmail.googleapis.com/gmail/v1/users/me/messages/send",{
      method:"POST",redirect:"error",signal:AbortSignal.timeout(20000),
      headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},body:JSON.stringify({raw}),
    });
  } catch { throw new MailError("send_outcome_unknown","unknown"); }
  if (!response.ok) {
    if (response.status>=500) throw new MailError("send_outcome_unknown","unknown");
    if (response.status===401) throw new MailError("gmail_reconnect_required","failed");
    const data=await response.json().catch(()=>({}));
    const reason=data.error?.errors?.[0]?.reason;
    if (response.status===429 || ["rateLimitExceeded","userRateLimitExceeded","dailyLimitExceeded"].includes(reason)) {
      const retry=response.headers.get("retry-after") || "";
      const wait=/^\d+$/.test(retry)?Number(retry)*1000:Date.parse(retry)-Date.now();
      throw new MailError("gmail_rate_limited","retry",Number.isFinite(wait)?Math.max(60000,wait):60000);
    }
    throw new MailError(response.status===403?"gmail_permission_required":"gmail_request_rejected","failed");
  }
  const data=await response.json().catch(()=>({}));
  if (!data.id) throw new MailError("send_outcome_unknown","unknown");
  return data.id;
}
