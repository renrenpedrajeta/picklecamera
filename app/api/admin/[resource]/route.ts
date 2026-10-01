import { getAccount } from "@/lib/auth";
import { serverSupabase } from "@/lib/supabase-server";
import { json, sameOrigin, readBody } from "@/lib/http";
import {
  bool,
  cameraInput,
  InputError,
  settingsInput,
  text,
  uuid,
} from "@/lib/validation";

export async function POST(
  request: Request,
  context: { params: Promise<{ resource: string }> },
) {
  if (!sameOrigin(request))
    return json({ error: "Request origin is not allowed." }, 403);
  try {
    const { account } = await getAccount();
    if (!account) return json({ error: "Please sign in again." }, 401);
    if (account.role !== "admin")
      return json({ error: "Administrator access is required." }, 403);
    const { resource } = await context.params;
    if (!["courts", "cameras", "recorders", "settings"].includes(resource))
      return json({ error: "Not found." }, 404);
    const body = await readBody(request);
    const db = await serverSupabase();
    let result;
    if (resource === "settings") {
      result = await db
        .from("venue_settings")
        .update(settingsInput(body))
        .eq("id", true)
        .select("id")
        .single();
    } else {
      let values: Record<string, unknown>;
      if (resource === "courts") {
        if (
          typeof body.location !== "string" ||
          body.location.trim().length > 150
        )
          throw new InputError("Location must be 150 characters or less.");
        values = {
          name: text(body.name, "Court name"),
          location: body.location.trim(),
          active: bool(body.active),
        };
      } else if (resource === "cameras") values = cameraInput(body);
      else values = { name: text(body.name, "Recorder name") };
      result = body.id
        ? await db
            .from(resource)
            .update(values)
            .eq("id", uuid(body.id))
            .select("id")
            .single()
        : await db.from(resource).insert(values).select("id").single();
    }
    if (result.error) {
      const code = result.error.code;
      return json(
        {
          error:
            code === "23505"
              ? "That name or device already exists, or the court already has a primary camera. Edit the existing entry first."
              : code === "23514"
                ? "This change is invalid or a recording is active. Check the settings and try again."
                : code === "23503"
                  ? "The selected court or recorder no longer exists."
                  : "Could not save this change. Check that database setup is complete and try again.",
        },
        400,
      );
    }
    return json({ ok: true, id: result.data.id });
  } catch (error) {
    return json(
      {
        error:
          error instanceof InputError
            ? error.message
            : "The service is temporarily unavailable.",
      },
      error instanceof InputError ? 400 : 503,
    );
  }
}
