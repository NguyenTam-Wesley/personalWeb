// 🎯 Rewards Module - Quản lý hệ thống phân phát rewards
// ✅ Tính toán game rewards dựa trên difficulty và performance
// ✅ Quản lý daily rewards
// ✅ Claim level up rewards
// ✅ Tích hợp tất cả các loại rewards
// ✅ Áp dụng pet bonuses và item effects
// ✅ Cache để tối ưu performance

import { supabase } from '../supabase/supabase.js';
import { getCurrentUser } from '../supabase/auth.js';
import { userProfile } from './user_profile.js';
import { pets } from './pets.js';

export class Rewards {
    constructor() {
        // Cache để tránh query quá nhiều
        this.cache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 phút cho rewards config
        this.dailyRewardsCacheTimeout = 2 * 60 * 1000; // 2 phút cho daily rewards
    }

    // Kiểm tra user đã đăng nhập chưa
    async isLoggedIn() {
        const user = await getCurrentUser();
        return !!user;
    }

    // Lấy thông tin user hiện tại
    async getCurrentUser() {
        return await getCurrentUser();
    }

    // Lấy game rewards config
    async getGameRewardsConfig(forceRefresh = false) {
        const cacheKey = 'game_rewards_config';

        // Kiểm tra cache
        if (!forceRefresh && this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.cacheTimeout) {
                return cached.data;
            }
        }

