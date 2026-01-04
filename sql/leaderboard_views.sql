-- ========================================
-- LEADERBOARD VIEWS
-- ========================================

-- View cho leaderboard của từng game + mode
CREATE OR REPLACE VIEW v_leaderboard AS
SELECT
    gbs.id,
    gbs.user_id,
    up.username,
    g.code as game_code,
    g.name as game_name,
    gm.code as mode_code,
    gm.name as mode_name,
    gbs.metric_type,
    gbs.metric_value,
    gbs.better_is,
    gbs.updated_at,
    -- Rank trong mode này
    ROW_NUMBER() OVER (
        PARTITION BY gbs.game_id, gbs.mode_id
        ORDER BY
            CASE
                WHEN gbs.better_is = 'higher' THEN gbs.metric_value
                ELSE -gbs.metric_value
            END DESC
    ) as rank_in_mode
FROM public.game_best_scores gbs
JOIN public.games g ON g.id = gbs.game_id
LEFT JOIN public.game_modes gm ON gm.id = gbs.mode_id
LEFT JOIN public.user_profiles up ON up.id = gbs.user_id;

-- View cho best score của user hiện tại trong tất cả games
CREATE OR REPLACE VIEW v_user_best_scores AS
SELECT
    g.code as game_code,
    g.name as game_name,
    gm.code as mode_code,
    gm.name as mode_name,
    gbs.metric_type,
    gbs.metric_value,
    gbs.better_is,
    gbs.updated_at,
    -- Rank của user trong mode này
    (
        SELECT COUNT(*) + 1
        FROM public.game_best_scores gbs2
        WHERE gbs2.game_id = gbs.game_id
            AND gbs2.mode_id IS NOT DISTINCT FROM gbs.mode_id
            AND (
                (gbs.better_is = 'higher' AND gbs2.metric_value > gbs.metric_value) OR
                (gbs.better_is = 'lower' AND gbs2.metric_value < gbs.metric_value)
            )
    ) as user_rank
FROM public.game_best_scores gbs
JOIN public.games g ON g.id = gbs.game_id
LEFT JOIN public.game_modes gm ON gm.id = gbs.mode_id
WHERE gbs.user_id = auth.uid();

-- Function để get top N players cho một game + mode
CREATE OR REPLACE FUNCTION get_leaderboard(
    p_game_code TEXT,
    p_mode_code TEXT DEFAULT NULL,
    p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
    rank BIGINT,
    username TEXT,
    metric_value NUMERIC,
    updated_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT
        v.rank_in_mode,
        v.username,
        v.metric_value,
        v.updated_at
    FROM v_leaderboard v
    WHERE v.game_code = p_game_code
        AND (p_mode_code IS NULL OR v.mode_code = p_mode_code)
    ORDER BY v.rank_in_mode
    LIMIT p_limit;
$$;
