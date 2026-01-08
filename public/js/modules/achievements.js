// 🎯 Achievements Module - Quản lý achievements và rewards
// ✅ Lấy danh sách achievements có sẵn
// ✅ Quản lý achievements đã unlock của user
// ✅ Check và unlock achievements tự động
// ✅ Claim rewards từ achievements
// ✅ Track progress cho từng achievement
// ✅ Cache để tối ưu performance

import { supabase } from '../supabase/supabase.js';
import { getCurrentUser } from '../supabase/auth.js';
import { userProfile } from './user_profile.js';
import { items } from './items.js';
import { pets } from './pets.js';

// Helper function to get best time from game_best_scores
async function getBestTimeFromGameBestScores(difficulty) {
    try {
        const user = await supabase.auth.getUser();
        if (!user.data.user) return null;

        // Get game and mode IDs
        const { data: gameData } = await supabase
            .from('games')
            .select('id')
            .eq('code', 'sudoku')
            .maybeSingle();

        if (!gameData) return null;

        const { data: modeData } = await supabase
            .from('game_modes')
            .select('id')
            .eq('game_id', gameData.id)
            .eq('code', difficulty)
            .maybeSingle();

        if (!modeData) return null;

        const { data, error } = await supabase
            .from('game_best_scores')
            .select('metric_value')
            .eq('user_id', user.data.user.id)
            .eq('game_id', gameData.id)
            .eq('mode_id', modeData.id)
            .maybeSingle();

        if (error || !data) return null;

        return data.metric_value;
    } catch (error) {
        console.error('Error getting best time from game_best_scores:', error);
        return null;
    }
}

export class Achievements {
    constructor() {
        // Cache để tránh query quá nhiều
        this.cache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 phút cho achievements
        this.userAchievementsCacheTimeout = 2 * 60 * 1000; // 2 phút cho user achievements
    }

    // Kiểm tra user đã đăng nhập chưa
    async isLoggedIn() {
        const user = await getCurrentUser();
        return !!user;
    }

    // Lấy thông tin user hiện tại
    async getCurrentUser() {
        const result = await getCurrentUser();
        return result ? result.user : null; // Extract user object từ {user, profile}
    }

    // Lấy danh sách tất cả achievements
    async getAllAchievements(forceRefresh = false) {
        const cacheKey = 'all_achievements';

        // Kiểm tra cache
        if (!forceRefresh && this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.cacheTimeout) {
                return cached.data;
            }
        }

