import { supabase } from "../lib/supabase";

async function uid() {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export async function createPreset({ name, topics, flashSeconds }) {
  const userId = await uid();
  if (!userId) throw new Error("Not signed in");
  const { data, error } = await supabase
    .from("user_presets")
    .insert({ user_id: userId, name, topics, flash_seconds: flashSeconds ?? null })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function listPresets() {
  const userId = await uid();
  if (!userId) return [];
  const { data, error } = await supabase
    .from("user_presets")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function deletePreset(id) {
  const userId = await uid();
  if (!userId) throw new Error("Not signed in");
  const { error } = await supabase
    .from("user_presets")
    .delete()
    .eq("id", id);
  if (error) throw error;
}