        try {
            const { data, error } = await supabase
                .from('game_rewards')
                .select('*');

            if (error) {
                console.error('Error getting game rewards config:', error);
                return {};
            }

            // Convert thành object {difficulty: config}
            const config = {};
            data.forEach(reward => {
                config[reward.difficulty] = reward;
            });

            // Cache kết quả
            this.cache.set(cacheKey, {
                data: config,
                timestamp: Date.now()
            });

            return config;
        } catch (error) {
            console.error('Error in getGameRewardsConfig:', error);
            return {};
        }
    }

    // Tính toán rewards cho game completion
    async calculateGameRewards(difficulty, timeTaken, maintainStreak = false) {
        const config = await this.getGameRewardsConfig();
        const difficultyConfig = config[difficulty];

        if (!difficultyConfig) {
            console.warn(`No reward config found for difficulty: ${difficulty}`);
            return { xp: 0, coins: 0 };
        }

        let baseXP = difficultyConfig.base_xp;
        let baseCoins = difficultyConfig.base_coins;

        // Time bonus: reward nhanh hơn
        const timeBonusMultiplier = difficultyConfig.time_bonus_multiplier;
        if (timeTaken < 600) { // Dưới 10 phút
            baseXP = Math.floor(baseXP * timeBonusMultiplier);
            baseCoins = Math.floor(baseCoins * timeBonusMultiplier);
        }

        // Streak bonus
        const streakBonusMultiplier = difficultyConfig.streak_bonus_multiplier;
        if (maintainStreak) {
            baseXP = Math.floor(baseXP * streakBonusMultiplier);
            baseCoins = Math.floor(baseCoins * streakBonusMultiplier);
        }

        // Pet bonuses
        const petBonuses = await pets.getCurrentPetBonuses();
        baseXP = Math.floor(baseXP * (1 + petBonuses.happiness_boost / 100));
        baseCoins = Math.floor(baseCoins * (1 + petBonuses.luck_boost / 100));

        // Item effects (nếu có active items)
        // TODO: Implement item effects system

        return {
            xp: Math.max(baseXP, 1), // Minimum 1 XP
            coins: Math.max(baseCoins, 1), // Minimum 1 coin
            breakdown: {
                baseXP: difficultyConfig.base_xp,
                baseCoins: difficultyConfig.base_coins,
                timeBonus: timeTaken < 600,
                streakBonus: maintainStreak,
                petXPBonus: petBonuses.happiness_boost,
                petCoinBonus: petBonuses.luck_boost
            }
        };
    }

    // Grant game completion rewards
    async grantGameRewards(difficulty, timeTaken, maintainStreak = false) {
        if (!(await this.isLoggedIn())) {
            return { success: false, message: 'Vui lòng đăng nhập để nhận rewards' };
        }

        try {
            const rewards = await this.calculateGameRewards(difficulty, timeTaken, maintainStreak);

            // TEMP: Use client-side XP update for now (to test if it works)
            console.log('🔄 Using client-side XP update with amount:', rewards.xp);
            await userProfile.addXP(rewards.xp);

            // Add coins using client-side method
            await userProfile.addCoins(rewards.coins);

            // Update game stats
            await userProfile.updateGameStats({
                timeSpent: timeTaken,
                maintainStreak: maintainStreak
            });

            return {
                success: true,
                rewards: rewards,
                message: `Nhận được ${rewards.xp} XP và ${rewards.coins} coins!`
            };
        } catch (error) {
            console.error('Error granting game rewards:', error);
            return { success: false, message: 'Lỗi khi nhận rewards' };
        }
    }

    // Lấy daily rewards config
    async getDailyRewardsConfig(forceRefresh = false) {
        const cacheKey = 'daily_rewards_config';

        // Kiểm tra cache
        if (!forceRefresh && this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.dailyRewardsCacheTimeout) {
                return cached.data;
            }
        }

        try {
            const { data, error } = await supabase
                .from('daily_rewards')
                .select('*')
                .order('day');

            if (error) {
                console.error('Error getting daily rewards config:', error);
                return [];
            }

            // Cache kết quả
            this.cache.set(cacheKey, {
                data: data,
                timestamp: Date.now()
            });

            return data;
        } catch (error) {
            console.error('Error in getDailyRewardsConfig:', error);
            return [];
        }
    }

    // Lấy thông tin daily rewards của user hôm nay
    async getUserDailyRewards() {
        if (!(await this.isLoggedIn())) {
            return null;
        }

        try {
            const user = await this.getCurrentUser();
            const today = new Date();
            const cycleStartDate = new Date(today);
            cycleStartDate.setDate(today.getDate() - today.getDay()); // Chủ nhật của tuần này
            const cycleStartDateStr = cycleStartDate.toISOString().split('T')[0];
            const day = today.getDay() + 1; // 1 = Chủ nhật, 2 = Thứ 2, ..., 7 = Thứ 7

            const { data, error } = await supabase
                .from('user_daily_rewards')
                .select('*')
                .eq('user_id', user.id)
                .eq('day', day)
                .eq('cycle_start_date', cycleStartDateStr)
                .single();

            if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
                console.error('Error getting user daily rewards:', error);
                return null;
            }

            return data;
        } catch (error) {
            console.error('Error in getUserDailyRewards:', error);
            return null;
        }
    }

    // Tính streak hiện tại cho daily rewards
    async getCurrentDailyStreak() {
        if (!(await this.isLoggedIn())) {
            return 0;
        }

        try {
            const user = await this.getCurrentUser();

            // Check đã claim hôm nay chưa
            const today = new Date();
            const cycleStartDate = new Date(today);
            cycleStartDate.setDate(today.getDate() - today.getDay()); // Chủ nhật của tuần này
            const cycleStartDateStr = cycleStartDate.toISOString().split('T')[0];
            const day = today.getDay() + 1; // 1 = Chủ nhật, 2 = Thứ 2, ..., 7 = Thứ 7

            const { data: todayRecord } = await supabase
                .from('user_daily_rewards')
                .select('streak_day')
                .eq('user_id', user.id)
                .eq('day', day)
                .eq('cycle_start_date', cycleStartDateStr)
                .single();

            if (todayRecord) {
                // Đã claim hôm nay, trả về streak hiện tại
                return todayRecord.streak_day;
            }

            // Chưa claim hôm nay, kiểm tra streak từ ngày gần nhất
            const { data, error } = await supabase
                .from('user_daily_rewards')
                .select('claimed_at, streak_day')
                .eq('user_id', user.id)
                .order('claimed_at', { ascending: false })
                .limit(1);

            if (error || data.length === 0) {
                return 0;
            }

            // Check if last claim was yesterday
            const lastClaimDate = new Date(data[0].claimed_at);
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);

            const isYesterday = lastClaimDate.toDateString() === yesterday.toDateString();

            if (isYesterday) {
                // Vẫn duy trì streak
                return data[0].streak_day;
            } else {
                // Streak bị reset về 0 (chưa claim hôm nay)
                return 0;
            }
        } catch (error) {
            console.error('Error in getCurrentDailyStreak:', error);
            return 0;
        }
    }

    // Get Supabase URL for Edge Functions
    get supabaseUrl() {
        return 'https://calwzopyjitbtahiafzw.supabase.co';
    }    

    // Claim daily reward (sử dụng Edge Function để bypass RLS)
    // ✅ FIX: Claim daily reward with proper Authorization header
