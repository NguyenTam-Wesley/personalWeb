// Test script để kiểm tra profile page có load dữ liệu thật không
import { getCurrentUserWithRetry } from './public/js/supabase/auth.js';
import { supabase } from './public/js/supabase/supabase.js';

async function testProfileData() {
    console.log('🧪 Testing Profile Data Loading...\n');

    try {
        // 1. Test getCurrentUserWithRetry
        console.log('1️⃣ Testing getCurrentUserWithRetry...');
        const userData = await getCurrentUserWithRetry();

        if (!userData?.user) {
            console.log('❌ No authenticated user found');
            return;
        }

        console.log('✅ User authenticated:', userData.user.email);
        console.log('👤 Profile data:', userData.profile);

        // 2. Test direct query to user_profiles
        console.log('\n2️⃣ Testing direct query to user_profiles...');
        const { data: gameProfile, error: gameError } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('id', userData.user.id)
            .single();

        if (gameError) {
            console.log('❌ Error querying user_profiles:', gameError);
        } else {
            console.log('✅ Game profile found:');
            console.log('   - Username:', gameProfile.username);
            console.log('   - Level:', gameProfile.level);
            console.log('   - XP:', gameProfile.xp);
            console.log('   - Coins:', gameProfile.coins);
            console.log('   - Gems:', gameProfile.gems);
        }

        // 3. Test RPC function
        console.log('\n3️⃣ Testing RPC get_or_create_profile...');
        const { data: rpcProfile, error: rpcError } = await supabase
            .rpc('get_or_create_profile');

        if (rpcError) {
            console.log('❌ RPC error:', rpcError);
        } else {
            console.log('✅ RPC profile:', rpcProfile);
        }

        // 4. Summary
        console.log('\n📊 SUMMARY:');
        console.log('Auth User:', !!userData.user);
        console.log('Auth Profile:', !!userData.profile);
        console.log('Game Profile:', !!gameProfile);
        console.log('RPC Profile:', !!rpcProfile);

        const allGood = userData.user && userData.profile && gameProfile && rpcProfile;
        console.log('\n🎯 RESULT:', allGood ? '✅ Profile page can load real data!' : '❌ Profile page cannot load real data');

    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

// Export for use in browser console
if (typeof window !== 'undefined') {
    window.testProfileData = testProfileData;
    console.log('💡 Run testProfileData() in browser console to test profile data loading');
}

export { testProfileData };
