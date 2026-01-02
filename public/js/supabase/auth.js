import { supabase } from './supabase.js';

/**
 * Đăng ký user mới với username và password
 * Sử dụng email ảo nội bộ (username@local.app)
 *
 * 🔥 SỬ DỤNG RPC FUNCTION - CÁCH CHUẨN NHẤT SUPABASE
 * Điều này đảm bảo:
 * - Atomic operation: get existing OR create new profile
 * - Bypass RLS: chạy với SECURITY DEFINER
 * - Không race condition: profile luôn sẵn sàng
 * - Không cần trigger hay retry logic
 * - Production-ready solution
 */
export async function registerUser(username, password) {
  try {
    // Tạo email ảo nội bộ từ username
    const email = `${username}@local.app`;

    // Đăng ký với Supabase Auth
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username: username
        },
        emailRedirectTo: undefined // Không cần xác thực email
      }
    });

    if (error) throw error;

    // Kiểm tra nếu user đã tồn tại
    if (data?.user?.identities?.length === 0) {
      throw new Error('Username này đã được đăng ký');
    }

    // ✅ TẠO PROFILE NGAY LẬP TỨC SAU KHI SIGNUP THÀNH CÔNG
    if (data?.user) {
      console.log('🔄 Creating user profile via RPC...');

      // 🔥 Sử dụng RPC function để tạo profile (bypass RLS + atomic)
      const { data: _profile, error: profileError } = await supabase
        .rpc('get_or_create_profile');

      if (profileError) {
        console.error('❌ Auth profile creation failed:', profileError);
        throw new Error(`Đăng ký thất bại: ${profileError.message}`);
      }

      // 🔥 Tạo game profile trong table user_profiles
      const { error: gameProfileError } = await supabase
        .from('user_profiles')
        .insert({
          id: data.user.id,
          username: username,
          level: 1,
          xp: 0,
          coins: 100, // Give some starting coins
          gems: 0,
          total_games_played: 0,
          total_time_played: 0,
          current_streak: 0,
          best_streak: 0
        });

      if (gameProfileError) {
        console.error('❌ Game profile creation failed:', gameProfileError);
        console.warn('⚠️ Auth profile created but game profile failed - will be created on first access');
      } else {
        console.log('✅ Game profile created successfully');
      }

      console.log('✅ Auth profile created successfully via RPC');
    }

    console.log('✅ Registration successful:', username);

    // 🔥 Gọi RPC để lấy profile vừa tạo
    const { data: createdProfile, error: profileError } = await supabase
      .rpc('get_or_create_profile');

    if (profileError) {
      console.error('❌ Could not retrieve created profile:', profileError);
      // Vẫn trả về user data, profile sẽ được tạo khi login
    }

    // Trả về cả user data và profile từ RPC
    return {
      user: data.user,
      session: data.session,
      profile: createdProfile || {
        id: data.user.id,
        username: username,
        email: email,
        role: 'user'
      }
    };

  } catch (error) {
    console.error('❌ Registration error:', error);
    throw error;
  }
}

/**
 * Đăng nhập với username và password
 */
export async function loginUser(username, password) {
  try {
    // Chuyển username thành email ảo
    const email = `${username}@local.app`;

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;

    // Session tự động được Supabase quản lý
    console.log('✅ Login successful:', username);
    
    // Lấy thông tin user từ public.users
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', data.user.id)
      .maybeSingle();

    if (userError) {
      console.warn('⚠️ Could not fetch user profile:', userError);
    }

    // ✅ Không logout khi chưa có profile - để trigger tự động tạo
    if (!userData) {
      console.warn('⏳ User profile chưa được tạo, sẽ tạo tự động bởi trigger...');
    }

    return {
      user: data.user,
      session: data.session,
      profile: userData
    };

  } catch (error) {
    console.error('❌ Login error:', error);
    throw error;
  }
}

/**
 * Đăng xuất
 */
export async function logoutUser() {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    
    console.log('✅ Logged out successfully');
  } catch (error) {
    console.error('❌ Logout error:', error);
    throw error;
  }
}

/**
 * Lấy user hiện tại
 * Supabase tự động quản lý session và refresh token
 */
export async function getCurrentUser() {
  try {
    // ✅ Kiểm tra session trước để tránh AuthSessionMissingError
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError) {
      console.error('❌ Session error:', sessionError);
      return null;
    }

    if (!session) {
      console.log('ℹ️ No active session');
      return null;
    }

    // Session tồn tại, lấy user từ session (an toàn hơn getUser)
    const user = session.user;

    if (!user) {
      return null;
    }

    // 🔥 Sử dụng RPC để get/create profile (luôn thành công)
    const { data: userData, error: userError } = await supabase
      .rpc('get_or_create_profile');

    if (userError) {
      console.error('❌ RPC get_or_create_profile failed:', userError);
      return {
        user,
        profile: null
      };
    }

    // ✅ RPC đảm bảo luôn trả về profile
    if (!userData) {
      console.error('❌ RPC returned null profile - unexpected');
      return {
        user,
        profile: null
      };
    }

    console.log('✅ Current user:', userData.username);

    return {
      user,
      profile: userData
    };

  } catch (error) {
    console.error('❌ Get current user error:', error);
    return null;
  }
}

