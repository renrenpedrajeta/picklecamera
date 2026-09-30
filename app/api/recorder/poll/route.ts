import { authenticateRecorder } from "@/lib/recorder-server";
import { json, readBody } from "@/lib/http";
import { bool, InputError, text } from "@/lib/validation";
export async function POST(request: Request) {
  try {
    const auth = await authenticateRecorder(request);
    if (!auth)
      return json({ error: "Recorder token is invalid or revoked." }, 401);
    const body = await readBody(request);
    if (!["win32", "linux", "darwin"].includes(String(body.platform)))
      throw new InputError("Unsupported platform.");
    const { error } = await auth.db
      .from("recorders")
      .update({
        last_seen_at: new Date().toISOString(),
        agent_version: text(body.version, "Agent version", 30),
        platform: body.platform,
        ffmpeg_available: bool(body.ffmpeg_available),
      })
      .eq("id", auth.recorderId);
    if (error) throw error;
    const result = await auth.db.rpc("claim_recorder_command", {
      p_recorder_id: auth.recorderId,
    });
    if (result.error) throw result.error;
    const job = result.data?.[0];
    return json({
      command: job
        ? {
            id: job.id,
            kind: job.kind,
            device_reference: job.device_reference,
            lease_token: job.lease_token,
          }
        : null,
    });
  } catch (error) {
    return json(
      {
        error:
          error instanceof InputError
            ? error.message
            : "Recorder polling is temporarily unavailable.",
      },
      error instanceof InputError ? 400 : 503,
    );
  }
}
