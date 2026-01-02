-- Database Schema for Leveling/XP/Coin/Items/Pets/Achievements System
-- Run this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ========================================
-- USER PROFILES TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE,
    level INTEGER DEFAULT 1,
    xp INTEGER DEFAULT 0, -- XP trong level hiện tại (không phải total XP)
    coins INTEGER DEFAULT 0,
    gems INTEGER DEFAULT 0, -- Premium currency
    total_games_played INTEGER DEFAULT 0,
    total_time_played INTEGER DEFAULT 0, -- in seconds
    current_streak INTEGER DEFAULT 0,
    best_streak INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================
-- ITEMS TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS public.items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    type TEXT NOT NULL CHECK (type IN ('consumable', 'cosmetic', 'tool', 'pet_food')),
    rarity TEXT DEFAULT 'common' CHECK (rarity IN ('common', 'rare', 'epic', 'legendary')),
    price_coins INTEGER DEFAULT 0,
    price_gems INTEGER DEFAULT 0,
    is_available BOOLEAN DEFAULT true,
    max_owned INTEGER DEFAULT NULL, -- NULL means unlimited
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================
-- USER ITEMS TABLE (Inventory)
-- ========================================
CREATE TABLE IF NOT EXISTS public.user_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    item_id UUID REFERENCES public.items(id) ON DELETE CASCADE,
    quantity INTEGER DEFAULT 1,
    acquired_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, item_id)
);

-- ========================================
-- PETS TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS public.pets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    rarity TEXT DEFAULT 'common' CHECK (rarity IN ('common', 'rare', 'epic', 'legendary')),
    price_coins INTEGER DEFAULT 0,
    price_gems INTEGER DEFAULT 0,
    happiness_boost INTEGER DEFAULT 0, -- XP multiplier percentage
    luck_boost INTEGER DEFAULT 0, -- Coin multiplier percentage
    unlock_level INTEGER DEFAULT 1,
    is_available BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================
-- USER PETS TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS public.user_pets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    pet_id UUID REFERENCES public.pets(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT false,
    acquired_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_fed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    happiness_level INTEGER DEFAULT 100, -- 0-100
    UNIQUE(user_id, pet_id)
);

-- Enforce only one active pet per user
CREATE UNIQUE INDEX idx_one_active_pet_per_user
ON public.user_pets (user_id)
WHERE is_active = true;

-- ========================================
-- ACHIEVEMENTS TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS public.achievements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    icon TEXT,
    category TEXT DEFAULT 'general' CHECK (category IN ('sudoku', 'streak', 'time', 'level', 'collection')),
    trigger_type TEXT NOT NULL, -- 'games_completed', 'best_time', 'streak', 'level_reached', etc.
    trigger_value INTEGER NOT NULL,
    difficulty_filter TEXT DEFAULT NULL, -- 'easy', 'medium', 'hard', etc. NULL means all
    is_hidden BOOLEAN DEFAULT false,
    reward_coins INTEGER DEFAULT 0,
    reward_gems INTEGER DEFAULT 0,
    reward_xp INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================
-- USER ACHIEVEMENTS TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS public.user_achievements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    achievement_id UUID REFERENCES public.achievements(id) ON DELETE CASCADE,
    unlocked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    claimed BOOLEAN DEFAULT false,
    progress INTEGER DEFAULT 0, -- For progress-tracking achievements
    -- ROADMAP: Consider adding progress_current/progress_target for multi-stage achievements
    UNIQUE(user_id, achievement_id)
);

