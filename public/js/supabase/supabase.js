import { createClient } from
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@1.35.7/+esm';
// Thay bằng thông tin của bro
const SUPABASE_URL = 'https://calwzopyjitbtahiafzw.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNhbHd6b3B5aml0YnRhaGlhZnp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkxNjgyOTAsImV4cCI6MjA2NDc0NDI5MH0.lFDePS6m0MpNXDcC43dJaqa1pHtCKHNRKoiDbnxTBBc';

// Tạo kết nối Supabase client
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Auth state manager - chờ auth ready rồi mới callback
export function onAuthReady(callback) {
    // Check current user first
    const currentUser = supabase.auth.user();
    if (currentUser) {
        callback(currentUser);
        return;
    }

    // Listen for auth state changes
    supabase.auth.onAuthStateChange((_event, session) => {
        callback(session?.user || null);
    });
}