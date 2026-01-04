-- ========================================
-- SEED GAMES DATA
-- ========================================
-- Chạy script này SAU KHI đã tạo tables

-- Seed games
INSERT INTO public.games (code, name, description) VALUES
('sudoku', 'Sudoku', 'Classic number puzzle game'),
('2048', '2048', 'Slide tiles to combine numbers')
ON CONFLICT (code) DO NOTHING;

-- Seed game modes for Sudoku
INSERT INTO public.game_modes (game_id, code, name, description)
SELECT
    g.id,
    mode_data.code,
    mode_data.name,
    mode_data.description
FROM public.games g
CROSS JOIN (
    VALUES
        ('easy', 'Easy', 'Beginner level with 35-40 givens'),
        ('medium', 'Medium', 'Intermediate level with 45-50 givens'),
        ('hard', 'Hard', 'Advanced level with 50-55 givens'),
        ('very_hard', 'Very Hard', 'Expert level with 55-60 givens'),
        ('expert', 'Expert', 'Master level with 60-64 givens')
) AS mode_data(code, name, description)
WHERE g.code = 'sudoku'
ON CONFLICT (game_id, code) DO NOTHING;

-- Seed game modes for 2048
INSERT INTO public.game_modes (game_id, code, name, description)
SELECT
    g.id,
    'classic',
    'Classic',
    'Standard 2048 gameplay'
FROM public.games g
WHERE g.code = '2048'
ON CONFLICT (game_id, code) DO NOTHING;

-- Verify data
SELECT
    'Games seeded successfully' as status,
    (SELECT COUNT(*) FROM public.games) as games_count,
    (SELECT COUNT(*) FROM public.game_modes) as modes_count;
