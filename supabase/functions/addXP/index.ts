import { createClient } from 'jsr:@supabase/supabase-js@2'

interface AddXPRequest {
  amount: number
  reason?: string
  reference_id?: string
}

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
    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // Get authenticated user
    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')
    const { data: { user } } = await supabaseClient.auth.getUser(token)

    if (!user) {
      throw new Error('Unauthorized')
    }

    // Parse request body
    const { amount, reason = 'game_completion', reference_id }: AddXPRequest = await req.json()

    if (!amount || amount <= 0) {
      throw new Error('Invalid XP amount')
    }

    // Get current user profile
    const { data: profile, error: profileError } = await supabaseClient
      .from('user_profiles')
      .select('level, xp')
      .eq('id', user.id)
      .single()

    if (profileError) {
      throw new Error('Failed to get user profile')
    }

    // Calculate new level and XP
    const { data: levelResult, error: levelError } = await supabaseClient
      .rpc('calculate_level_and_xp', {
        total_xp: profile.xp + amount + calculateTotalXPForPreviousLevels(profile.level)
      })

    if (levelError) {
      throw new Error('Failed to calculate level')
    }

    const newLevel = levelResult[0].level
    const newXP = levelResult[0].xp_in_level

    // Check for level up rewards
    let levelUpRewards = { coins: 0, gems: 0 }
    if (newLevel > profile.level) {
      for (let level = profile.level + 1; level <= newLevel; level++) {
        const { data: rewards } = await supabaseClient
          .from('level_rewards')
          .select('reward_coins, reward_gems')
          .eq('level', level)
          .single()

        if (rewards) {
          levelUpRewards.coins += rewards.reward_coins || 0
          levelUpRewards.gems += rewards.reward_gems || 0
        }
      }
    }

    // Update user profile (only XP and level, coins/gems handled separately)
    const { error: updateError } = await supabaseClient
      .from('user_profiles')
      .update({
        level: newLevel,
        xp: newXP,
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id)

    if (updateError) {
      throw new Error('Failed to update profile')
    }

    // Handle level up rewards separately (add to current coins/gems)
    if (levelUpRewards.coins > 0) {
      await supabaseClient.rpc('add_currency_with_log', {
        p_user_id: user.id,
        p_currency_type: 'coins',
        p_amount: levelUpRewards.coins,
        p_reason: 'level_up',
        p_reference_id: reference_id
      })
    }

    if (levelUpRewards.gems > 0) {
      await supabaseClient.rpc('add_currency_with_log', {
        p_user_id: user.id,
        p_currency_type: 'gems',
        p_amount: levelUpRewards.gems,
        p_reason: 'level_up',
        p_reference_id: reference_id
      })
    }

    // Check for level up achievements
    if (newLevel > profile.level) {
      // This will be handled by the unlockAchievement function
      // For now, we'll trigger it via a background process
      try {
        await supabaseClient.functions.invoke('unlockAchievement', {
          body: {
            user_id: user.id,
            trigger_type: 'level_reached',
            trigger_value: newLevel
          }
        })
      } catch (achievementError) {
        console.error('Failed to check achievements:', achievementError)
        // Don't fail the main request if achievements fail
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          old_level: profile.level,
          new_level: newLevel,
          current_xp: newXP,
          xp_gained: amount,
          level_up: newLevel > profile.level,
          rewards: levelUpRewards
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
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

// Helper function to calculate total XP for previous levels
function calculateTotalXPForPreviousLevels(level: number): number {
  let total = 0
  for (let i = 1; i < level; i++) {
    total += i * 100 + (i - 1) * 50 // Same formula as get_xp_needed_for_level
  }
  return total
}
