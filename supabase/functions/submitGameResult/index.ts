import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.205.0/http/server.ts";

// XP calculation functions (unchanged)
function calcSudokuXP(time: number, difficulty: string | null): number {
  const base = 50;
  const diffMultiplier: Record<string, number> = {
    easy: 1, normal: 1.2, hard: 1.5, expert: 2, master: 3
  };
  const m = difficulty ? diffMultiplier[difficulty] ?? 1 : 1;
  const timeFactor = Math.max(0.5, 600 / time);
  return Math.floor(base * m * timeFactor);
}

function calc2048XP(score: number): number {
  return Math.floor(Math.sqrt(score) * 2);
}

function calculateXP(gameCode: string, metricValue: number, modeCode: string | null): number {
  switch (gameCode) {
    case "sudoku": return calcSudokuXP(metricValue, modeCode);
    case "2048": return calc2048XP(metricValue);
    default: return 0;
  }
}

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('🚀 Function started');

    /* ================================
       1️⃣ AUTH
    ================================= */
    const authHeader = req.headers.get("Authorization");
    console.log('🔐 Auth header:', authHeader ? 'Present' : 'Missing');

    if (!authHeader) {
      console.error('❌ Missing Authorization header');
      return new Response(
        JSON.stringify({ error: "Missing Authorization header" }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    console.log('🔑 Supabase URL:', supabaseUrl ? 'Set' : 'Missing');
    console.log('🔑 Service Role Key:', supabaseKey ? 'Set' : 'Missing');

    const supabase = createClient(supabaseUrl!, supabaseKey!);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError) {
      console.error('❌ Auth error:', authError);
      return new Response(
        JSON.stringify({ error: "Invalid or expired token", details: authError }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!user) {
      console.error('❌ No user found');
      return new Response(
        JSON.stringify({ error: "User not found" }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ User authenticated:', user.id);

    /* ================================
       2️⃣ PARSE BODY
    ================================= */
    const body = await req.json();
    console.log('📦 Request body:', JSON.stringify(body, null, 2));

    const { game_code, mode_code, metric_type, metric_value, extra_data = {} } = body;

    if (!game_code || !metric_type || metric_value == null) {
      console.error('❌ Missing required fields');
      return new Response(
        JSON.stringify({ error: "Missing required fields", received: { game_code, metric_type, metric_value } }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (typeof metric_value !== "number" || metric_value <= 0) {
      console.error('❌ Invalid metric_value:', metric_value);
      return new Response(
        JSON.stringify({ error: "Invalid metric_value", value: metric_value }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    /* ================================
       3️⃣ FETCH GAME
    ================================= */
    console.log('🎮 Fetching game:', game_code);
    const { data: game, error: gameError } = await supabase
      .from("games")
      .select("id")
      .eq("code", game_code)
      .maybeSingle();

    if (gameError) {
      console.error('❌ Game fetch error:', gameError);
      return new Response(
        JSON.stringify({ error: "Game fetch failed", details: gameError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!game) {
      console.error('❌ Game not found:', game_code);
      return new Response(
        JSON.stringify({ error: "Game not found", game_code }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Game found:', game.id);

    /* ================================
       4️⃣ FETCH MODE (OPTIONAL)
    ================================= */
    let modeId: string | null = null;

    if (mode_code) {
      console.log('🎯 Fetching mode:', mode_code);
      const { data: mode, error: modeError } = await supabase
        .from("game_modes")
        .select("id")
        .eq("game_id", game.id)
        .eq("code", mode_code)
        .maybeSingle();

      if (modeError) {
        console.error('❌ Mode fetch error:', modeError);
        return new Response(
          JSON.stringify({ error: "Mode fetch failed", details: modeError }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!mode) {
        console.error('❌ Mode not found:', mode_code);
        return new Response(
          JSON.stringify({ error: "Game mode not found", mode_code }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      modeId = mode.id;
      console.log('✅ Mode found:', modeId);
    }

    /* ================================
       5️⃣ BASIC ANTI-CHEAT
    ================================= */
    if (metric_type === "time" && metric_value < 10) {
      console.warn('⚠️ Suspicious time value:', metric_value);
      return new Response(
        JSON.stringify({ error: "Suspicious time value" }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (metric_type === "score" && metric_value > 10_000_000) {
      console.warn('⚠️ Suspicious score value:', metric_value);
      return new Response(
        JSON.stringify({ error: "Suspicious score value" }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    /* ================================
       6️⃣ INSERT SESSION
    ================================= */
    const insertData = {
      user_id: user.id,
      game_id: game.id,
      mode_id: modeId,
      metric_type,
      metric_value,
      extra_data
    };

    console.log('💾 Attempting insert:', JSON.stringify(insertData, null, 2));

    const { data: insertedData, error: insertError } = await supabase
      .from("game_sessions")
      .insert(insertData)
      .select();

    if (insertError) {
      console.error('❌ Insert error:', JSON.stringify(insertError, null, 2));
      return new Response(
        JSON.stringify({ 
          error: "Failed to save game result", 
          details: insertError,
          data: insertData 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Insert successful:', insertedData);

    /* ================================
       7️⃣ CALC XP
    ================================= */
    const xpGained = calculateXP(game_code, metric_value, mode_code ?? null);
    console.log('⭐ XP calculated:', xpGained);

    if (xpGained > 0) {
      console.log('💰 Adding XP to user...');
      const { error: xpError } = await supabase.rpc(
        "add_user_xp",
        { p_user_id: user.id, p_xp: xpGained }
      );

      if (xpError) {
        console.error('❌ XP error:', xpError);
      } else {
        console.log('✅ XP added successfully');
      }
    }

    /* ================================
       8️⃣ DONE
    ================================= */
    console.log('🎉 Function completed successfully');
    return new Response(
      JSON.stringify({
        success: true,
        message: "Game result submitted",
        xp_gained: xpGained
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('💥 Unexpected error:', err);
    return new Response(
      JSON.stringify({ 
        error: "Unexpected server error", 
        details: err.message,
        stack: err.stack 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});