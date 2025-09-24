import { createClient } from "@supabase/supabase-js";

const url  = "https://bcbttpsokwoapjypwwwq.supabase.co";
const anon = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJjYnR0cHNva3dvYXBqeXB3d3dxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg2NDY3NjgsImV4cCI6MjA3NDIyMjc2OH0.wqyQBq5xL3Q0J7iOLYtNgGk1aWQBqrfT2ADVD6VHi78";

export const supabase = createClient(url, anon);