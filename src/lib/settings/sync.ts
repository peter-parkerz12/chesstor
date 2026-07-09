import { supabase } from "@/integrations/supabase/client";
import { getPreferences, type Preferences } from "./preferences";

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let currentUserId: string | null = null;

export function setSyncUser(userId: string | null) {
  currentUserId = userId;
}

export async function pullPreferences(userId: string): Promise<Partial<Preferences> | null> {
  const { data, error } = await supabase
    .from("user_preferences")
    .select("data")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return null;
  return (data.data as Partial<Preferences>) ?? null;
}

export function schedulePushPreferences() {
  if (!currentUserId) return;
  if (debounceTimer) clearTimeout(debounceTimer);
  const uid = currentUserId;
  debounceTimer = setTimeout(async () => {
    try {
      await supabase
        .from("user_preferences")
        .upsert({ user_id: uid, data: getPreferences() as unknown as Record<string, unknown> });
    } catch {
      /* offline — will retry on next change */
    }
  }, 600);
}

if (typeof window !== "undefined") {
  window.addEventListener("chesscoach:prefs", () => schedulePushPreferences());
}