-- ========================================
-- LEVEL REWARDS TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS public.level_rewards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    level INTEGER UNIQUE NOT NULL,
    reward_coins INTEGER DEFAULT 0,
    reward_gems INTEGER DEFAULT 0,
    reward_item_id UUID REFERENCES public.items(id) ON DELETE SET NULL,
    reward_pet_id UUID REFERENCES public.pets(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================
-- DAILY REWARDS TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS public.daily_rewards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    day INTEGER NOT NULL, -- 1-7 for weekly cycle
    reward_coins INTEGER DEFAULT 0,
    reward_gems INTEGER DEFAULT 0,
    reward_item_id UUID REFERENCES public.items(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================
-- USER DAILY REWARDS TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS public.user_daily_rewards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    day INTEGER NOT NULL,
    claimed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    streak_day INTEGER NOT NULL, -- Current streak day (1-7)
    cycle_start_date DATE NOT NULL, -- Start date of current 7-day cycle
    UNIQUE(user_id, day, cycle_start_date)
);

-- ========================================
-- CURRENCY TRANSACTION LOG TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS public.currency_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    currency_type TEXT NOT NULL CHECK (currency_type IN ('coins', 'gems')),
    amount INTEGER NOT NULL, -- Positive = gained, Negative = spent
    reason TEXT NOT NULL, -- 'game_reward', 'achievement_claim', 'item_purchase', 'daily_reward', etc.
    reference_id UUID, -- Reference to related record (achievement_id, item_id, etc.)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================
-- XP/Coin REWARDS CONFIG
-- ========================================
CREATE TABLE IF NOT EXISTS public.game_rewards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    difficulty TEXT NOT NULL,
    base_xp INTEGER NOT NULL,
    base_coins INTEGER NOT NULL,
    time_bonus_multiplier DECIMAL(3,2) DEFAULT 1.0, -- Bonus for fast completion
    streak_bonus_multiplier DECIMAL(3,2) DEFAULT 1.0, -- Bonus for streaks
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(difficulty)
);

-- ========================================
-- INSERT INITIAL DATA
-- ========================================

-- Insert game rewards for each difficulty
INSERT INTO public.game_rewards (difficulty, base_xp, base_coins, time_bonus_multiplier, streak_bonus_multiplier) VALUES
('easy', 10, 5, 1.2, 1.5),
('medium', 25, 15, 1.5, 1.8),
('hard', 50, 30, 2.0, 2.0),
('very_hard', 75, 50, 2.5, 2.5),
('expert', 100, 75, 3.0, 3.0);

-- Insert some sample items
INSERT INTO public.items (name, description, type, rarity, price_coins, max_owned) VALUES
('XP Booster', 'Tăng 50% XP trong 1 giờ', 'consumable', 'rare', 100, 5),
('Coin Magnet', 'Tăng 25% coins từ games', 'consumable', 'common', 50, 10),
('Time Freeze', 'Dừng timer trong 30 giây', 'tool', 'epic', 200, 3),
('Lucky Charm', 'Tăng tỉ lệ nhận rare items', 'cosmetic', 'rare', 150, 1),
('Pet Food', 'Thức ăn cho pets', 'pet_food', 'common', 25, NULL);

-- Insert some sample pets
INSERT INTO public.pets (name, description, rarity, price_coins, happiness_boost, luck_boost, unlock_level) VALUES
('Lucky Cat', 'Một chú mèo may mắn', 'common', 200, 10, 5, 1),
('Wise Owl', 'Con cú thông thái', 'rare', 500, 20, 15, 5),
('Golden Dragon', 'Rồng vàng quyền lực', 'legendary', 2000, 50, 30, 15);

-- Insert some achievements
INSERT INTO public.achievements (name, description, category, trigger_type, trigger_value, difficulty_filter, reward_coins, reward_xp) VALUES
('First Steps', 'Hoàn thành game đầu tiên', 'sudoku', 'games_completed', 1, NULL, 10, 25),
('Speed Demon', 'Hoàn thành Easy dưới 5 phút', 'time', 'best_time', 300, 'easy', 25, 50),
('Streak Master', 'Đạt streak 7 ngày', 'streak', 'streak', 7, NULL, 100, 200),
('Level Up!', 'Đạt level 5', 'level', 'level_reached', 5, NULL, 50, 100),
('Puzzle Expert', 'Hoàn thành 100 games', 'sudoku', 'games_completed', 100, NULL, 500, 1000);

-- Insert level rewards
INSERT INTO public.level_rewards (level, reward_coins, reward_gems) VALUES
(2, 20, 0),
(5, 50, 1),
(10, 100, 2),
(15, 200, 5),
(20, 300, 10);

