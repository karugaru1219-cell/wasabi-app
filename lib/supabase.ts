
import { createClient } from '@supabase/supabase-js';

// Fixed: Using process.env instead of import.meta.env as 'env' property is not recognized on ImportMeta in this context.
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://your-project-url.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'your-anon-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const isSupabaseConfigured = !supabaseUrl.includes('your-project-url');
