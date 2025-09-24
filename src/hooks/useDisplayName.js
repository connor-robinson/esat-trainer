import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export function useDisplayName(user) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Load initial name when user changes
  useEffect(() => {
    if (!user) return;
    const fallback =
      user.user_metadata?.name ||
      user.email?.split("@")[0] ||
      "";
    setName(user.user_metadata?.display_name ?? fallback);
    setDirty(false);
  }, [user?.id]);

  // Debounced auto-save to Supabase user_metadata
  useEffect(() => {
    if (!user || !dirty) return;
    const t = setTimeout(async () => {
      setSaving(true);
      try {
        await supabase.auth.updateUser({ data: { display_name: name } });
      } finally {
        setSaving(false);
        setDirty(false);
      }
    }, 500); // 0.5s debounce
    return () => clearTimeout(t);
  }, [name, dirty, user?.id]);

  return {
    name,
    setName: (v) => { setName(v); setDirty(true); },
    saving,
  };
}