-- Insert daily rewards (7-day cycle)
INSERT INTO public.daily_rewards (day, reward_coins, reward_gems) VALUES
(1, 10, 0),
(2, 15, 0),
(3, 20, 0),
(4, 25, 1),
(5, 30, 1),
(6, 35, 1),
(7, 50, 2);

-- ========================================
-- ENABLE ROW LEVEL SECURITY (RLS)
-- ========================================

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_pets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_daily_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.currency_transactions ENABLE ROW LEVEL SECURITY;

-- ========================================
-- CREATE RLS POLICIES
-- ========================================

-- User Profiles: Users can only see/modify their own profile
CREATE POLICY "Users can view own profile" ON public.user_profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.user_profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.user_profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- User Items: Users can only see/modify their own items
CREATE POLICY "Users can view own items" ON public.user_items
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own items" ON public.user_items
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own items" ON public.user_items
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- User Pets: Users can only see/modify their own pets
CREATE POLICY "Users can view own pets" ON public.user_pets
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own pets" ON public.user_pets
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own pets" ON public.user_pets
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- User Achievements: Users can only see/modify their own achievements
CREATE POLICY "Users can view own achievements" ON public.user_achievements
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own achievements" ON public.user_achievements
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own achievements" ON public.user_achievements
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- User Daily Rewards: Users can only see/modify their own daily rewards
CREATE POLICY "Users can view own daily rewards" ON public.user_daily_rewards
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own daily rewards" ON public.user_daily_rewards
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own daily rewards" ON public.user_daily_rewards
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Currency Transactions: Users can only see their own transactions
CREATE POLICY "Users can view own currency transactions" ON public.currency_transactions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own currency transactions" ON public.currency_transactions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Public tables (items, pets, achievements, etc.) are readable by all authenticated users
CREATE POLICY "Authenticated users can view items" ON public.items
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can view pets" ON public.pets
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can view achievements" ON public.achievements
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can view level rewards" ON public.level_rewards
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can view daily rewards" ON public.daily_rewards
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can view game rewards" ON public.game_rewards
    FOR SELECT USING (auth.role() = 'authenticated');

-- ========================================
-- CREATE INDEXES FOR PERFORMANCE
-- ========================================

CREATE INDEX idx_user_profiles_id ON public.user_profiles(id);
CREATE INDEX idx_user_items_user_id ON public.user_items(user_id);
CREATE INDEX idx_user_pets_user_id ON public.user_pets(user_id);
CREATE INDEX idx_user_achievements_user_id ON public.user_achievements(user_id);
CREATE INDEX idx_user_daily_rewards_user_id ON public.user_daily_rewards(user_id);

-- ========================================
-- CREATE FUNCTIONS FOR XP/Coin CALCULATIONS
-- ========================================

-- Function to calculate XP needed for a specific level
CREATE OR REPLACE FUNCTION get_xp_needed_for_level(level_num INTEGER)
RETURNS INTEGER AS $$
BEGIN
    -- XP formula: level * 100 + (level-1) * 50
    -- Level 1: 100, Level 2: 250, Level 3: 450, etc.
    RETURN level_num * 100 + (level_num - 1) * 50;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate level and remaining XP from total XP
-- NOTE: Currently not used in main flow, kept for migration/admin tools
CREATE OR REPLACE FUNCTION calculate_level_and_xp(total_xp INTEGER)
RETURNS TABLE(level INTEGER, xp_in_level INTEGER) AS $$
DECLARE
    current_level INTEGER := 1;
    xp_needed INTEGER := 100;
    remaining_xp INTEGER := total_xp;
BEGIN
    WHILE remaining_xp >= xp_needed LOOP
        remaining_xp := remaining_xp - xp_needed;
        current_level := current_level + 1;
        xp_needed := get_xp_needed_for_level(current_level);
    END LOOP;

    RETURN QUERY SELECT current_level, remaining_xp;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- CREATE VIEWS FOR FRONTEND CONVENIENCE
-- ========================================

