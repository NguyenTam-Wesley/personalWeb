-- Bảng lưu thành tích Sudoku
CREATE TABLE sudoku_scores (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    difficulty VARCHAR(20) NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard', 'very_hard', 'expert')),
    best_time INTEGER NOT NULL, -- thời gian tính bằng giây
    best_score INTEGER DEFAULT 0, -- điểm số nếu có
    completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), -- Thời điểm lập kỷ lục mới
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Mỗi user chỉ có 1 record cho mỗi difficulty
    UNIQUE(user_id, difficulty)
);

-- Index để query nhanh
CREATE INDEX idx_sudoku_scores_user_difficulty ON sudoku_scores(user_id, difficulty);
CREATE INDEX idx_sudoku_scores_best_time ON sudoku_scores(best_time);

-- Trigger để tự động update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_sudoku_scores_updated_at
    BEFORE UPDATE ON sudoku_scores
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS (Row Level Security) - chỉ user đó xem được thành tích của mình
ALTER TABLE sudoku_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sudoku scores" ON sudoku_scores
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sudoku scores" ON sudoku_scores
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- INSERT policy (quan trọng cho upsert)
CREATE POLICY "Users can insert own sudoku scores" ON sudoku_scores
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- UPDATE policy (quan trọng cho upsert)
CREATE POLICY "Users can update own sudoku scores" ON sudoku_scores
    FOR UPDATE USING (auth.uid() = user_id);

-- DELETE policy (optional)
CREATE POLICY "Users can delete own sudoku scores" ON sudoku_scores
    FOR DELETE USING (auth.uid() = user_id);