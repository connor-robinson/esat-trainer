import { createClient } from "@supabase/supabase-js";

const url = 'https://bcbttpsokwoapjypwwwq.supabase.co';
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(url, anon);