-- User profile with calculated fields
CREATE OR REPLACE VIEW v_user_profiles AS
SELECT
    up.*,
    get_xp_needed_for_level(up.level) as xp_needed_for_next_level,
    CASE
        WHEN get_xp_needed_for_level(up.level) > 0
        THEN ROUND((up.xp::DECIMAL / get_xp_needed_for_level(up.level)) * 100, 2)
        ELSE 100
    END as level_progress_percentage
FROM public.user_profiles up;

-- User inventory with item details
CREATE OR REPLACE VIEW v_user_inventory AS
SELECT
    ui.*,
    i.name,
    i.description,
    i.type,
    i.rarity,
    i.price_coins,
    i.price_gems
FROM public.user_items ui
JOIN public.items i ON ui.item_id = i.id;

-- User achievements with achievement details
CREATE OR REPLACE VIEW v_user_achievements AS
SELECT
    ua.*,
    a.name,
    a.description,
    a.icon,
    a.category,
    a.reward_coins,
    a.reward_gems,
    a.reward_xp
FROM public.user_achievements ua
JOIN public.achievements a ON ua.achievement_id = a.id;

-- User pets with pet details
CREATE OR REPLACE VIEW v_user_pets AS
SELECT
    up.*,
    p.name,
    p.description,
    p.rarity,
    p.happiness_boost,
    p.luck_boost
FROM public.user_pets up
JOIN public.pets p ON up.pet_id = p.id;

-- ========================================
-- CREATE TRIGGER FUNCTIONS
-- ========================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- NOTE: Currency logging is handled by add_currency_with_log() function
-- No automatic triggers on user_profiles to avoid double-logging
-- All currency changes should go through Edge Functions for consistency

-- Create triggers for updated_at
CREATE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON public.user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- INITIALIZE USER PROFILE ON SIGNUP
-- ========================================

-- Function to create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_profiles (id, username)
    VALUES (NEW.id, NEW.raw_user_meta_data->>'username');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create user profile on signup
CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ========================================
-- UTILITY FUNCTIONS
-- ========================================

-- Function to get current daily reward cycle start date
CREATE OR REPLACE FUNCTION get_current_cycle_start()
RETURNS DATE AS $$
DECLARE
    today DATE := CURRENT_DATE;
    days_since_epoch INTEGER := today - DATE '1970-01-01';
    cycle_length INTEGER := 7;
    cycle_start_offset INTEGER := days_since_epoch % cycle_length;
BEGIN
    RETURN today - cycle_start_offset;
END;
$$ LANGUAGE plpgsql;

-- Function to safely add currency with transaction logging
CREATE OR REPLACE FUNCTION add_currency_with_log(
    p_user_id UUID,
    p_currency_type TEXT,
    p_amount INTEGER,
    p_reason TEXT,
    p_reference_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    current_amount INTEGER;
    new_amount INTEGER;
BEGIN
    -- Validate inputs
    IF p_amount = 0 THEN
        RETURN true; -- No change needed
    END IF;

    IF p_currency_type NOT IN ('coins', 'gems') THEN
        RAISE EXCEPTION 'Invalid currency type: %', p_currency_type;
    END IF;

    -- Get current amount
    EXECUTE format('SELECT %I FROM user_profiles WHERE id = $1', p_currency_type)
    INTO current_amount
    USING p_user_id;

    IF current_amount IS NULL THEN
        RAISE EXCEPTION 'User profile not found';
    END IF;

    -- Calculate new amount
    new_amount := current_amount + p_amount;

    -- Prevent negative currency
    IF new_amount < 0 THEN
        RAISE EXCEPTION 'Insufficient %: has %, needs %', p_currency_type, current_amount, abs(p_amount);
    END IF;

    -- Update user profile
    EXECUTE format('UPDATE user_profiles SET %I = $1 WHERE id = $2', p_currency_type)
    USING new_amount, p_user_id;

    -- Log transaction
    INSERT INTO currency_transactions (user_id, currency_type, amount, reason, reference_id)
    VALUES (p_user_id, p_currency_type, p_amount, p_reason, p_reference_id);

    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