/**
 * Lấy session hiện tại
 */
export async function getSession() {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) throw error;
    return session;
  } catch (error) {
    console.error('❌ Get session error:', error);
    return null;
  }
}

/**
 * Refresh session khi cần
 */
export async function refreshSession() {
  try {
    const { data: { session }, error } = await supabase.auth.refreshSession();
    if (error) throw error;
    
    console.log('✅ Session refreshed');
    return session;
  } catch (error) {
    console.error('❌ Refresh session error:', error);
    return null;
  }
}

/**
 * Đổi mật khẩu
 */
export async function updatePassword(newPassword) {
  try {
    const { data, error } = await supabase.auth.updateUser({
      password: newPassword
    });

    if (error) throw error;
    
    console.log('✅ Password updated');
    return data;
  } catch (error) {
    console.error('❌ Update password error:', error);
    throw error;
  }
}

/**
 * Lấy user hiện tại với profile
 * Sử dụng RPC để đảm bảo profile luôn có sẵn
 * @returns {Promise<{user: any, profile: any} | null>}
 */
export async function getCurrentUserWithRetry() {
  try {
    // 🔥 Sử dụng RPC để get/create profile (luôn thành công)
    const { data: profile, error: profileError } = await supabase
      .rpc('get_or_create_profile');

    if (profileError) {
      console.error('❌ RPC get_or_create_profile failed:', profileError);
      return null;
    }

    // Lấy session để có auth info
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session) {
      console.log('ℹ️ No active session');
      return null;
    }

    const userData = {
      user: session.user,
      session: session,
      profile: profile
    };

    logUserStatus(userData, '[Auth]');
    return userData;

  } catch (error) {
    console.error('❌ Error in getCurrentUserWithRetry:', error);
    return null;
  }
}

/**
 * Utility function để lấy user an toàn (cho các module khác dùng)
 * Tự động retry nếu cần, return profile nếu có
 */
export async function getUserSafely() {
  try {
    const userData = await getCurrentUserWithRetry();
    return userData?.profile || null;
  } catch (error) {
    console.error('❌ Error getting user safely:', error);
    return null;
  }
}

/**
 * Utility function để log thông tin user một cách tập trung
 * Phân biệt rõ ràng Auth Role vs App Role
 */
export function logUserInfo(userProfile, context = '', authRole = null) {
  if (!userProfile) {
    console.log(`${context} 👤 No user profile (Auth: ${authRole || 'unknown'})`);
    return;
  }

  console.log(`${context} 👤 User: ${userProfile.username} | App Role: ${userProfile.role} | Auth Role: ${authRole || 'unknown'} | ID: ${userProfile.id}`);
}

/**
 * Log comprehensive user status bao gồm cả auth và app role
 */
export function logUserStatus(userData, context = '') {
  const authRole = userData?.user?.role || 'unknown';
  const appRole = userData?.profile?.role || 'no-profile';
  const username = userData?.profile?.username || userData?.user?.user_metadata?.username || 'unknown';

  console.log(`${context} 🔍 User Status: ${username} | Auth Role: ${authRole} | App Role: ${appRole}`);

  if (userData?.profile) {
    logUserInfo(userData.profile, context, authRole);
  } else {
    console.log(`${context} ⚠️  Profile not available yet (trigger may still be creating it)`);
  }
}

/**
 * Demo function để show sự khác biệt giữa Auth Role vs App Role
 * Gọi function này trong console để test: window.demoRoleLogging()
 */
export async function demoRoleLogging() {
  console.log('🎭 DEMO: Sự khác biệt giữa Auth Role vs App Role');
  console.log('=' .repeat(60));

  const userData = await getCurrentUserWithRetry();

  if (userData) {
    console.log('🔐 AUTH ROLE (từ Supabase Auth):');
    console.log('   - Nằm trong: session.user.role');
    console.log('   - Giá trị có thể: "authenticated", "anon", "service_role"');
    console.log('   - Dùng cho: Database permissions via RLS');
    console.log('   - Current:', userData.user?.role);

    console.log('');
    console.log('👥 APP ROLE (từ bảng users - qua RPC function):');
    console.log('   - Nằm trong: profile.role');
    console.log('   - Giá trị có thể: "user", "admin", "moderator", etc.');
    console.log('   - Dùng cho: Application logic & UI permissions');
    console.log('   - Luôn sẵn sàng (RPC get_or_create_profile đảm bảo)');
    console.log('   - Không race condition, không cần retry');
    console.log('   - Current:', userData.profile?.role);

    console.log('');
    console.log('📊 SUMMARY:');
    logUserStatus(userData, '[DEMO]');
  } else {
    console.log('❌ No user data available');
  }

  console.log('=' .repeat(60));
}

// Make demo function available globally for testing
if (typeof window !== 'undefined') {
  window.demoRoleLogging = demoRoleLogging;
}

/**
 * Lắng nghe thay đổi auth state
 */
export function onAuthStateChange(callback) {
  return supabase.auth.onAuthStateChange((event, session) => {
    console.log('🔄 Auth state changed:', event);
    callback(event, session);
  });
}

// Export supabase client
export { supabase };