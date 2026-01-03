// 🎯 Rewards Module - Quản lý hệ thống phân phát rewards
// ✅ Tính toán game rewards dựa trên difficulty và performance
// ✅ Quản lý daily rewards
// ✅ Claim level up rewards
// ✅ Tích hợp tất cả các loại rewards
// ✅ Áp dụng pet bonuses và item effects
// ✅ Cache để tối ưu performance

import { supabase } from '../supabase/supabase.js';
import { getAuthUser } from '../supabase/auth.js';
import { userProfile } from './user_profile.js';
import { pets } from './pets.js';
import { items } from './items.js';

export class Rewards {
    constructor() {
        // Structured caching with different TTLs
        this.cache = {
            config: new Map(), // Long TTL for game/daily configs
            userState: new Map(), // Short TTL for user-specific data
        };
        this.cacheTimeout = {
            config: 5 * 60 * 1000, // 5 minutes for configs
            userState: 2 * 60 * 1000, // 2 minutes for user state
        };
    }

    // Kiểm tra user đã đăng nhập chưa (kiểm tra AUTH USER UUID)
    async isLoggedIn() {
        console.log('🔐 Checking login status in rewards.isLoggedIn()...');
        const authUser = await getAuthUser();
        console.log('🔐 Auth user UUID:', authUser?.id || 'NULL');
        const result = !!(authUser?.id);
        console.log('🔐 isLoggedIn result:', result);
        return result;
    }

    // Lấy thông tin AUTH USER hiện tại (có UUID)
    async getCurrentUser() {
        return await getAuthUser();
    }

    // Helper: Execute callback with authenticated user
    async withUser(callback) {
        const user = await this.getCurrentUser();
        if (!user) {
            throw new Error('Vui lòng đăng nhập để thực hiện thao tác này');
        }
        return callback(user);
    }

    // Cache helper methods
    getCached(cacheType, key) {
        const cache = this.cache[cacheType];
        if (!cache.has(key)) return null;

        const cached = cache.get(key);
        const ttl = this.cacheTimeout[cacheType];
        if (Date.now() - cached.timestamp > ttl) {
            cache.delete(key);
            return null;
        }
        return cached.data;
    }

    setCached(cacheType, key, data) {
        this.cache[cacheType].set(key, {
            data: data,
            timestamp: Date.now()
        });
    }

    invalidateUserCache(authUserId) {
        // 🛡️ CHẶN CACHE: Không có UUID → không invalidate
        if (!authUserId) {
            console.log('[Rewards] No auth user ID, skip cache invalidation');
            return;
        }

        const userKeys = [
            `daily_rewards_${authUserId}`,
            `streak_${authUserId}`,
            `user_daily_${authUserId}`
        ];
        console.log('[Rewards] Invalidating cache for UUID:', authUserId, userKeys);
        userKeys.forEach(key => this.cache.userState.delete(key));
    }

    invalidateConfigCache() {
        this.cache.config.clear();
    }

    // Lấy game rewards config
    async getGameRewardsConfig(forceRefresh = false) {
        const cacheKey = 'game_rewards_config';

        if (!forceRefresh) {
            const cached = this.getCached('config', cacheKey);
            if (cached) return cached;
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

            this.setCached('config', cacheKey, config);
            return config;
        } catch (error) {
            console.error('Error in getGameRewardsConfig:', error);
            return {};
        }
    }

    // Tính toán rewards cho game completion
    async calculateGameRewards(difficulty, timeTaken, _maintainStreak = false) {
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

        // Pet bonuses
        const petBonuses = await pets.getCurrentPetBonuses();
        baseXP = Math.floor(baseXP * (1 + petBonuses.happiness_boost / 100));
        baseCoins = Math.floor(baseCoins * (1 + petBonuses.luck_boost / 100));

        // Item effects (active effects from consumable items)
        const activeEffects = await items.getCurrentActiveEffects();
        let xpBoost = 0;
        let coinBoost = 0;

        activeEffects.forEach(effect => {
            if (effect.effect_type === 'xp_boost') {
                xpBoost += effect.value;
            } else if (effect.effect_type === 'coin_boost') {
                coinBoost += effect.value;
            }
        });

        baseXP = Math.floor(baseXP * (1 + xpBoost / 100));
        baseCoins = Math.floor(baseCoins * (1 + coinBoost / 100));

        return {
            xp: Math.max(baseXP, 1), // Minimum 1 XP
            coins: Math.max(baseCoins, 1), // Minimum 1 coin
            breakdown: {
                baseXP: difficultyConfig.base_xp,
                baseCoins: difficultyConfig.base_coins,
                timeBonus: timeTaken < 600,
                streakBonus: false, // Removed streak bonus
                petXPBonus: petBonuses.happiness_boost,
                petCoinBonus: petBonuses.luck_boost,
                itemXPBoost: xpBoost,
                itemCoinBoost: coinBoost
            }
        };
    }

