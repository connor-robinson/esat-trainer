import { createClient } from "@supabase/supabase-js";

const url  = import.meta.env.VITE_SUPABASE_URL?.trim();
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

// TEMP: add these logs to see what's missing in prod
if (!url)  console.error("Missing env: VITE_SUPABASE_URL");
if (!anon) console.error("Missing env: VITE_SUPABASE_ANON_KEY");

export const supabase = createClient(url, anon);