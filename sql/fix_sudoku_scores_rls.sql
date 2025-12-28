-- Sửa RLS policies cho bảng sudoku_scores với custom authentication
-- Chạy script này trong Supabase SQL Editor

-- Tắt RLS tạm thời
ALTER TABLE sudoku_scores DISABLE ROW LEVEL SECURITY;

-- Xóa các policies cũ
DROP POLICY IF EXISTS "Users can view own sudoku scores" ON sudoku_scores;
DROP POLICY IF EXISTS "Users can insert own sudoku scores" ON sudoku_scores;
DROP POLICY IF EXISTS "Users can update own sudoku scores" ON sudoku_scores;
DROP POLICY IF EXISTS "Users can delete own sudoku scores" ON sudoku_scores;

-- Tạo policies mới cho custom authentication
-- Policy cho phép user xem thành tích của chính mình
CREATE POLICY "Allow users to view own sudoku scores" ON sudoku_scores
    FOR SELECT USING (true); -- Tạm thời cho phép tất cả để debug

-- Policy cho phép user insert/update thành tích của chính mình
CREATE POLICY "Allow users to manage own sudoku scores" ON sudoku_scores
    FOR ALL USING (true); -- Tạm thời cho phép tất cả để debug

-- Bật lại RLS
ALTER TABLE sudoku_scores ENABLE ROW LEVEL SECURITY;

-- Kiểm tra policies đã tạo
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'sudoku_scores';

-- Kiểm tra dữ liệu hiện tại
SELECT COUNT(*) as total_scores FROM sudoku_scores;
