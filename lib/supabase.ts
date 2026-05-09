import { createClient } from "@supabase/supabase-js";

const url  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(
  url  || "https://xvwkloqmzgwqsouxhgiy.supabase.co",
  anon || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh2d2tsb3Ftemd3cXNvdXhoZ2l5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4NTI5MTUsImV4cCI6MjA4OTQyODkxNX0.KvAquo0TNl6Ww76UevRAI-tqxtBLQ5_mqKwFkGhc1XM"
);
