-- Tạo RPC function để get hoặc create profile (thay thế trigger + insert)
-- Chạy SQL này trong Supabase SQL Editor

-- Function get_or_create_profile
CREATE OR REPLACE FUNCTION public.get_or_create_profile()
RETURNS public.users
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  profile_record public.users;
BEGIN
  -- Kiểm tra xem profile đã tồn tại chưa
  SELECT * INTO profile_record
  FROM public.users
  WHERE id = auth.uid();

  IF FOUND THEN
    -- Profile đã tồn tại, trả về
    RETURN profile_record;
  END IF;

  -- Profile chưa tồn tại, tạo mới
  INSERT INTO public.users (
    id,
    username,
    email,
    role,
    created_at,
    updated_at
  )
  VALUES (
    auth.uid(),
    COALESCE(current_setting('request.jwt.claims', true)::json->>'username',
             split_part(auth.email(), '@', 1)),
    auth.email(),
    'user',
    now(),
    now()
  )
  RETURNING * INTO profile_record;

  RETURN profile_record;
END;
$$;

-- Cho phép authenticated users gọi function này
GRANT EXECUTE ON FUNCTION public.get_or_create_profile() TO authenticated;

-- Test function (chạy sau khi tạo)
-- SELECT * FROM get_or_create_profile();

-- Kiểm tra function đã được tạo
-- SELECT routine_name, routine_type
-- FROM information_schema.routines
-- WHERE routine_name = 'get_or_create_profile';