        try {
            const { data, error } = await supabase
                .from('achievements')
                .select('*')
                .order('category')
                .order('trigger_value');

            if (error) {
                console.error('Error getting all achievements:', error);
                return [];
            }

            // Cache kết quả
            this.cache.set(cacheKey, {
                data: data,
                timestamp: Date.now()
            });

            return data;
        } catch (error) {
            console.error('Error in getAllAchievements:', error);
            return [];
        }
    }

    // Lấy achievements theo category
    async getAchievementsByCategory(category, forceRefresh = false) {
        const allAchievements = await this.getAllAchievements(forceRefresh);
        return allAchievements.filter(achievement => achievement.category === category);
    }

    // Lấy achievements đã unlock của user
    async getUserAchievements(forceRefresh = false) {
        try {
            const user = await this.getCurrentUser();

            if (!user || !user.id) {
                console.warn('User ID is undefined, cannot fetch achievements yet.');
                return [];
            }

            const cacheKey = `user_achievements_${user.id}`;

            // Kiểm tra cache
            if (!forceRefresh && this.cache.has(cacheKey)) {
                const cached = this.cache.get(cacheKey);
                if (Date.now() - cached.timestamp < this.userAchievementsCacheTimeout) {
                    return cached.data;
                }
            }

            const { data, error } = await supabase
                .from('user_achievements')
                .select(`
                    id,
                    unlocked_at,
                    claimed,
                    progress,
                    achievements (
                        id,
                        name,
                        description,
                        icon,
                        category,
                        trigger_type,
                        trigger_value,
                        difficulty_filter,
                        is_hidden,
                        reward_coins,
                        reward_gems,
                        reward_xp
                    )
                `)
                .eq('user_id', user.id);

            if (error) {
                console.error('Error getting user achievements:', error);
                return [];
            }

            // Cache kết quả
            this.cache.set(cacheKey, {
                data: data,
                timestamp: Date.now()
            });

            return data;
        } catch (error) {
            console.error('Error in getUserAchievements:', error);
            return [];
        }
    }

    // Kiểm tra achievement đã unlock chưa
    async isAchievementUnlocked(achievementId) {
        const userAchievements = await this.getUserAchievements();
        return userAchievements.some(ua => ua.achievements.id === achievementId);
    }

    // Lấy progress của achievement
    async getAchievementProgress(achievementId) {
        const userAchievements = await this.getUserAchievements();
        const userAchievement = userAchievements.find(ua => ua.achievements.id === achievementId);
        return userAchievement ? userAchievement.progress : 0;
    }

    // Check và unlock achievements dựa trên trigger conditions
    async checkAndUnlockAchievements(triggerType, triggerData = {}) {
        if (!(await this.isLoggedIn())) {
            return [];
        }

        const allAchievements = await this.getAllAchievements();
        const userAchievements = await this.getUserAchievements();
        const unlockedIds = userAchievements.map(ua => ua.achievements.id);

        // Lọc achievements phù hợp với trigger type và chưa unlock
        const relevantAchievements = allAchievements.filter(achievement =>
            achievement.trigger_type === triggerType &&
            !unlockedIds.includes(achievement.id)
        );

        const newlyUnlocked = [];

        for (const achievement of relevantAchievements) {
            const shouldUnlock = await this.checkAchievementCondition(achievement, triggerData);
            if (shouldUnlock) {
                const unlockResult = await this.unlockAchievement(achievement.id);
                if (unlockResult.success) {
                    newlyUnlocked.push(achievement);
                }
            }
        }

        return newlyUnlocked;
    }

    // Kiểm tra điều kiện unlock cho achievement cụ thể
    async checkAchievementCondition(achievement, triggerData) {
        try {
            const profile = await userProfile.getProfile();

            switch (achievement.trigger_type) {
                case 'games_completed':
                    const totalGames = profile ? profile.total_games_played : 0;
                    return totalGames >= achievement.trigger_value;

                case 'best_time':
                    if (!triggerData.difficulty) return false;
                    // Kiểm tra difficulty filter
                    if (achievement.difficulty_filter &&
                        achievement.difficulty_filter !== triggerData.difficulty) {
                        return false;
                    }
                    const bestTime = await getBestTimeFromGameBestScores(triggerData.difficulty);
                    return bestTime && bestTime <= achievement.trigger_value;

                case 'streak':
                    return profile && profile.best_streak >= achievement.trigger_value;

                case 'level_reached':
                    return profile && profile.level >= achievement.trigger_value;

                case 'total_time_played':
                    const totalTimeHours = profile ? Math.floor(profile.total_time_played / 3600) : 0;
                    return totalTimeHours >= achievement.trigger_value;

                default:
                    return false;
            }
        } catch (error) {
            console.error('Error checking achievement condition:', error);
            return false;
        }
    }

    // Unlock achievement
    async unlockAchievement(achievementId) {
        if (!(await this.isLoggedIn())) {
            return { success: false, message: 'Vui lòng đăng nhập' };
        }

        try {
            // Kiểm tra đã unlock chưa
            if (await this.isAchievementUnlocked(achievementId)) {
                return { success: false, message: 'Achievement đã được unlock' };
            }

            const user = await this.getCurrentUser();
            const { data, error } = await supabase
                .from('user_achievements')
                .insert({
                    user_id: user.id,
                    achievement_id: achievementId,
                    unlocked_at: new Date().toISOString(),
                    claimed: false,
                    progress: 100 // Fully completed
                })
                .select()
                .single();

            if (error) {
                console.error('Error unlocking achievement:', error);
                return { success: false, message: 'Lỗi khi unlock achievement' };
            }

            // Clear user achievements cache
            this.cache.delete('user_achievements');

            // Lấy thông tin achievement để trả về
            const allAchievements = await this.getAllAchievements();
            const achievement = allAchievements.find(a => a.id === achievementId);

            return {
                success: true,
                message: `🎉 Đã unlock achievement: ${achievement.name}!`,
                achievement: achievement
            };
        } catch (error) {
            console.error('Error in unlockAchievement:', error);
            return { success: false, message: 'Lỗi không xác định' };
        }
    }

    // Claim rewards từ achievement
    async claimAchievementReward(achievementId) {
        if (!(await this.isLoggedIn())) {
            return { success: false, message: 'Vui lòng đăng nhập' };
        }

        try {
            const userAchievements = await this.getUserAchievements();
            const userAchievement = userAchievements.find(ua => ua.achievements.id === achievementId);

            if (!userAchievement) {
                return { success: false, message: 'Achievement chưa được unlock' };
            }

            if (userAchievement.claimed) {
                return { success: false, message: 'Rewards đã được claim' };
            }

            const achievement = userAchievement.achievements;

            // Cộng rewards
            const rewards = [];
            if (achievement.reward_coins > 0) {
                await userProfile.addCoins(achievement.reward_coins);
                rewards.push(`${achievement.reward_coins} coins`);
            }

            if (achievement.reward_gems > 0) {
                await userProfile.addGems(achievement.reward_gems);
                rewards.push(`${achievement.reward_gems} gems`);
            }

            if (achievement.reward_xp > 0) {
                await userProfile.addXP(achievement.reward_xp);
                rewards.push(`${achievement.reward_xp} XP`);
            }

            // Đánh dấu đã claim
            const { error } = await supabase
                .from('user_achievements')
                .update({ claimed: true })
                .eq('id', userAchievement.id);

            if (error) {
                console.error('Error claiming achievement reward:', error);
                return { success: false, message: 'Lỗi khi claim rewards' };
            }

            // Clear user achievements cache
            this.cache.delete('user_achievements');

            return {
                success: true,
                message: `Đã nhận rewards: ${rewards.join(', ')}`,
                rewards: {
                    coins: achievement.reward_coins,
                    gems: achievement.reward_gems,
                    xp: achievement.reward_xp
                }
            };
        } catch (error) {
            console.error('Error in claimAchievementReward:', error);
            return { success: false, message: 'Lỗi không xác định' };
        }
    }

    // Cập nhật progress cho achievement (cho progress-tracking achievements)
    async updateAchievementProgress(achievementId, newProgress) {
        if (!(await this.isLoggedIn())) {
            return false;
        }

        try {
            const user = await this.getCurrentUser();
            const userAchievements = await this.getUserAchievements();
            const userAchievement = userAchievements.find(ua => ua.achievements.id === achievementId);

            if (userAchievement) {
                // Update existing
                const { error } = await supabase
                    .from('user_achievements')
                    .update({ progress: Math.min(newProgress, 100) })
                    .eq('id', userAchievement.id);

                if (error) {
                    console.error('Error updating achievement progress:', error);
                    return false;
                }
            } else {
                // Insert new with progress
                const { error } = await supabase
                    .from('user_achievements')
                    .insert({
                        user_id: user.id,
                        achievement_id: achievementId,
                        progress: Math.min(newProgress, 100)
                    });

                if (error) {
                    console.error('Error inserting achievement progress:', error);
                    return false;
                }
            }

            // Clear cache
            this.cache.delete('user_achievements');
            return true;
        } catch (error) {
            console.error('Error in updateAchievementProgress:', error);
            return false;
        }
    }

    // Lấy thống kê achievements (unlocked/total, completion rate)
    async getAchievementStats() {
        const allAchievements = await this.getAllAchievements();
        const userAchievements = await this.getUserAchievements();

        const totalAchievements = allAchievements.length;
        const unlockedAchievements = userAchievements.length;
        const claimedRewards = userAchievements.filter(ua => ua.claimed).length;

        // Tính completion rate theo category
        const categoryStats = {};
        const categories = ['sudoku', 'streak', 'time', 'level', 'collection'];

        categories.forEach(category => {
            const categoryAchievements = allAchievements.filter(a => a.category === category);
            const categoryUnlocked = userAchievements.filter(ua => ua.achievements.category === category);
            categoryStats[category] = {
                total: categoryAchievements.length,
                unlocked: categoryUnlocked.length,
                completionRate: categoryAchievements.length > 0 ?
                    (categoryUnlocked.length / categoryAchievements.length) * 100 : 0
            };
        });

        return {
            total: totalAchievements,
            unlocked: unlockedAchievements,
            claimed: claimedRewards,
            completionRate: totalAchievements > 0 ? (unlockedAchievements / totalAchievements) * 100 : 0,
            categories: categoryStats
        };
    }

    // Check achievements on specific events
    async checkEventAchievements(eventType, eventData = {}) {
        switch (eventType) {
            case 'game_completed':
                return await this.checkGameCompletedAchievements(eventData);
            case 'level_up':
                return await this.checkLevelAchievements(eventData);
            case 'streak_update':
                return await this.checkStreakAchievements(eventData);
            case 'login':
                return await this.checkLoginAchievements(eventData);
            default:
                return [];
        }
    }

    // Check achievements when a game is completed
    async checkGameCompletedAchievements(gameData) {
        const triggers = [
            { type: 'games_completed', value: 1, data: { difficulty: gameData.difficulty } },
            { type: 'games_completed', value: 10, data: { difficulty: gameData.difficulty } },
            { type: 'games_completed', value: 50, data: { difficulty: gameData.difficulty } },
            { type: 'games_completed', value: 100, data: { difficulty: gameData.difficulty } },
            { type: 'best_time', data: { difficulty: gameData.difficulty, timeTaken: gameData.timeTaken } }
        ];

        let newlyUnlocked = [];
        for (const trigger of triggers) {
            const unlocked = await this.checkAndUnlockAchievements(trigger.type, trigger.data);
            newlyUnlocked = newlyUnlocked.concat(unlocked);
        }

        return newlyUnlocked;
    }

    // Check level-based achievements
    async checkLevelAchievements(levelData) {
        return await this.checkAndUnlockAchievements('level_reached', {
            newLevel: levelData.newLevel
        });
    }

    // Check streak-based achievements
    async checkStreakAchievements(streakData) {
        return await this.checkAndUnlockAchievements('streak', {
            streakLength: streakData.streakLength
        });
    }

    // Check achievements on login (for cumulative achievements)
    async checkLoginAchievements(loginData) {
        const profile = await userProfile.getProfile();
        if (!profile) return [];

        const triggers = [
            { type: 'games_completed', value: profile.total_games_played },
            { type: 'level_reached', value: profile.level },
            { type: 'streak', value: profile.best_streak },
            { type: 'total_time_played', value: Math.floor(profile.total_time_played / 3600) }
        ];

        let newlyUnlocked = [];
        for (const trigger of triggers) {
            const unlocked = await this.checkAndUnlockAchievements(trigger.type, trigger);
            newlyUnlocked = newlyUnlocked.concat(unlocked);
        }

        return newlyUnlocked;
    }

    // Enhanced checkAchievementCondition with more trigger types
    async checkAchievementCondition(achievement, triggerData) {
        try {
            const profile = await userProfile.getProfile();

            switch (achievement.trigger_type) {
                case 'games_completed':
                    const totalGames = profile ? profile.total_games_played : 0;
                    return totalGames >= achievement.trigger_value;

                case 'best_time':
                    if (!triggerData.difficulty) return false;
                    // Check difficulty filter
                    if (achievement.difficulty_filter &&
                        achievement.difficulty_filter !== triggerData.difficulty) {
                        return false;
                    }
                    const bestTime = await getBestTimeFromGameBestScores(triggerData.difficulty);
                    return bestTime && bestTime <= achievement.trigger_value;

                case 'streak':
                    return profile && profile.best_streak >= achievement.trigger_value;

                case 'level_reached':
                    const checkLevel = triggerData.newLevel || (profile ? profile.level : 1);
                    return checkLevel >= achievement.trigger_value;

                case 'total_time_played':
                    const totalTimeHours = profile ? Math.floor(profile.total_time_played / 3600) : 0;
                    return totalTimeHours >= achievement.trigger_value;

                case 'total_xp':
                    return profile && profile.xp >= achievement.trigger_value;

                case 'total_coins_earned':
                    // This would need to be tracked separately
                    return false; // Placeholder

                default:
                    return false;
            }
        } catch (error) {
            console.error('Error checking achievement condition:', error);
            return false;
        }
    }

    // Unlock achievements (logic trực tiếp - không Edge Function)
    async unlockAchievements(triggerType, triggerData = {}) {
        if (!(await this.isLoggedIn())) {
            return { success: false, message: 'Vui lòng đăng nhập' };
        }

        try {
            const user = await this.getCurrentUser();
            const achievementsConfig = await this.getAchievementsConfig();

            // Lọc achievements theo trigger type
            const relevantAchievements = achievementsConfig.filter(
                achievement => achievement.trigger_type === triggerType
            );

            const unlockedAchievements = [];

            for (const achievement of relevantAchievements) {
                // Check đã unlock chưa
                const { data: existing } = await supabase
                    .from('user_achievements')
                    .select('id')
                    .eq('user_id', user.id)
                    .eq('achievement_id', achievement.id)
                    .maybeSingle();

                if (existing) continue; // Đã unlock rồi

                // Check điều kiện
                const shouldUnlock = await this.checkAchievementCondition(achievement, triggerData);

                if (shouldUnlock) {
                    // Insert achievement
                    const { error } = await supabase
                        .from('user_achievements')
                        .insert({
                            user_id: user.id,
                            achievement_id: achievement.id,
                            unlocked_at: new Date().toISOString()
                        });

                    if (!error) {
                        unlockedAchievements.push(achievement);
                    } else {
                        console.error('Error inserting achievement:', error);
                    }
                }
            }

            // Clear cache để refresh achievements
            this.cache.delete('user_achievements');

            // Show achievement notifications
            if (unlockedAchievements.length > 0) {
                unlockedAchievements.forEach(achievement => {
                    this.showAchievementNotification(achievement);
                });
            }

            return {
                success: true,
                unlocked_count: unlockedAchievements.length,
                achievements: unlockedAchievements
            };
        } catch (error) {
            console.error('Error unlocking achievements:', error);
            return { success: false, message: 'Lỗi không xác định' };
        }
    }

    // Show achievement unlock notification
    showAchievementNotification(achievement) {
        const notification = document.createElement('div');
        notification.className = 'achievement-notification';
        notification.innerHTML = `
            <div class="achievement-content">
                <div class="achievement-icon">🏆</div>
                <div class="achievement-text">
                    <h4>Achievement Unlocked!</h4>
                    <p>${achievement.name}</p>
                    ${achievement.rewards.xp > 0 || achievement.rewards.coins > 0 || achievement.rewards.gems > 0 ?
                        `<p class="achievement-rewards">
                            +${achievement.rewards.xp} XP +${achievement.rewards.coins} 🪙 +${achievement.rewards.gems} 💎
                        </p>` : ''}
                </div>
            </div>
        `;

        document.body.appendChild(notification);

        // Add CSS if not exists
        if (!document.getElementById('achievement-styles')) {
            const styles = document.createElement('style');
            styles.id = 'achievement-styles';
            styles.textContent = `
                .achievement-notification {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    background: linear-gradient(135deg, #ffd700, #ffed4e);
                    border-radius: 15px;
                    padding: 1.5rem;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.3);
                    z-index: 9999;
                    animation: slideInRight 0.5s ease-out;
                    color: #333;
                    min-width: 320px;
                    margin-bottom: 10px;
                }

                .achievement-notification:nth-child(2) { top: 120px; }
                .achievement-notification:nth-child(3) { top: 220px; }

                .achievement-content {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                }

                .achievement-icon {
                    font-size: 2.5rem;
                    animation: bounce 0.6s ease-in-out;
                }

                .achievement-text h4 {
                    margin: 0 0 0.5rem 0;
                    font-size: 1.2rem;
                    font-weight: bold;
                }

                .achievement-text p {
                    margin: 0.25rem 0;
                }

                .achievement-rewards {
                    font-weight: bold;
                    color: #e74c3c !important;
                }

                @keyframes slideInRight {
                    from {
                        transform: translateX(100%);
                        opacity: 0;
                    }
                    to {
                        transform: translateX(0);
                        opacity: 1;
                    }
                }

                @keyframes bounce {
                    0%, 20%, 50%, 80%, 100% {
                        transform: translateY(0);
                    }
                    40% {
                        transform: translateY(-10px);
                    }
                    60% {
                        transform: translateY(-5px);
                    }
                }
            `;
            document.head.appendChild(styles);
        }

        // Auto remove after 4 seconds
        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.5s ease-in';
            setTimeout(() => {
                if (document.body.contains(notification)) {
                    document.body.removeChild(notification);
                }
            }, 500);
        }, 4000);

        // Add slideOut animation
        const slideOutStyle = document.createElement('style');
        slideOutStyle.textContent = `
            @keyframes slideOutRight {
                from {
                    transform: translateX(0);
                    opacity: 1;
                }
                to {
                    transform: translateX(100%);
                    opacity: 0;
                }
            }
        `;
        document.head.appendChild(slideOutStyle);
    }


    // Clear cache
    clearCache() {
        this.cache.clear();
    }

    // Clear cache cho user cụ thể
    clearUserCache(userId = null) {
        if (userId) {
            // Clear cache cho user cụ thể
            const userCacheKey = `user_achievements_${userId}`;
            this.cache.delete(userCacheKey);
        } else {
            // Clear tất cả cache liên quan đến user achievements
            for (const key of this.cache.keys()) {
                if (key.startsWith('user_achievements_')) {
                    this.cache.delete(key);
                }
            }
        }
    }

    // Debug: log user achievements
    async debugLogUserAchievements() {
        const userAchievements = await this.getUserAchievements(true);
        console.log('User Achievements:', userAchievements);
    }
}

// Export instance default
export const achievements = new Achievements();