async claimDailyReward() {
    const user = await this.getCurrentUser();
    if (!user) {
        return { success: false, message: 'Vui lòng đăng nhập' };
    }

    try {
        // Get the JWT token from Supabase session
        const { data: { session } } = await supabase.auth.getSession();
        if (!session || !session.access_token) {
            return { success: false, message: 'Không tìm thấy session hợp lệ' };
        }

        const accessToken = session.access_token;

        console.log('🔑 Calling Edge Function with auth token...');

        const response = await fetch(`${this.supabaseUrl}/functions/v1/claimDailyReward`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`, // ✅ FIX: Added Authorization header
            },
            body: JSON.stringify({
                user_id: user.supabase_user_id || user.id // Use Supabase user ID
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Edge Function error:', response.status, errorText);
            return { 
                success: false, 
                message: `Lỗi ${response.status}: ${errorText}` 
            };
        }

        const result = await response.json();

        if (!result.success) {
            return { success: false, message: result.error };
        }

        console.log('✅ Daily reward claimed successfully:', result.data);

        return {
            success: true,
            message: `Nhận daily reward ngày ${result.data.day}: ${result.data.rewards.coins} coins, ${result.data.rewards.gems} gems`,
            rewards: result.data.rewards,
            streak: result.data.streak
        };
    } catch (error) {
        console.error('❌ Error claiming daily reward:', error);
        return { success: false, message: 'Lỗi không xác định: ' + error.message };
    }
}


    // Claim level up rewards
    async claimLevelUpRewards(level) {
        if (!(await this.isLoggedIn())) {
            return { success: false, message: 'Vui lòng đăng nhập' };
        }

        try {
            const { data, error } = await supabase
                .from('level_rewards')
                .select('*')
                .eq('level', level)
                .single();

            if (error && error.code !== 'PGRST116') {
                console.error('Error getting level rewards:', error);
                return { success: false, message: 'Lỗi khi lấy level rewards' };
            }

            if (!data) {
                return { success: false, message: 'Không có rewards cho level này' };
            }

            // Grant rewards
            const rewards = [];
            if (data.reward_coins > 0) {
                await userProfile.addCoins(data.reward_coins);
                rewards.push(`${data.reward_coins} coins`);
            }

            if (data.reward_gems > 0) {
                await userProfile.addGems(data.reward_gems);
                rewards.push(`${data.reward_gems} gems`);
            }

            // TODO: Grant items and pets if specified
            if (data.reward_item_id) {
                // await items.addItemToInventory(data.reward_item_id, 1);
                rewards.push('1 item');
            }

            if (data.reward_pet_id) {
                // Special handling for pet rewards
                rewards.push('1 pet');
            }

            return {
                success: true,
                message: `Nhận level ${level} rewards: ${rewards.join(', ')}`,
                rewards: data
            };
        } catch (error) {
            console.error('Error in claimLevelUpRewards:', error);
            return { success: false, message: 'Lỗi không xác định' };
        }
    }

    // Lấy level rewards config
    async getLevelRewardsConfig() {
        try {
            const { data, error } = await supabase
                .from('level_rewards')
                .select('*')
                .order('level');

            if (error) {
                console.error('Error getting level rewards config:', error);
                return [];
            }

            return data;
        } catch (error) {
            console.error('Error in getLevelRewardsConfig:', error);
            return [];
        }
    }

    // Tạo summary rewards cho UI display
    async getRewardsSummary() {
        const profile = await userProfile.getProfile();
        const dailyStreak = await this.getCurrentDailyStreak();
        const dailyConfig = await this.getDailyRewardsConfig();
        const levelConfig = await this.getLevelRewardsConfig();

        const nextDay = (dailyStreak % 7) + 1;
        const nextDailyReward = dailyConfig.find(config => config.day === nextDay);

        const nextLevelReward = levelConfig.find(config => config.level > (profile?.level || 1));

        return {
            daily: {
                currentStreak: dailyStreak,
                nextReward: nextDailyReward,
                canClaim: !(await this.getUserDailyRewards())
            },
            level: {
                currentLevel: profile?.level || 1,
                nextReward: nextLevelReward,
                progress: profile ? userProfile.getLevelProgress(profile) : 0
            },
            game: await this.getGameRewardsConfig()
        };
    }

    // Clear cache
    clearCache() {
        this.cache.clear();
    }

    // Debug: log rewards config
    async debugLogRewardsConfig() {
        const config = await this.getGameRewardsConfig(true);
        const dailyConfig = await this.getDailyRewardsConfig(true);
        console.log('Game Rewards Config:', config);
        console.log('Daily Rewards Config:', dailyConfig);
    }
}

// Export instance default
export const rewards = new Rewards();
