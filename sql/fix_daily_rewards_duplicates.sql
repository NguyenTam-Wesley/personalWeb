-- ========================================
-- FIX DAILY REWARDS DUPLICATES & CONSTRAINT
-- ========================================
-- Run this in Supabase SQL Editor to fix the 406 Not Acceptable error

-- 1. First, remove duplicate records (keep the most recent one)
-- This query keeps the record with the highest ID for each (user_id, day, cycle_start_date)
DELETE FROM public.user_daily_rewards a
USING public.user_daily_rewards b
WHERE a.id < b.id
  AND a.user_id = b.user_id
  AND a.day = b.day
  AND a.cycle_start_date = b.cycle_start_date;

-- 2. Add the UNIQUE constraint (should already exist from schema, but ensure it)
-- This will fail if duplicates still exist, which is good - it tells us we need to clean more
DO $$
BEGIN
    -- Check if constraint already exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'user_daily_rewards_user_id_day_cycle_start_date_key'
        AND table_name = 'user_daily_rewards'
    ) THEN
        -- Add the constraint
        ALTER TABLE public.user_daily_rewards
        ADD CONSTRAINT user_daily_rewards_user_id_day_cycle_start_date_key
        UNIQUE (user_id, day, cycle_start_date);
    END IF;
END $$;

-- 3. Verify the constraint is in place
SELECT
    tc.constraint_name,
    tc.table_name,
    kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_name = 'user_daily_rewards'
    AND tc.constraint_type = 'UNIQUE';
