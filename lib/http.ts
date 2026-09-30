import "server-only";
import { NextResponse } from "next/server";
import { InputError } from "./validation";

export function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    const parsed = new URL(origin);
    // Next's local request URL may use localhost even when the browser uses
    // 127.0.0.1. Host preserves the actual authority; never trust forwarded-host.
    return (
      parsed.host ===
        (request.headers.get("host") || new URL(request.url).host) &&
      parsed.protocol === new URL(request.url).protocol
    );
  } catch {
    return false;
  }
}
export async function readBody(
  request: Request,
): Promise<Record<string, unknown>> {
  if (!request.headers.get("content-type")?.includes("application/json"))
    throw new InputError("Expected a JSON request.");
  const raw = await request.text();
  if (raw.length > 8192) throw new InputError("Request is too large.");
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    throw new InputError("Invalid request.");
  }
  if (!body || typeof body !== "object" || Array.isArray(body))
    throw new InputError("Invalid request.");
  return body;
}
