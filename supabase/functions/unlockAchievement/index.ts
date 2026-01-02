import { createClient } from 'jsr:@supabase/supabase-js@2'

interface UnlockAchievementRequest {
  user_id?: string // Optional, will use authenticated user if not provided
  trigger_type: string
  trigger_value?: number
  trigger_data?: any
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
    const { user_id = user.id, trigger_type, trigger_value, trigger_data }: UnlockAchievementRequest = await req.json()

    if (!trigger_type) {
      throw new Error('trigger_type is required')
    }

    // Get all achievements for this trigger type
    const { data: achievements, error: achievementsError } = await supabaseClient
      .from('achievements')
      .select('*')
      .eq('trigger_type', trigger_type)

    if (achievementsError) {
      throw new Error('Failed to get achievements')
    }

    const unlockedAchievements = []

    // Check each achievement
    for (const achievement of achievements) {
      // Skip if already unlocked
      const { data: existingAchievement } = await supabaseClient
        .from('user_achievements')
        .select('id')
        .eq('user_id', user_id)
        .eq('achievement_id', achievement.id)
        .single()

      if (existingAchievement) {
        continue // Already unlocked
      }

      // Check if achievement should be unlocked
      const shouldUnlock = await checkAchievementCondition(
        supabaseClient,
        achievement,
        trigger_value || achievement.trigger_value,
        trigger_data,
        user_id
      )

      if (shouldUnlock) {
        // Unlock the achievement
        const { data: unlocked, error: unlockError } = await supabaseClient
          .from('user_achievements')
          .insert({
            user_id: user_id,
            achievement_id: achievement.id,
            unlocked_at: new Date().toISOString(),
            progress: 100, // Fully completed
            claimed: false
          })
          .select(`
            *,
            achievements (
              name,
              description,
              reward_coins,
              reward_gems,
              reward_xp
            )
          `)
          .single()

        if (unlockError) {
          console.error('Failed to unlock achievement:', unlockError)
          continue
        }

        // Grant rewards if any
        if (achievement.reward_coins > 0) {
          await supabaseClient.rpc('add_currency_with_log', {
            p_user_id: user_id,
            p_currency_type: 'coins',
            p_amount: achievement.reward_coins,
            p_reason: 'achievement_unlock',
            p_reference_id: achievement.id
          })
        }

        if (achievement.reward_gems > 0) {
          await supabaseClient.rpc('add_currency_with_log', {
            p_user_id: user_id,
            p_currency_type: 'gems',
            p_amount: achievement.reward_gems,
            p_reason: 'achievement_unlock',
            p_reference_id: achievement.id
          })
        }

        if (achievement.reward_xp > 0) {
          // Use addXP function for XP rewards
          await supabaseClient.functions.invoke('addXP', {
            body: {
              amount: achievement.reward_xp,
              reason: 'achievement_unlock',
              reference_id: achievement.id
            }
          })
        }

        unlockedAchievements.push({
          id: achievement.id,
          name: achievement.name,
          description: achievement.description,
          rewards: {
            coins: achievement.reward_coins,
            gems: achievement.reward_gems,
            xp: achievement.reward_xp
          }
        })
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          unlocked_count: unlockedAchievements.length,
          achievements: unlockedAchievements
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

// Helper function to check achievement unlock conditions
async function checkAchievementCondition(
  supabaseClient: any,
  achievement: any,
  triggerValue: number,
  triggerData: any,
  userId: string
): Promise<boolean> {
  try {
    switch (achievement.trigger_type) {
      case 'games_completed': {
        const { data: profile } = await supabaseClient
          .from('user_profiles')
          .select('total_games_played')
          .eq('id', userId)
          .single()

        return profile && profile.total_games_played >= achievement.trigger_value
      }

      case 'best_time': {
        if (!triggerData?.difficulty) return false

        // Check difficulty filter
        if (achievement.difficulty_filter &&
            achievement.difficulty_filter !== triggerData.difficulty) {
          return false
        }

        // Get best time from sudoku_scores
        const { data: bestScore } = await supabaseClient
          .from('sudoku_scores')
          .select('best_time')
          .eq('user_id', userId)
          .eq('difficulty', triggerData.difficulty)
          .single()

        return bestScore && bestScore.best_time <= achievement.trigger_value
      }

      case 'streak': {
        const { data: profile } = await supabaseClient
          .from('user_profiles')
          .select('best_streak')
          .eq('id', userId)
          .single()

        return profile && profile.best_streak >= achievement.trigger_value
      }

      case 'level_reached': {
        const { data: profile } = await supabaseClient
          .from('user_profiles')
          .select('level')
          .eq('id', userId)
          .single()

        return profile && profile.level >= achievement.trigger_value
      }

      case 'total_time_played': {
        const { data: profile } = await supabaseClient
          .from('user_profiles')
          .select('total_time_played')
          .eq('id', userId)
          .single()

        const totalHours = profile ? Math.floor(profile.total_time_played / 3600) : 0
        return totalHours >= achievement.trigger_value
      }

      default:
        return false
    }
  } catch (error) {
    console.error('Error checking achievement condition:', error)
    return false
  }
}
