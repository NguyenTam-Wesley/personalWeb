-- RPC để cộng XP cho user
-- Đơn giản, chỉ cộng XP, không handle level up
create or replace function public.add_user_xp(
  p_user_id uuid,
  p_xp integer
)
returns void
language plpgsql
as $$
begin
  -- Validate input
  if p_user_id is null or p_xp <= 0 then
    return;
  end if;

  -- Cộng XP
  update public.user_profiles
  set xp = xp + p_xp,
      updated_at = now()
  where id = p_user_id;

  -- Log không cần thiết vì đã có audit log khác
end;
$$;
