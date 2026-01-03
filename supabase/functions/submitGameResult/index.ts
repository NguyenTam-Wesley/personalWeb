import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/* ================================
   XP CALCULATION FUNCTIONS
================================= */

// Tính XP cho Sudoku (thời gian - càng nhanh càng nhiều XP)
function calcSudokuXP(time: number, difficulty: string | null): number {
  const base = 50;

  const diffMultiplier: Record<string, number> = {
    easy: 1,
    normal: 1.2,
    hard: 1.5,
    expert: 2,
    master: 3
  };

  const m = difficulty ? diffMultiplier[difficulty] ?? 1 : 1;

  // Thưởng thêm nếu hoàn thành dưới 600s (10 phút)
  const timeFactor = Math.max(0.5, 600 / time);

  return Math.floor(base * m * timeFactor);
}

// Tính XP cho 2048 (score - càng cao càng nhiều XP)
function calc2048XP(score: number): number {
  return Math.floor(Math.sqrt(score) * 2);
}

// Hàm route XP theo game
function calculateXP(
  gameCode: string,
  metricValue: number,
  modeCode: string | null
): number {
  switch (gameCode) {
    case "sudoku":
      return calcSudokuXP(metricValue, modeCode);

    case "2048":
      return calc2048XP(metricValue);

    default:
      return 0; // Game mới chưa gắn XP
  }
}

serve(async (req) => {
  try {
    /* ================================
       1️⃣ AUTH
    ================================= */
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing Authorization header" }),
        { status: 401 }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } =
      await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        { status: 401 }
      );
    }

    /* ================================
       2️⃣ PARSE BODY
    ================================= */
    const body = await req.json();

    const {
      game_code,
      mode_code,
      metric_type,
      metric_value,
      extra_data = {}
    } = body;

    if (!game_code || !metric_type || metric_value == null) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400 }
      );
    }

    if (typeof metric_value !== "number" || metric_value <= 0) {
      return new Response(
        JSON.stringify({ error: "Invalid metric_value" }),
        { status: 400 }
      );
    }

    /* ================================
       3️⃣ FETCH GAME
    ================================= */
    const { data: game, error: gameError } = await supabase
      .from("games")
      .select("id")
      .eq("code", game_code)
      .single();

    if (gameError || !game) {
      return new Response(
        JSON.stringify({ error: "Game not found" }),
        { status: 404 }
      );
    }

    /* ================================
       4️⃣ FETCH MODE (OPTIONAL)
    ================================= */
    let modeId: string | null = null;

    if (mode_code) {
      const { data: mode, error: modeError } = await supabase
        .from("game_modes")
        .select("id")
        .eq("game_id", game.id)
        .eq("code", mode_code)
        .single();

      if (modeError || !mode) {
        return new Response(
          JSON.stringify({ error: "Game mode not found" }),
          { status: 404 }
        );
      }

      modeId = mode.id;
    }

    /* ================================
       5️⃣ BASIC ANTI-CHEAT
    ================================= */
    if (metric_type === "time" && metric_value < 10) {
      return new Response(
        JSON.stringify({ error: "Suspicious time value" }),
        { status: 422 }
      );
    }

    if (metric_type === "score" && metric_value > 10_000_000) {
      return new Response(
        JSON.stringify({ error: "Suspicious score value" }),
        { status: 422 }
      );
    }

    /* ================================
       6️⃣ INSERT SESSION
    ================================= */
    const { error: insertError } = await supabase
      .from("game_sessions")
      .insert({
        user_id: user.id,
        game_id: game.id,
        mode_id: modeId,
        metric_type,
        metric_value,
        extra_data
      });

    if (insertError) {
      console.error(insertError);
      return new Response(
        JSON.stringify({ error: "Failed to save game result" }),
        { status: 500 }
      );
    }

    /* ================================
       7️⃣ CALC XP
    ================================= */
    const xpGained = calculateXP(
      game_code,
      metric_value,
      mode_code ?? null
    );

    if (xpGained > 0) {
      const { error: xpError } = await supabase.rpc(
        "add_user_xp",
        {
          p_user_id: user.id,
          p_xp: xpGained
        }
      );

      if (xpError) {
        console.error("XP error:", xpError);
        // Không fail request vì XP fail, chỉ log
      }
    }

    /* ================================
       8️⃣ DONE
    ================================= */
    return new Response(
      JSON.stringify({
        success: true,
        message: "Game result submitted"
      }),
      { status: 200 }
    );

  } catch (err) {
    console.error(err);
    return new Response(
      JSON.stringify({ error: "Unexpected server error" }),
      { status: 500 }
    );
  }
});
