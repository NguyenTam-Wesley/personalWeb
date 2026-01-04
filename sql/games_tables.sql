-- ========================================
-- GAMES SYSTEM TABLES
-- ========================================

-- Games table - chứa danh sách games
CREATE TABLE IF NOT EXISTS public.games (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT UNIQUE NOT NULL, -- 'sudoku', '2048', etc.
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Game modes table - chứa các mode của từng game
CREATE TABLE IF NOT EXISTS public.game_modes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    game_id UUID REFERENCES public.games(id) ON DELETE CASCADE,
    code TEXT NOT NULL, -- 'easy', 'medium', 'hard', etc.
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(game_id, code)
);

-- Game sessions table - lưu kết quả chơi game
CREATE TABLE IF NOT EXISTS public.game_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    game_id UUID REFERENCES public.games(id) ON DELETE CASCADE,
    mode_id UUID REFERENCES public.game_modes(id) ON DELETE SET NULL,
    metric_type TEXT NOT NULL, -- 'time', 'score', 'moves', 'accuracy'
    metric_value NUMERIC NOT NULL, -- thời gian (giây), điểm số, %
    extra_data JSONB DEFAULT '{}', -- thông tin bổ sung
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_game_sessions_user_id ON public.game_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_game_sessions_game_id ON public.game_sessions(game_id);
CREATE INDEX IF NOT EXISTS idx_game_sessions_mode_id ON public.game_sessions(mode_id);
CREATE INDEX IF NOT EXISTS idx_game_sessions_created_at ON public.game_sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_game_sessions_metric ON public.game_sessions(game_id, mode_id, metric_type, metric_value);

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION update_games_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_games_updated_at
    BEFORE UPDATE ON public.games
    FOR EACH ROW
    EXECUTE FUNCTION update_games_updated_at();

CREATE TRIGGER update_game_modes_updated_at
    BEFORE UPDATE ON public.game_modes
    FOR EACH ROW
    EXECUTE FUNCTION update_games_updated_at();

-- RLS Policies
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_modes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_sessions ENABLE ROW LEVEL SECURITY;

-- Games: public read access
CREATE POLICY "Allow public read access to games" ON public.games
    FOR SELECT USING (true);

CREATE POLICY "Allow admin to manage games" ON public.games
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid()
            AND username IN ('admin', 'system') -- Adjust as needed
        )
    );

-- Game modes: public read access
CREATE POLICY "Allow public read access to game modes" ON public.game_modes
    FOR SELECT USING (true);

CREATE POLICY "Allow admin to manage game modes" ON public.game_modes
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid()
            AND username IN ('admin', 'system') -- Adjust as needed
        )
    );

-- Game sessions: users can view own sessions, insert own sessions
CREATE POLICY "Users can view own game sessions" ON public.game_sessions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own game sessions" ON public.game_sessions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can manage all game sessions" ON public.game_sessions
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- ========================================
-- INSERT INITIAL DATA
-- ========================================

-- Insert games
INSERT INTO public.games (code, name, description) VALUES
('sudoku', 'Sudoku', 'Classic number puzzle game'),
('2048', '2048', 'Slide tiles to combine numbers')
ON CONFLICT (code) DO NOTHING;

-- Insert game modes for Sudoku
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

-- Insert game modes for 2048 (no difficulty modes, just score-based)
INSERT INTO public.game_modes (game_id, code, name, description)
SELECT
    g.id,
    'classic',
    'Classic',
    'Standard 2048 gameplay'
FROM public.games g
WHERE g.code = '2048'
ON CONFLICT (game_id, code) DO NOTHING;

-- ========================================
-- GAME BEST SCORES TABLE (CỰC KỲ QUAN TRỌNG)
-- ========================================

-- Game best scores table - lưu best scores cho leaderboard & UI
CREATE TABLE IF NOT EXISTS public.game_best_scores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    game_id UUID REFERENCES public.games(id) ON DELETE CASCADE,
    mode_id UUID REFERENCES public.game_modes(id) ON DELETE SET NULL,
    metric_type TEXT NOT NULL, -- 'time', 'score', 'moves', 'accuracy'
    metric_value NUMERIC NOT NULL, -- giá trị metric
    better_is TEXT NOT NULL CHECK (better_is IN ('higher', 'lower')), -- quy ước so sánh
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (user_id, game_id, mode_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_best_scores_game_mode ON public.game_best_scores (game_id, mode_id, metric_value);
CREATE INDEX IF NOT EXISTS idx_best_scores_user ON public.game_best_scores (user_id, game_id);

-- RLS Policies for game_best_scores
ALTER TABLE public.game_best_scores ENABLE ROW LEVEL SECURITY;

-- Leaderboard: ai cũng xem được best scores
CREATE POLICY "Public can view best scores" ON public.game_best_scores
    FOR SELECT USING (true);

-- Users can update own best scores
CREATE POLICY "Users can update own best scores" ON public.game_best_scores
    FOR UPDATE USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can insert own best scores" ON public.game_best_scores
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ========================================
-- TRIGGER FUNCTION: UPDATE BEST SCORES
-- ========================================

-- Function to automatically update best scores when new session is inserted
CREATE OR REPLACE FUNCTION public.update_best_score()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    existing RECORD;
    should_update BOOLEAN := FALSE;
BEGIN
    -- Tìm best score hiện tại của user cho game + mode
    SELECT *
    INTO existing
    FROM public.game_best_scores
    WHERE user_id = NEW.user_id
        AND game_id = NEW.game_id
        AND (
            (mode_id IS NULL AND NEW.mode_id IS NULL)
            OR mode_id = NEW.mode_id
        )
    LIMIT 1;

    -- Nếu CHƯA có best score → insert luôn
    IF NOT FOUND THEN
        INSERT INTO public.game_best_scores (
            user_id,
            game_id,
            mode_id,
            metric_type,
            metric_value,
            better_is,
            updated_at
        ) VALUES (
            NEW.user_id,
            NEW.game_id,
            NEW.mode_id,
            NEW.metric_type,
            NEW.metric_value,
            CASE
                WHEN NEW.metric_type = 'time' THEN 'lower'
                ELSE 'higher'
            END,
            NOW()
        );

        RETURN NEW;
    END IF;

    -- Nếu ĐÃ có → so sánh theo better_is
    IF existing.better_is = 'higher' AND NEW.metric_value > existing.metric_value THEN
        should_update := TRUE;
    ELSIF existing.better_is = 'lower' AND NEW.metric_value < existing.metric_value THEN
        should_update := TRUE;
    END IF;

    -- Update nếu tốt hơn
    IF should_update THEN
        UPDATE public.game_best_scores
        SET metric_value = NEW.metric_value,
            updated_at = NOW()
        WHERE id = existing.id;
    END IF;

    RETURN NEW;
END;
$$;

-- ========================================
-- TRIGGER: AUTO UPDATE BEST SCORES
-- ========================================

DROP TRIGGER IF EXISTS trg_update_best_score ON public.game_sessions;

CREATE TRIGGER trg_update_best_score
    AFTER INSERT ON public.game_sessions
    FOR EACH ROW
    EXECUTE FUNCTION public.update_best_score();
