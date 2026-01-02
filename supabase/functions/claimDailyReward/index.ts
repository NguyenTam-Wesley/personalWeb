import { createClient } from 'jsr:@supabase/supabase-js@2'

Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create Supabase client with JWT from Authorization header
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // Verify JWT and get authenticated user
    const {
      data: { user },
      error: authError
    } = await supabaseClient.auth.getUser()

    if (authError || !user) {
      console.error('❌ Auth error:', authError)
      throw new Error('Unauthorized')
    }

    const user_id = user.id
    console.log('✅ Authenticated user:', user_id)

    const today = new Date()
    const cycleStartDate = new Date(today)
    cycleStartDate.setDate(today.getDate() - today.getDay()) // Chủ nhật của tuần này
    const cycleStartDateStr = cycleStartDate.toISOString().split('T')[0]
    const day = today.getDay() + 1 // 1 = Chủ nhật, 2 = Thứ 2, ..., 7 = Thứ 7

    // Check if already claimed today
    const { data: existingClaim, error: checkError } = await supabaseClient
      .from('user_daily_rewards')
      .select('*')
      .eq('user_id', user_id)
      .eq('day', day)
      .eq('cycle_start_date', cycleStartDateStr)
      .single()

    if (existingClaim) {
      throw new Error('Already claimed daily reward today')
    }

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('❌ Check error:', checkError)
      throw new Error('Failed to check existing claims')
    }

    // Calculate current streak
    const currentStreak = await calculateCurrentStreak(supabaseClient, user_id)

    // Tính streak mới
    const newStreak = currentStreak + 1
    const streakDay = (newStreak - 1) % 7 + 1 // Vòng lặp 1-7 cho rewards

    // Get daily reward config
    const { data: dailyConfig, error: configError } = await supabaseClient
      .from('daily_rewards')
      .select('*')
      .eq('day', streakDay)
      .single()

    if (configError || !dailyConfig) {
      console.error('❌ Config error:', configError)
      throw new Error('Failed to get daily reward config')
    }

    // Record the claim
    const { error: insertError } = await supabaseClient
      .from('user_daily_rewards')
      .insert({
        user_id: user_id,
        day: day,
        streak_day: newStreak,
        cycle_start_date: cycleStartDateStr
      })

    if (insertError) {
      console.error('❌ Insert error:', insertError)
      throw new Error('Failed to record daily reward claim')
    }

    // ✅ FIX: Cộng tiền bằng cách fetch -> update thay vì dùng .sql
    const rewards = { coins: 0, gems: 0 }

    if (dailyConfig.reward_coins > 0) {
      // Fetch current coins
      const { data: userData, error: fetchError } = await supabaseClient
        .from('users')
        .select('coins')
        .eq('id', user_id)
        .single()

      if (fetchError) {
        console.error('❌ Fetch coins error:', fetchError)
        throw new Error('Failed to fetch user coins')
      }

      const newCoins = (userData?.coins || 0) + dailyConfig.reward_coins

      // Update with new value
      const { error: coinError } = await supabaseClient
        .from('users')
        .update({ coins: newCoins })
        .eq('id', user_id)

      if (coinError) {
        console.error('❌ Update coins error:', coinError)
        throw new Error('Failed to grant coin reward')
      }
      rewards.coins = dailyConfig.reward_coins
    }

    if (dailyConfig.reward_gems > 0) {
      // Fetch current gems
      const { data: userData, error: fetchError } = await supabaseClient
        .from('users')
        .select('gems')
        .eq('id', user_id)
        .single()

      if (fetchError) {
        console.error('❌ Fetch gems error:', fetchError)
        throw new Error('Failed to fetch user gems')
      }

      const newGems = (userData?.gems || 0) + dailyConfig.reward_gems

      // Update with new value
      const { error: gemError } = await supabaseClient
        .from('users')
        .update({ gems: newGems })
        .eq('id', user_id)

      if (gemError) {
        console.error('❌ Update gems error:', gemError)
        throw new Error('Failed to grant gem reward')
      }
      rewards.gems = dailyConfig.reward_gems
    }

    console.log('✅ Rewards granted:', rewards)

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          day: streakDay,
          streak: newStreak,
          rewards: rewards,
          next_claim_available: new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString()
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    console.error('❌ Function error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})

// Helper function to calculate current daily streak
async function calculateCurrentStreak(supabaseClient: any, userId: string): Promise<number> {
  const today = new Date()
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)

  // Check if claimed today
  const cycleStartDate = new Date(today)
  cycleStartDate.setDate(today.getDate() - today.getDay())
  const cycleStartDateStr = cycleStartDate.toISOString().split('T')[0]
  const day = today.getDay() + 1

  const { data: todayClaim } = await supabaseClient
    .from('user_daily_rewards')
    .select('streak_day')
    .eq('user_id', userId)
    .eq('day', day)
    .eq('cycle_start_date', cycleStartDateStr)
    .single()

  if (todayClaim) {
    return todayClaim.streak_day
  }

  // Check if claimed yesterday
  const yesterdayCycleStart = new Date(yesterday)
  yesterdayCycleStart.setDate(yesterday.getDate() - yesterday.getDay())
  const yesterdayCycleStr = yesterdayCycleStart.toISOString().split('T')[0]
  const yesterdayDay = yesterday.getDay() + 1

  const { data: yesterdayClaim } = await supabaseClient
    .from('user_daily_rewards')
    .select('streak_day')
    .eq('user_id', userId)
    .eq('day', yesterdayDay)
    .eq('cycle_start_date', yesterdayCycleStr)
    .single()

  if (yesterdayClaim) {
    return yesterdayClaim.streak_day
  }

  return 0
}