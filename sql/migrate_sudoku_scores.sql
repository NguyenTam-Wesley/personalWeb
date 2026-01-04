-- ========================================
-- MIGRATE SUDOKU SCORES TO GAME BEST SCORES
-- ========================================
-- Chạy script này SAU KHI đã tạo tables mới

-- Insert best scores từ sudoku_scores vào game_best_scores
INSERT INTO public.game_best_scores (
    user_id,
    game_id,
    mode_id,
    metric_type,
    metric_value,
    better_is,
    updated_at
)
SELECT
    ss.user_id,
    g.id as game_id,
    gm.id as mode_id,
    'time' as metric_type,
    ss.best_time as metric_value,
    'lower' as better_is,
    ss.completed_at as updated_at
FROM public.sudoku_scores ss
JOIN public.games g ON g.code = 'sudoku'
JOIN public.game_modes gm ON gm.game_id = g.id AND gm.code = ss.difficulty
ON CONFLICT (user_id, game_id, mode_id) DO NOTHING;

-- Optional: Backup và drop table cũ nếu không cần nữa
-- ALTER TABLE public.sudoku_scores RENAME TO sudoku_scores_backup;
-- DROP TABLE IF EXISTS public.sudoku_scores;

-- Verify migration
SELECT
    'Migration completed' as status,
    COUNT(*) as migrated_records
FROM public.game_best_scores gbs
JOIN public.games g ON g.id = gbs.game_id
WHERE g.code = 'sudoku';
