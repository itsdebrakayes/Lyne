// External Supabase client - Use your own Supabase project
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vdyyxxjkragvauevjocy.supabase.co';
const supabaseKey = 'sb_publishable_RclXKSXhjvcp0QDVSXAlNg_-VXU0Jng';

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});
