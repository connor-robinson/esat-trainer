import { supabase } from "../lib/supabase";

async function currentUserId() {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export async function saveSessionEntry(payload) {
  const uid = await currentUserId();
  if (!uid) throw new Error("Not signed in");
  const { data, error } = await supabase
    .from("user_sessions")
    .insert({ user_id: uid, payload })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function listSessionEntries() {
  const uid = await currentUserId();
  if (!uid) return [];
  const { data, error } = await supabase
    .from("user_sessions")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}
