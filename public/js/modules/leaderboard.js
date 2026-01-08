import { supabase } from '../supabase/supabase.js';
import { getAuthUser } from '../supabase/auth.js';

export class Leaderboard {
    constructor() {
        // Cache cho leaderboard data
        this.cache = {
            leaderboard: new Map(), // Cache leaderboard theo game/mode
            userBest: new Map()     // Cache best score của user
        };
        this.cacheTimeout = {
            leaderboard: 5 * 60 * 1000, // 5 phút cho leaderboard
            userBest: 2 * 60 * 1000     // 2 phút cho user best score
        };
    }

    // Cache helpers
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

    invalidateLeaderboardCache(gameCode, modeCode) {
        const key = `${gameCode}_${modeCode}`;
        this.cache.leaderboard.delete(key);
    }

    invalidateUserCache(userId, gameCode, modeCode) {
        const key = `${userId}_${gameCode}_${modeCode}`;
        this.cache.userBest.delete(key);
    }

    // 🎯 Cập nhật leaderboard từ game session
    // Sử dụng RPC update_leaderboard
    async updateLeaderboard(sessionId) {
        try {
            console.log('🏆 Updating leaderboard for session:', sessionId);

            const { data, error } = await supabase.rpc('update_leaderboard', {
                p_game_session_id: sessionId
            });

            if (error) {
                console.error('❌ Failed to update leaderboard:', error);
                throw new Error(`Failed to update leaderboard: ${error.message}`);
            }

            console.log('✅ Leaderboard updated:', data);

            // Invalidate cache dựa trên kết quả
            if (data.success && data.is_new_record) {
                console.log('🎯 New record detected - clearing all caches');
                // Nếu là new record, clear all cache để đảm bảo data mới nhất
                this.cache.leaderboard.clear();
                this.cache.userBest.clear();
            } else {
                console.log('📊 Score updated but not a new record - clearing leaderboard cache only');
                // Nếu không phải new record, chỉ cần clear leaderboard cache
                this.cache.leaderboard.clear();
            }

            return data;

        } catch (error) {
            console.error('❌ Error in updateLeaderboard:', error);
            throw error;
        }
    }

    // 🎯 Lấy leaderboard cho một game/mode
    async getLeaderboard(gameCode, modeCode, limit = 10) {
        const cacheKey = `${gameCode}_${modeCode}_${limit}`;

        // Check cache first
        const cached = this.getCached('leaderboard', cacheKey);
        if (cached) return cached;

        try {
            console.log('📊 Fetching leaderboard:', { gameCode, modeCode, limit });

            const { data, error } = await supabase
                .rpc('get_leaderboard', {
                    p_game_code: gameCode,
                    p_mode_code: modeCode,
                    p_limit: limit
                });

            if (error) {
                console.error('❌ Failed to get leaderboard:', error);
                throw new Error(`Failed to get leaderboard: ${error.message}`);
            }

            console.log('✅ Leaderboard loaded:', data?.length || 0, 'entries');

            // Cache result
            this.setCached('leaderboard', cacheKey, data || []);

            return data || [];

        } catch (error) {
            console.error('❌ Error in getLeaderboard:', error);
            throw error;
        }
    }

    // 🎯 Lấy best score của user cho một game/mode
    async getUserBestScore(userId, gameCode, modeCode) {
        const cacheKey = `${userId}_${gameCode}_${modeCode}`;

        // Check cache first
        const cached = this.getCached('userBest', cacheKey);
        if (cached) return cached;

        try {
            console.log('👤 Fetching user best score:', { userId, gameCode, modeCode });

            const { data, error } = await supabase
                .from('v_user_best_scores')
                .select('*')
                .eq('user_id', userId)
                .eq('game_code', gameCode)
                .eq('mode_code', modeCode)
                .maybeSingle();

            if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
                console.error('❌ Failed to get user best score:', error);
                throw new Error(`Failed to get user best score: ${error.message}`);
            }

            console.log('✅ User best score loaded:', data);

            // Cache result (even if null)
            this.setCached('userBest', cacheKey, data);

            return data;

        } catch (error) {
            console.error('❌ Error in getUserBestScore:', error);
            throw error;
        }
    }

    // 🎯 Lấy leaderboard với thông tin user hiện tại
    async getLeaderboardWithCurrentUser(gameCode, modeCode, limit = 10) {
        try {
            const authUser = await getAuthUser();
            if (!authUser?.id) {
                // Nếu không có user, chỉ trả về leaderboard thường
                return await this.getLeaderboard(gameCode, modeCode, limit);
            }

            // Lấy leaderboard và best score của user song song
            const [leaderboard, userBest] = await Promise.all([
                this.getLeaderboard(gameCode, modeCode, limit),
                this.getUserBestScore(authUser.id, gameCode, modeCode)
            ]);

            return {
                leaderboard,
                userBest,
                currentUserId: authUser.id
            };

        } catch (error) {
            console.error('❌ Error in getLeaderboardWithCurrentUser:', error);
            throw error;
        }
    }

    // 🎯 Helper: Format metric value cho display
    formatMetricValue(value, metricType) {
        if (metricType === 'time') {
            // Format time: seconds -> MM:SS
            const mins = String(Math.floor(value / 60)).padStart(2, '0');
            const secs = String(value % 60).padStart(2, '0');
            return `${mins}:${secs}`;
        } else {
            // Format score: add commas
            return value.toLocaleString();
        }
    }

    // 🎯 Helper: Get rank display class
    getRankDisplayClass(rank) {
        if (rank === 1) return 'top-1';
        if (rank === 2) return 'top-2';
        if (rank === 3) return 'top-3';
        return '';
    }

    // 🎯 Clear all cache
    clearCache() {
        this.cache.leaderboard.clear();
        this.cache.userBest.clear();
    }

    // 🎯 Debug: Log cache status
    debugCacheStatus() {
        console.log('🏆 Leaderboard Cache Status:');
        console.log('- Leaderboard cache:', this.cache.leaderboard.size, 'entries');
        console.log('- User best cache:', this.cache.userBest.size, 'entries');
    }
}

// Export instance default
export const leaderboard = new Leaderboard();
