// 🎯 Test Script cho Edge Functions
// Chạy: node test_edge_functions.js

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL || 'http://localhost:3001'
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'your-anon-key'

const supabase = createClient(supabaseUrl, supabaseKey)

// Test user (thay bằng user thật)
const TEST_USER_ID = 'your-test-user-id'
const TEST_JWT = 'your-jwt-token' // Lấy từ browser dev tools

async function testAddXP() {
  console.log('🧪 Testing addXP function...')

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/addXP`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TEST_JWT}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: 50,
        reason: 'test_game_completion',
        reference_id: null
      })
    })

    const result = await response.json()
    console.log('✅ addXP Result:', result)

  } catch (error) {
    console.error('❌ addXP Error:', error)
  }
}

async function testClaimDailyReward() {
  console.log('🧪 Testing claimDailyReward function...')

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/claimDailyReward`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TEST_JWT}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({})
    })

    const result = await response.json()
    console.log('✅ claimDailyReward Result:', result)

  } catch (error) {
    console.error('❌ claimDailyReward Error:', error)
  }
}

async function testUnlockAchievement() {
  console.log('🧪 Testing unlockAchievement function...')

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/unlockAchievement`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TEST_JWT}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        trigger_type: 'games_completed',
        trigger_data: {
          difficulty: 'easy'
        }
      })
    })

    const result = await response.json()
    console.log('✅ unlockAchievement Result:', result)

  } catch (error) {
    console.error('❌ unlockAchievement Error:', error)
  }
}

async function testDatabaseViews() {
  console.log('🧪 Testing database views...')

  try {
    // Test v_user_profiles
    const { data: profiles, error: profileError } = await supabase
      .from('v_user_profiles')
      .select('*')
      .eq('id', TEST_USER_ID)

    if (profileError) throw profileError
    console.log('✅ v_user_profiles:', profiles)

    // Test v_currency_transactions
    const { data: transactions, error: txError } = await supabase
      .from('currency_transactions')
      .select('*')
      .eq('user_id', TEST_USER_ID)
      .order('created_at', { ascending: false })
      .limit(5)

    if (txError) throw txError
    console.log('✅ currency_transactions:', transactions)

  } catch (error) {
    console.error('❌ Database view error:', error)
  }
}

async function runTests() {
  console.log('🚀 Starting Edge Functions Tests...\n')

  await testAddXP()
  console.log('')

  await testClaimDailyReward()
  console.log('')

  await testUnlockAchievement()
  console.log('')

  await testDatabaseViews()
  console.log('')

  console.log('🎉 All tests completed!')
}

// Chạy tests
runTests().catch(console.error)
