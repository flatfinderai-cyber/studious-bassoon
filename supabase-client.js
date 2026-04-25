import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// The anon key is a public client key — safe to ship in frontend code.
// It grants access only within RLS policies; the service-role key is never exposed here.
export const SUPABASE_URL = 'https://ygdmttxegqiqzdiumaif.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlnZG10dHhlZ3FpcXpkaXVtYWlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2MDczNTksImV4cCI6MjA4NzE4MzM1OX0.Rj09RopXbaKPg_ppJTZ0O5yn56ohstpbu8fKipcCIIU';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
