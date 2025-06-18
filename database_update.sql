-- Cập nhật bảng users để hỗ trợ trang profile
-- Chạy các lệnh SQL này trong Supabase SQL Editor

-- Thêm các cột mới vào bảng users
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS full_name TEXT,
ADD COLUMN IF NOT EXISTS bio TEXT,
ADD COLUMN IF NOT EXISTS login_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Tạo index cho email để tìm kiếm nhanh hơn
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Tạo function để tự động cập nhật updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Tạo trigger để tự động cập nhật updated_at khi có thay đổi
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Tạo function để tăng login_count
CREATE OR REPLACE FUNCTION increment_login_count(user_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE users 
    SET login_count = COALESCE(login_count, 0) + 1
    WHERE id = user_id;
END;
$$ language 'plpgsql';

-- Cập nhật RLS (Row Level Security) nếu cần
-- Cho phép user chỉ đọc và cập nhật thông tin của chính mình
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Policy cho phép user đọc thông tin của chính mình
DROP POLICY IF EXISTS "Users can view own profile" ON users;
CREATE POLICY "Users can view own profile" ON users
    FOR SELECT USING (auth.uid()::text = id::text);

-- Policy cho phép user cập nhật thông tin của chính mình
DROP POLICY IF EXISTS "Users can update own profile" ON users;
CREATE POLICY "Users can update own profile" ON users
    FOR UPDATE USING (auth.uid()::text = id::text);

-- Policy cho phép user insert (đăng ký)
DROP POLICY IF EXISTS "Users can insert own profile" ON users;
CREATE POLICY "Users can insert own profile" ON users
    FOR INSERT WITH CHECK (true);

-- Thêm comment cho các cột
COMMENT ON COLUMN users.email IS 'Email của user';
COMMENT ON COLUMN users.full_name IS 'Họ và tên đầy đủ';
COMMENT ON COLUMN users.bio IS 'Giới thiệu về bản thân';
COMMENT ON COLUMN users.login_count IS 'Số lần đăng nhập';
COMMENT ON COLUMN users.created_at IS 'Thời gian tạo tài khoản';
COMMENT ON COLUMN users.updated_at IS 'Thời gian cập nhật cuối cùng'; 