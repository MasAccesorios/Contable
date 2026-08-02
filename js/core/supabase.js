import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL = 'https://oejeqszwxuucgotvdrmk.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_FdiubnUBmUK4TikxJCSEwg_AXt6f9nx';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export { supabase };