    // Grant game completion rewards
    async grantGameRewards(difficulty, timeTaken, maintainStreak = false) {
        try {
            return await this.withUser(async (_user) => {
                const rewards = await this.calculateGameRewards(difficulty, timeTaken, maintainStreak);

                // Grant XP reward
                await userProfile.addXP(rewards.xp);

                // Add coins using client-side method
                await userProfile.addCoins(rewards.coins);

                // Update game stats (without streak tracking)
                await userProfile.updateGameStats({
                    timeSpent: timeTaken,
                    maintainStreak: false // No longer track streak
                });

                return {
                    success: true,
                    rewards: rewards,
                    message: `Nhận được ${rewards.xp} XP và ${rewards.coins} coins!`
                };
            });
        } catch (error) {
            console.error('Error granting game rewards:', error);
            return { success: false, message: error.message || 'Lỗi khi nhận rewards' };
        }
    }

    // Lấy daily rewards config
    async getDailyRewardsConfig(forceRefresh = false) {
        const cacheKey = 'daily_rewards_config';

        if (!forceRefresh) {
            const cached = this.getCached('config', cacheKey);
            if (cached) return cached;
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

            this.setCached('config', cacheKey, data);
            return data;
        } catch (error) {
            console.error('Error in getDailyRewardsConfig:', error);
            return [];
        }
    }

    // Helper: Get today's date in UTC (timezone-safe)
    getTodayUTC() {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    }

    // Helper: Get cycle start date (Sunday of current week) in UTC
    getCycleStartDate(today) {
        const cycleStart = new Date(today);
        const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
        cycleStart.setDate(today.getDate() - dayOfWeek);
        return cycleStart;
    }

    // Helper: Get day number (1 = Sunday, 2 = Monday, ..., 7 = Saturday)
    getDayNumber(date) {
        return date.getDay() + 1; // Convert to 1-7 range
    }

