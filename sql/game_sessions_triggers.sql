-- ========================================
-- GAME SESSIONS TRIGGERS
-- ========================================

-- Trigger cho best scores đã được chuyển sang games_tables.sql
-- File này giữ lại chỉ cho các trigger khác nếu cần

-- Function to check and unlock achievements based on game completion
CREATE OR REPLACE FUNCTION check_game_achievements()
RETURNS TRIGGER AS $$
DECLARE
    game_code_var TEXT;
    total_games_var INTEGER;
BEGIN
    -- Get game code
    SELECT code INTO game_code_var
    FROM public.games
    WHERE id = NEW.game_id;

    -- Count total games played
    SELECT COUNT(*) INTO total_games_var
    FROM public.game_sessions
    WHERE user_id = NEW.user_id;

    -- Update user profile total_games_played
    UPDATE public.user_profiles
    SET total_games_played = total_games_var,
        updated_at = NOW()
    WHERE id = NEW.user_id;

    -- Achievement logic can be added here
    -- For now, we'll keep it simple and let the client handle achievements

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update game statistics
CREATE TRIGGER trigger_check_game_achievements
    AFTER INSERT ON public.game_sessions
    FOR EACH ROW
    EXECUTE FUNCTION check_game_achievements();
