import { createBrowserClient } from "@supabase/ssr";

// Not initialized by the preview. Live authentication is the next implementation stage.
export function createSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key)
    throw new Error(
      "Supabase is not configured. Set the public environment variables.",
    );
  return createBrowserClient(url, key);
}
