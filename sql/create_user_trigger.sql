-- ⚠️  TRIGGER KHÔNG CÒN CẦN THIẾT
-- Profile giờ được tạo ngay lập tức trong registerUser() function
-- Trigger này có thể được xóa để tránh duplicate profiles

-- Nếu muốn xóa trigger hiện tại, chạy SQL này trong Supabase:
-- DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
-- DROP FUNCTION IF EXISTS public.handle_new_auth_user();

-- Trigger cũ (đã không còn dùng):
/*
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, username, email, role)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
        NEW.email,
        'user'
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();
*/
