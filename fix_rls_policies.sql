-- Sửa RLS policies cho custom authentication system
-- Chạy các lệnh SQL này trong Supabase SQL Editor

-- Tắt RLS tạm thời để sửa
ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- Xóa các policies cũ (nếu có)
DROP POLICY IF EXISTS "Users can view own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Users can insert own profile" ON users;

-- Tạo policies mới cho custom authentication
-- Policy cho phép đọc tất cả users (cần thiết cho login)
CREATE POLICY "Allow read for login" ON users
    FOR SELECT USING (true);

-- Policy cho phép insert (đăng ký)
CREATE POLICY "Allow insert for registration" ON users
    FOR INSERT WITH CHECK (true);

-- Policy cho phép update (cập nhật profile)
CREATE POLICY "Allow update for profile" ON users
    FOR UPDATE USING (true);

-- Bật lại RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Kiểm tra xem có user nào trong database không
SELECT COUNT(*) as user_count FROM users;

-- Kiểm tra cấu trúc bảng users
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'users' 
ORDER BY ordinal_position; 