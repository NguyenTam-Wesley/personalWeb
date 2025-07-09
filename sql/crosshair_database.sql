-- Tạo bảng crosshairs cho hệ thống quản lý crosshair
-- Chạy các lệnh SQL này trong Supabase SQL Editor

-- Tạo bảng crosshairs
CREATE TABLE IF NOT EXISTS crosshairs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    code TEXT NOT NULL,
    player_name TEXT,
    team_name TEXT,
    category TEXT DEFAULT 'pro', -- pro, streamer, custom
    color TEXT, -- màu của crosshair
    style TEXT, -- style: dot, cross, circle, etc.
    difficulty TEXT DEFAULT 'medium', -- easy, medium, hard
    is_active BOOLEAN DEFAULT true,
    view_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tạo index cho các trường thường query
CREATE INDEX IF NOT EXISTS idx_crosshairs_category ON crosshairs(category);
CREATE INDEX IF NOT EXISTS idx_crosshairs_player_name ON crosshairs(player_name);
CREATE INDEX IF NOT EXISTS idx_crosshairs_is_active ON crosshairs(is_active);
CREATE INDEX IF NOT EXISTS idx_crosshairs_view_count ON crosshairs(view_count);

-- Tạo function để tự động cập nhật updated_at
CREATE OR REPLACE FUNCTION update_crosshairs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Tạo trigger để tự động cập nhật updated_at khi có thay đổi
DROP TRIGGER IF EXISTS update_crosshairs_updated_at ON crosshairs;
CREATE TRIGGER update_crosshairs_updated_at
    BEFORE UPDATE ON crosshairs
    FOR EACH ROW
    EXECUTE FUNCTION update_crosshairs_updated_at();

-- Tạo function để tăng view_count
CREATE OR REPLACE FUNCTION increment_crosshair_views(crosshair_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE crosshairs 
    SET view_count = COALESCE(view_count, 0) + 1
    WHERE id = crosshair_id;
END;
$$ language 'plpgsql';

-- Cập nhật RLS (Row Level Security)
ALTER TABLE crosshairs ENABLE ROW LEVEL SECURITY;

-- Policy cho phép đọc tất cả crosshairs (public)
DROP POLICY IF EXISTS "Allow public read crosshairs" ON crosshairs;
CREATE POLICY "Allow public read crosshairs" ON crosshairs
    FOR SELECT USING (is_active = true);

-- Policy cho phép admin tạo crosshair
DROP POLICY IF EXISTS "Allow admin create crosshairs" ON crosshairs;
CREATE POLICY "Allow admin create crosshairs" ON crosshairs
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role = 'admin'
        )
    );

-- Policy cho phép admin cập nhật crosshair
DROP POLICY IF EXISTS "Allow admin update crosshairs" ON crosshairs;
CREATE POLICY "Allow admin update crosshairs" ON crosshairs
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role = 'admin'
        )
    );

-- Policy cho phép admin xóa crosshair
DROP POLICY IF EXISTS "Allow admin delete crosshairs" ON crosshairs;
CREATE POLICY "Allow admin delete crosshairs" ON crosshairs
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role = 'admin'
        )
    );

-- Thêm comment cho các cột
COMMENT ON COLUMN crosshairs.name IS 'Tên crosshair';
COMMENT ON COLUMN crosshairs.description IS 'Mô tả crosshair';
COMMENT ON COLUMN crosshairs.code IS 'Code crosshair để copy';
COMMENT ON COLUMN crosshairs.player_name IS 'Tên player sử dụng crosshair này';
COMMENT ON COLUMN crosshairs.team_name IS 'Tên team của player';
COMMENT ON COLUMN crosshairs.category IS 'Danh mục: pro, streamer, custom';
COMMENT ON COLUMN crosshairs.color IS 'Màu của crosshair';
COMMENT ON COLUMN crosshairs.style IS 'Style của crosshair';
COMMENT ON COLUMN crosshairs.difficulty IS 'Độ khó sử dụng';
COMMENT ON COLUMN crosshairs.is_active IS 'Trạng thái hiển thị';
COMMENT ON COLUMN crosshairs.view_count IS 'Số lượt xem';

-- Insert dữ liệu mẫu
INSERT INTO crosshairs (name, description, code, player_name, team_name, category, color, style, difficulty) VALUES
('TenZ Crosshair', 'Crosshair của TenZ - Pro Player Sentinels', '0;P;c;5;u;000000FF;h;0;f;0;0l;4;0o;2;0a;1;0f;0;1b;0', 'TenZ', 'Sentinels', 'pro', 'black', 'cross', 'medium'),
('ScreaM Crosshair', 'Crosshair của ScreaM - Pro Player Team Liquid', '0;P;c;1;u;FF0000FF;h;0;m;1;0l;3;0o;0;0a;1;0f;0;1b;0', 'ScreaM', 'Team Liquid', 'pro', 'red', 'dot', 'hard'),
('Shroud Crosshair', 'Crosshair của Shroud - Streamer & Pro Player', '0;P;c;5;u;FFFFFF;h;0;f;0;0l;4;0o;2;0a;1;0f;0;1b;0', 'Shroud', 'Streamer', 'streamer', 'white', 'cross', 'easy'),
('Hiko Crosshair', 'Crosshair của Hiko - Pro Player 100 Thieves', '0;P;c;5;u;00FF00FF;h;0;f;0;0l;4;0o;2;0a;1;0f;0;1b;0', 'Hiko', '100 Thieves', 'pro', 'green', 'cross', 'medium'),
('Asuna Crosshair', 'Crosshair của Asuna - Pro Player 100 Thieves', '0;P;c;5;u;FF00FFFF;h;0;f;0;0l;4;0o;2;0a;1;0f;0;1b;0', 'Asuna', '100 Thieves', 'pro', 'magenta', 'cross', 'medium'),
('Jingg Crosshair', 'Crosshair của Jingg - Pro Player Paper Rex', '0;P;c;5;u;FFFF00FF;h;0;f;0;0l;4;0o;2;0a;1;0f;0;1b;0', 'Jingg', 'Paper Rex', 'pro', 'yellow', 'cross', 'hard'),
('Simple Crosshair', 'Crosshair đơn giản cho người mới', '0;P;c;1;u;FFFFFF;h;0;f;0;0l;2;0o;1;0a;1;0f;0;1b;0', 'Custom', 'Beginner', 'custom', 'white', 'dot', 'easy'),
('Pro Crosshair', 'Crosshair chuyên nghiệp', '0;P;c;5;u;00FFFF;h;0;f;0;0l;4;0o;2;0a;1;0f;0;1b;0', 'Custom', 'Professional', 'custom', 'cyan', 'cross', 'hard'); 