    // Lấy thông tin daily rewards của user hôm nay
    async getUserDailyRewards() {
        try {
            const authUser = await getAuthUser();

            // 🛡️ CHẶN QUERY SỚM: Không có UUID → không query
            if (!authUser?.id) {
                console.log('[Rewards] Auth user not ready, skip getUserDailyRewards');
                return null;
            }

            const today = this.getTodayUTC();
            const cycleStartDate = this.getCycleStartDate(today);
            const cycleStartDateStr = cycleStartDate.toISOString().split('T')[0];
            const day = this.getDayNumber(today);

            console.log('[Rewards] Querying daily rewards for UUID:', authUser.id);

            const { data, error } = await supabase
                .from('user_daily_rewards')
                .select('*')
                .eq('user_id', authUser.id)
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

    // Helper: Check if user has claimed reward today
    async getTodayStreakIfClaimed(authUser) {
        // 🛡️ CHẶN QUERY SỚM: Không có UUID → không query
        if (!authUser?.id) {
            console.log('[Rewards] Auth user not ready, skip getTodayStreakIfClaimed');
            return null;
        }

        const today = this.getTodayUTC();
        const cycleStartDate = this.getCycleStartDate(today);
        const cycleStartDateStr = cycleStartDate.toISOString().split('T')[0];
        const day = this.getDayNumber(today);

        console.log('[Rewards] Querying today streak for UUID:', authUser.id);

        const { data: todayRecord } = await supabase
            .from('user_daily_rewards')
            .select('streak_day')
            .eq('user_id', authUser.id)
            .eq('day', day)
            .eq('cycle_start_date', cycleStartDateStr)
            .single();

        return todayRecord ? todayRecord.streak_day : null;
    }

    // Helper: Calculate streak from last claim
    async calculateStreakFromLastClaim(authUser) {
        // 🛡️ CHẶN QUERY SỚM: Không có UUID → không query
        if (!authUser?.id) {
            console.log('[Rewards] Auth user not ready, skip calculateStreakFromLastClaim');
            return 0;
        }

        console.log('[Rewards] Querying streak history for UUID:', authUser.id);

        const { data, error } = await supabase
            .from('user_daily_rewards')
            .select('claimed_at, streak_day')
            .eq('user_id', authUser.id)
            .order('claimed_at', { ascending: false })
            .limit(1);

        if (error || data.length === 0) {
            return 0;
        }

        // Check if last claim was yesterday (timezone-safe)
        const lastClaimDate = new Date(data[0].claimed_at);
        const today = this.getTodayUTC();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        const lastClaimUTC = new Date(lastClaimDate.getFullYear(), lastClaimDate.getMonth(), lastClaimDate.getDate());
        const yesterdayUTC = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());

        const isYesterday = lastClaimUTC.getTime() === yesterdayUTC.getTime();

        return isYesterday ? data[0].streak_day : 0;
    }

    // Tính streak hiện tại cho daily rewards
    async getCurrentDailyStreak() {
        try {
            const authUser = await getAuthUser();

            // 🛡️ CHẶN QUERY SỚM: Không có UUID → không query
            if (!authUser?.id) {
                console.log('[Rewards] Auth user not ready, skip getCurrentDailyStreak');
                return 0;
            }

            console.log('[Rewards] Calculating streak for UUID:', authUser.id);

            // Check if already claimed today
            const todayStreak = await this.getTodayStreakIfClaimed(authUser);
            if (todayStreak !== null) {
                return todayStreak;
            }

            // Calculate streak from last claim
            return await this.calculateStreakFromLastClaim(authUser);
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
    const authUser = await getAuthUser();
    if (!authUser?.id) {
        return { success: false, message: 'Vui lòng đăng nhập' };
    }

    try {
        // Get the JWT token from Supabase session
        const { data: { session } } = await supabase.auth.getSession();
        if (!session || !session.access_token) {
            return { success: false, message: 'Không tìm thấy session hợp lệ' };
        }

        const accessToken = session.access_token;

        console.log('🔑 Calling Edge Function with auth token for UUID:', authUser.id);

        const response = await fetch(`${this.supabaseUrl}/functions/v1/claimDailyReward`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`, // ✅ FIX: Added Authorization header
            },
            body: JSON.stringify({
                user_id: authUser.id // Use auth user UUID directly
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

        // Invalidate user cache after successful claim
        this.invalidateDailyRewardCache(authUser.id);

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
        try {
            return await this.withUser(async (_user) => {
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

                if (data.reward_item_id) {
                    // Grant item reward
                    const itemAdded = await items.addItemToInventory(data.reward_item_id, 1);
                    if (itemAdded) {
                        rewards.push('1 item');
                    }
                }

                if (data.reward_pet_id) {
                    // Grant pet reward
                    const petGranted = await pets.addPetToUser(data.reward_pet_id);
                    if (petGranted) {
                        rewards.push('1 pet');
                    }
                }

                return {
                    success: true,
                    message: `Nhận level ${level} rewards: ${rewards.join(', ')}`,
                    rewards: data
                };
            });
        } catch (error) {
            console.error('Error in claimLevelUpRewards:', error);
            return { success: false, message: error.message || 'Lỗi không xác định' };
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

    // Add XP directly (for 2048 game)
    async addXP(amount, reason = 'game_completion', referenceId = null) {
        const authUser = await getAuthUser();
        if (!authUser?.id) {
            throw new Error('User not logged in');
        }
        const result = await userProfile.addXP(amount, reason, referenceId);
        if (!result) {
            throw new Error('Failed to add XP');
        }
        return result;
    }

    // Add coins directly (for 2048 game)
    async addCoins(amount) {
        const authUser = await getAuthUser();
        if (!authUser?.id) {
            throw new Error('User not logged in');
        }
        const result = await userProfile.addCoins(amount);
        if (result === false) {
            throw new Error('Failed to add coins');
        }
        return true;
    }

    // Add gems directly (for 2048 game)
    async addGems(amount) {
        const authUser = await getAuthUser();
        if (!authUser?.id) {
            throw new Error('User not logged in');
        }
        const result = await userProfile.addGems(amount);
        if (result === false) {
            throw new Error('Failed to add gems');
        }
        return true;
    }

    // Clear cache (invalidate all)
    clearCache() {
        this.cache.config.clear();
        this.cache.userState.clear();
    }

    // Invalidate cache after claiming daily reward
    invalidateDailyRewardCache(userId) {
        this.invalidateUserCache(userId);
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
