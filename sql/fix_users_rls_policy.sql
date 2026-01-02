-- Sửa RLS policy cho bảng users (custom auth system)
-- Chạy SQL này trong Supabase SQL Editor

-- Bật RLS cho bảng users (nếu chưa bật)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Xóa policy cũ nếu có
DROP POLICY IF EXISTS "Users can read own profile" ON public.users;

-- Tạo policy mới cho phép user đọc profile của chính mình
CREATE POLICY "Users can read own profile"
ON public.users
FOR SELECT
USING (auth.uid() = id);

-- Policy cho phép update profile của chính mình
CREATE POLICY "Users can update own profile"
ON public.users
FOR UPDATE
USING (auth.uid() = id);

-- Policy cho phép insert profile mới (đăng ký)
CREATE POLICY "Users can insert own profile"
ON public.users
FOR INSERT
WITH CHECK (auth.uid() = id);

-- Kiểm tra policy đã được tạo
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'users';
