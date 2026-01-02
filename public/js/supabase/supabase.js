// ✅ Import Supabase from CDN for browser compatibility
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// Supabase Configuration
const SUPABASE_URL = 'https://calwzopyjitbtahiafzw.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNhbHd6b3B5aml0YnRhaGlhZnp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkxNjgyOTAsImV4cCI6MjA2NDc0NDI5MH0.lFDePS6m0MpNXDcC43dJaqa1pHtCKHNRKoiDbnxTBBc';

// ✅ Create Supabase client with PROPER auth configuration
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,      // ✅ Tự động refresh token khi hết hạn
    persistSession: true,         // ✅ Lưu session vào localStorage
    detectSessionInUrl: false,    // ⚠️ false nếu không dùng OAuth/Magic Link
    storage: window.localStorage, // ✅ Sử dụng localStorage để persist session
    storageKey: 'supabase.auth.token', // Key lưu trong localStorage
    flowType: 'pkce'             // ✅ Secure auth flow
  }
});

// ✅ Log khi khởi tạo thành công
console.log('✅ Supabase client initialized');

// ✅ Optional: Lắng nghe auth state changes (để debug hoặc handle UI)
supabase.auth.onAuthStateChange((event, session) => {
  console.log('🔄 Auth event:', event);
  
  if (event === 'SIGNED_IN') {
    console.log('✅ User signed in:', session?.user?.user_metadata?.username);
  } else if (event === 'SIGNED_OUT') {
    console.log('🔓 User signed out');
  } else if (event === 'TOKEN_REFRESHED') {
    console.log('🔄 Token refreshed');
  } else if (event === 'USER_UPDATED') {
    console.log('👤 User updated');
  }
});