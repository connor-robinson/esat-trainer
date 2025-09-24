import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export function useDisplayName(user) {
  const [name, setName] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // load from profiles (fallback to auth metadata/email)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user) return;
      setError("");
      const { data } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("user_id", user.id)
        .maybeSingle();
      const fallback = user.user_metadata?.display_name
        ?? user.user_metadata?.name
        ?? user.email?.split("@")[0]
        ?? "";
      if (!cancelled) setName(data?.display_name ?? fallback);
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  // commit change (unique constraint handled by DB)
  async function save(newName) {
    if (!user) return;
    const trimmed = (newName || "").trim().slice(0, 32);
    if (!trimmed) { setError("Name cannot be empty"); return; }
    setSaving(true); setError("");
    try {
      // upsert into profiles
      const { error: upsertErr } = await supabase
        .from("profiles")
        .upsert({ user_id: user.id, display_name: trimmed, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
      if (upsertErr?.code === "23505") { // unique_violation
        setError("That name’s taken. Try another.");
        return;
      }
      if (upsertErr) throw upsertErr;

      // optionally mirror to auth metadata (not unique)
      await supabase.auth.updateUser({ data: { display_name: trimmed } });
      setName(trimmed);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  return {
    name, setName,
    editing, setEditing,
    saving, error, save
  };
}
