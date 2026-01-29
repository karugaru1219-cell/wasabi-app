import { createClient } from '@supabase/supabase-js';

/**
 * Vite + Vercel 環境下で確実に環境変数を取得するためのヘルパー
 */
const getEnv = (key: string): string => {
    // @ts-ignore
    const env = import.meta.env || {};
    return env[key] || '';
};

const supabaseUrl = getEnv('VITE_SUPABASE_URL');
const supabaseAnonKey = getEnv('VITE_SUPABASE_ANON_KEY');

/**
 * Supabaseが正しく設定されているかチェック
 */
export const isSupabaseConfigured =
    !!supabaseUrl &&
    !!supabaseAnonKey &&
    supabaseUrl.startsWith('https://') &&
    !supabaseUrl.includes('placeholder');

// デバッグ用（本番では無視されます）
if (!isSupabaseConfigured) {
    console.warn("⚠️ WASABI: Database connection is not established.");
}

/**
 * Supabase クライアント
 */
export const supabase = createClient(
    supabaseUrl || 'https://placeholder-v1.supabase.co',
    supabaseAnonKey || 'placeholder'
);
