// Test script to verify rewards refactor
import { getAuthUser, getProfileUser } from './public/js/supabase/auth.js';
import { rewards } from './public/js/modules/rewards.js';

async function testRewardsRefactor() {
  console.log('🧪 Testing rewards refactor...\n');

  // Test 1: getAuthUser returns auth user with UUID
  console.log('1️⃣ Testing getAuthUser()...');
  const authUser = await getAuthUser();
  if (authUser?.id) {
    console.log('✅ getAuthUser() returns auth user with UUID:', authUser.id);
  } else {
    console.log('ℹ️ No auth user (not logged in)');
  }

  // Test 2: getProfileUser returns profile user
  console.log('\n2️⃣ Testing getProfileUser()...');
  const profileUser = await getProfileUser();
  if (profileUser?.username) {
    console.log('✅ getProfileUser() returns profile user:', profileUser.username);
  } else {
    console.log('ℹ️ No profile user available');
  }

  // Test 3: rewards.isLoggedIn() checks auth user UUID
  console.log('\n3️⃣ Testing rewards.isLoggedIn()...');
  const isLoggedIn = await rewards.isLoggedIn();
  console.log('✅ rewards.isLoggedIn() result:', isLoggedIn);

  // Test 4: rewards.getUserDailyRewards() uses auth user UUID
  console.log('\n4️⃣ Testing rewards.getUserDailyRewards()...');
  try {
    const dailyRewards = await rewards.getUserDailyRewards();
    console.log('✅ getUserDailyRewards() completed without undefined UUID error');
    console.log('Result:', dailyRewards);
  } catch (error) {
    console.log('❌ getUserDailyRewards() failed:', error.message);
  }

  // Test 5: rewards.getCurrentDailyStreak() uses auth user UUID
  console.log('\n5️⃣ Testing rewards.getCurrentDailyStreak()...');
  try {
    const streak = await rewards.getCurrentDailyStreak();
    console.log('✅ getCurrentDailyStreak() completed:', streak);
  } catch (error) {
    console.log('❌ getCurrentDailyStreak() failed:', error.message);
  }

  console.log('\n🎉 Rewards refactor test completed!');
}

// Run test if this file is executed directly
if (typeof window === 'undefined') {
  testRewardsRefactor().catch(console.error);
}
