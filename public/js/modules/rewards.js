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
            config: 3 * 60 * 1000, // 5 minutes for configs
            userState: 1 * 60 * 1000, // 2 minutes for user state
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



    // 🎯 Calculate game rewards using RPC (preview without applying)
    // sessionId: UUID of the game session
    async calculateGameRewards(sessionId) {
        try {
            const result = await this.calculateRewardsForSession(sessionId);
            return {
                xp_gained: result.xp_gained,
                coins_gained: result.coins_gained,
                gems_gained: result.gems_gained,
                multipliers: result.multipliers,
                buffs: result.buffs
            };
        } catch (error) {
            console.error('Error calculating game rewards:', error);
            return {
                xp_gained: 0,
                coins_gained: 0,
                gems_gained: 0,
                multipliers: { xp: 1.0, coin: 1.0 },
                buffs: null
            };
        }
    }

    // Get active user buffs for display
    async getActiveBuffs() {
        try {
            const authUser = await getAuthUser();
            if (!authUser?.id) {
                return [];
            }

            const { data, error } = await supabase
                .from('user_buffs')
                .select(`
                    id,
                    buff_id,
                    is_active,
                    expires_at,
                    remaining_uses,
                    source_type,
                    buffs (
                        id,
                        name,
                        description,
                        target,
                        effect_type,
                        value,
                        icon_url
                    )
                `)
                .eq('user_id', authUser.id)
                .eq('is_active', true);

            if (error) {
                console.error('Error getting active buffs:', error);
                return [];
            }

            // Filter buffs based on RPC logic:
            // - pet: is_active = true
            // - item/event: (expires_at is null or > now) AND (remaining_uses is null or > 0)
            const now = new Date();
            const activeBuffs = data.filter(buff => {
                if (buff.source_type === 'pet') {
                    return buff.is_active;
                } else {
                    // item or event
                    const notExpired = !buff.expires_at || new Date(buff.expires_at) > now;
                    const hasUses = buff.remaining_uses === null || buff.remaining_uses > 0;
                    return buff.is_active && notExpired && hasUses;
                }
            });

            return activeBuffs;
        } catch (error) {
            console.error('Error in getActiveBuffs:', error);
            return [];
        }
    }

    // 🎯 Grant game rewards using RPC
    // sessionId: UUID of the game session
    async grantGameRewards(sessionId) {
        try {
            return await this.withUser(async (_user) => {
                const result = await this.calculateRewardsForSession(sessionId);

                if (!result.success) {
                    return { success: false, message: 'Failed to calculate rewards' };
                }

                return {
                    success: true,
                    rewards: {
                        xp: result.xp_gained,
                        coins: result.coins_gained,
                        gems: result.gems_gained
                    },
                    buffs: result.buffs,
                    message: `Nhận được ${result.xp_gained} XP, ${result.coins_gained} coins, ${result.gems_gained} gems!`
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
        const activeBuffs = await this.getActiveBuffs();

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
            buffs: {
                active: activeBuffs,
                count: activeBuffs.length
            }
        };
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

    // 🎁 Calculate and apply rewards for a game session using RPC
    async calculateRewardsForSession(sessionId) {
        return await this.withUser(async (_user) => {
            console.log('🎁 Calculating rewards for session:', sessionId);

            try {
                const { data, error } = await supabase.rpc('calc_reward_tx', {
                    p_game_session_id: sessionId
                });

                if (error) {
                    console.error('❌ Failed to calculate rewards:', error);
                    throw new Error(`Failed to calculate rewards: ${error.message}`);
                }

                if (!data || !data.success) {
                    console.error('❌ RPC returned unsuccessful result:', data);
                    throw new Error(data?.error || 'RPC calculation failed');
                }

                console.log('✅ Rewards calculated and applied:', data);

                // Return the full result from RPC including buffs breakdown
                return {
                    success: data.success,
                    user_id: data.user_id,
                    mode_id: data.mode_id,
                    xp_gained: data.xp_gained,
                    coins_gained: data.coins_gained,
                    gems_gained: data.gems_gained,
                    buffs: data.buffs,
                    multipliers: {
                        xp: data.buffs?.xp?.multiplier || 1.0,
                        coin: data.buffs?.coin?.multiplier || 1.0
                    }
                };

            } catch (error) {
                console.error('❌ Error in calculateRewardsForSession:', error);
                throw error;
            }
        });
    }

    // Debug: log rewards config and active buffs
    async debugLogRewardsConfig() {
        const dailyConfig = await this.getDailyRewardsConfig(true);
        const activeBuffs = await this.getActiveBuffs();

        console.log('Daily Rewards Config:', dailyConfig);
        console.log('Active Buffs:', activeBuffs);

        // Log buff effects summary
        const buffEffects = this.calculateBuffEffects(activeBuffs);
        console.log('Buff Effects Summary:', buffEffects);
    }

    // Helper: Calculate total buff effects for display
    calculateBuffEffects(activeBuffs) {
        let xpMultiplier = 1.0;
        let coinMultiplier = 1.0;
        let xpAdd = 0;
        let coinAdd = 0;
        let gemAdd = 0;

        activeBuffs.forEach(buff => {
            const effect = buff.buffs;
            if (!effect) return;

            const { target, effect_type, value } = effect;

            if (effect_type === 'multiplier') {
                if (target === 'xp') {
                    xpMultiplier *= value;
                } else if (target === 'coin') {
                    coinMultiplier *= value;
                }
            } else if (effect_type === 'flat') {
                if (target === 'xp') {
                    xpAdd += value;
                } else if (target === 'coin') {
                    coinAdd += value;
                } else if (target === 'gem') {
                    gemAdd += value;
                }
            }
        });

        return {
            xp: { multiplier: xpMultiplier, add: xpAdd },
            coin: { multiplier: coinMultiplier, add: coinAdd },
            gem: { add: gemAdd }
        };
    }
}

// Export instance default
export const rewards = new Rewards();
