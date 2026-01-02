// 🎯 User Profile Module - Quản lý thông tin user (level, XP, coins, stats)
// ✅ Lưu trữ và cập nhật thông tin user profile
// ✅ Tính toán level từ XP
// ✅ Quản lý coins và gems
// ✅ Track thống kê game
// ✅ Cache để tối ưu performance

import { supabase } from '../supabase/supabase.js';
import { getCurrentUserWithRetry } from '../supabase/auth.js';
import { achievements } from './achievements.js';

// Get Supabase URL for Edge Functions
const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL || 'http://localhost:54321';

export class UserProfile {
    constructor() {
        // Cache để tránh query quá nhiều
        this.cache = new Map();
        this.cacheTimeout = 30 * 1000; // 30 giây cho profile

        // Profile data
        this.profile = null;
    }

    // Kiểm tra user đã đăng nhập chưa
    async isLoggedIn() {
        const userData = await getCurrentUserWithRetry();
        return !!(userData?.user);
    }

    // Lấy thông tin user hiện tại
    async getCurrentUser() {
        const userData = await getCurrentUserWithRetry();
        return userData?.user || null;
    }

    // Lấy profile user từ cache hoặc database
    async getProfile(forceRefresh = false) {
        if (!(await this.isLoggedIn())) {
            return null;
        }

        const cacheKey = 'profile';

        // Kiểm tra cache
        if (!forceRefresh && this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.cacheTimeout) {
                return cached.data;
            }
        }

        try {
            const user = await this.getCurrentUser();
            if (!user) {
                console.log('❌ No authenticated user found');
                return null;
            }

            const { data, error } = await supabase
                .from('user_profiles')
                .select('*')
                .eq('id', user.id)
                .single();

            if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
                console.error('Error getting profile:', error);
                return null;
            }

            // Nếu chưa có profile, tạo mới
            if (!data) {
                const newProfile = await this.createProfile(user);
                if (newProfile) {
                    this.profile = newProfile;
                    return newProfile;
                }
                return null;
            }

            // Cache kết quả
            this.cache.set(cacheKey, {
                data: data,
                timestamp: Date.now()
            });

            this.profile = data;
            return data;
        } catch (error) {
            console.error('Error in getProfile:', error);
            return null;
        }
    }

    // Tạo profile mới cho user
    async createProfile(user) {
        try {
            const username = user.user_metadata?.username ||
                           user.user_metadata?.full_name ||
                           user.email?.split('@')[0] ||
                           `user_${user.id.substring(0, 8)}`;

            const { data, error } = await supabase
                .from('user_profiles')
                .insert({
                    id: user.id,
                    username: username,
                    level: 1,
                    xp: 0,
                    coins: 0,
                    gems: 0,
                    total_games_played: 0,
                    total_time_played: 0,
                    current_streak: 0,
                    best_streak: 0
                })
                .select()
                .single();

            if (error) {
                console.error('Error creating profile:', error);
                return null;
            }

            return data;
        } catch (error) {
            console.error('Error in createProfile:', error);
            return null;
        }
    }

    // Cập nhật profile với data mới
    async updateProfile(updates) {
        if (!(await this.isLoggedIn())) {
            return false;
        }

        try {
            const user = await this.getCurrentUser();
            if (!user) {
                console.log('❌ No authenticated user found for profile update');
                return false;
            }

            const { data, error } = await supabase
                .from('user_profiles')
                .update(updates)
                .eq('id', user.id)
                .select()
                .single();

            if (error) {
                console.error('Error updating profile:', error);
                return false;
            }

            // Clear cache
            this.cache.delete('profile');
            this.profile = data;

            return data;
        } catch (error) {
            console.error('Error in updateProfile:', error);
            return false;
        }
    }

    // Thêm XP và tự động tính level mới (logic trực tiếp - không Edge Function)
    async addXP(amount, reason = 'game_completion', referenceId = null) {
        if (!(await this.isLoggedIn())) return false;

        try {
            const user = await this.getCurrentUser();
            if (!user) {
                console.log('❌ No authenticated user found for profile validation');
                return false;
            }

            const currentProfile = await this.getProfile();

            if (!currentProfile) return false;

            // Tính toán total XP mới
            const currentTotalXP = this.getTotalXPFromLevelAndXP(currentProfile.level, currentProfile.xp);
            const newTotalXP = currentTotalXP + amount;

            // Tính level mới
            const newLevel = this.calculateLevelFromXP(newTotalXP);
            const newLevelXP = newTotalXP - this.getTotalXPNeededForLevel(newLevel - 1);

            // Check level up
            const levelUp = newLevel > currentProfile.level;
            let levelUpRewards = null;

            if (levelUp) {
                levelUpRewards = await this.claimLevelUpRewards(newLevel);
            }

            // Update profile
            const { error } = await supabase
                .from('user_profiles')
                .update({
                    xp: newLevelXP,
                    level: newLevel,
                    updated_at: new Date().toISOString()
                })
                .eq('id', user.id);

            if (error) {
                console.error('Error updating user XP/level:', error);
                return false;
            }

            // Clear cache để refresh data
            this.cache.delete('profile');
            this.profile = null; // Also clear cached profile object

            // Trigger UI updates
            if (levelUp) {
                console.log(`🎉 Level up! ${currentProfile.level} → ${newLevel}`);
                this.showLevelUpNotification(newLevel, levelUpRewards);
            }

            return {
                success: true,
                xp_added: amount,
                new_total_xp: newTotalXP,
                new_level: newLevel,
                new_level_xp: newLevelXP,
                level_up: levelUp,
                rewards: levelUpRewards
            };
        } catch (error) {
            console.error('Error adding XP:', error);
            return false;
        }
    }

    // Tính total XP từ level và XP trong level
    calculateTotalXP(level, xpInLevel) {
        let totalXP = 0;
        for (let i = 1; i < level; i++) {
            totalXP += this.getXPNeededForLevel(i);
        }
        return totalXP + xpInLevel;
    }

    // Tính level và XP từ total XP (gọi database function)
    async calculateLevelAndXP(totalXP) {
        try {
            const { data, error } = await supabase
                .rpc('calculate_level_and_xp', { total_xp: totalXP });

            if (error) {
                console.error('Error calculating level and XP:', error);
                // Fallback calculation
                return this.fallbackCalculateLevelAndXP(totalXP);
            }

            return data[0];
        } catch (error) {
            console.error('Error in calculateLevelAndXP:', error);
            // Fallback calculation
            return this.fallbackCalculateLevelAndXP(totalXP);
        }
    }

    // Fallback calculation khi database function không khả dụng
    fallbackCalculateLevelAndXP(totalXP) {
        let level = 1;
        let remainingXP = totalXP;

        while (remainingXP >= this.getXPNeededForLevel(level)) {
            remainingXP -= this.getXPNeededForLevel(level);
            level++;
        }

        return { level, xp_in_level: remainingXP };
    }

    // Thêm coins
    async addCoins(amount) {
        const profile = await this.getProfile();
        if (!profile) return false;

        return await this.updateProfile({
            coins: profile.coins + amount
        });
    }

    // Thêm gems
    async addGems(amount) {
        const profile = await this.getProfile();
        if (!profile) return false;

        return await this.updateProfile({
            gems: profile.gems + amount
        });
    }

    // Trừ coins (kiểm tra đủ coins trước)
    async spendCoins(amount) {
        const profile = await this.getProfile();
        if (!profile || profile.coins < amount) {
            return false;
        }

        return await this.updateProfile({
            coins: profile.coins - amount
        });
    }

    // Trừ gems (kiểm tra đủ gems trước)
    async spendGems(amount) {
        const profile = await this.getProfile();
        if (!profile || profile.gems < amount) {
            return false;
        }

        return await this.updateProfile({
            gems: profile.gems - amount
        });
    }

    // Cập nhật thống kê game
    async updateGameStats(gameData) {
        const profile = await this.getProfile();
        if (!profile) return false;

        const updates = {
            total_games_played: profile.total_games_played + 1,
            total_time_played: profile.total_time_played + (gameData.timeSpent || 0),
            current_streak: gameData.maintainStreak ? profile.current_streak + 1 : 0,
            best_streak: Math.max(profile.best_streak, profile.current_streak + (gameData.maintainStreak ? 1 : 0))
        };

        return await this.updateProfile(updates);
    }

    // Tính level từ tổng XP
    calculateLevelFromXP(totalXP) {
        let level = 1;
        let xpNeeded = 100; // Level 1 needs 100 XP

        while (totalXP >= xpNeeded) {
            totalXP -= xpNeeded;
            level++;
            // XP needed = level * 100 + (level-1) * 50
            xpNeeded = level * 100 + (level - 1) * 50;
        }

        return level;
    }

    // Tính tổng XP từ level và XP trong level
    getTotalXPFromLevelAndXP(level, levelXP) {
        let totalXP = 0;
        for (let l = 1; l < level; l++) {
            totalXP += this.getXPNeededForLevel(l);
        }
        return totalXP + levelXP;
    }

    // Tính tổng XP cần thiết để đạt đến level (không bao gồm XP trong level đó)
    getTotalXPNeededForLevel(level) {
        let totalXP = 0;
        for (let l = 1; l <= level; l++) {
            totalXP += this.getXPNeededForLevel(l);
        }
        return totalXP;
    }

    // Lấy XP cần thiết cho level
    getXPNeededForLevel(level) {
        return level * 100 + (level - 1) * 50;
    }

    // Lấy phần trăm tiến trình level
    getLevelProgress(profile) {
        const currentLevelXP = profile.xp; // profile.xp là XP trong level hiện tại
        const xpNeeded = this.getXPNeededForLevel(profile.level);
        return Math.min((currentLevelXP / xpNeeded) * 100, 100);
    }

    // Lấy rewards khi lên level
    async getLevelUpRewards(newLevel) {
        try {
            const { data, error } = await supabase
                .from('level_rewards')
                .select('*')
                .eq('level', newLevel)
                .single();

            if (error && error.code !== 'PGRST116') {
                console.error('Error getting level rewards:', error);
                return {};
            }

            return data || {};
        } catch (error) {
            console.error('Error in getLevelUpRewards:', error);
            return {};
        }
    }

    // Format số lượng lớn (1.2K, 1.5M, etc.)
    formatNumber(num) {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return num.toString();
    }

    // Clear cache
    clearCache() {
        this.cache.clear();
        this.profile = null;
    }

    // Force refresh profile data (clear cache and reload)
    async refreshProfile() {
        this.cache.delete('profile');
        this.profile = null;
        return await this.getProfile(true);
    }


    // Show level up notification
    showLevelUpNotification(newLevel, rewards) {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = 'level-up-notification';
        notification.innerHTML = `
            <div class="level-up-content">
                <div class="level-up-icon">🎉</div>
                <div class="level-up-text">
                    <h3>Level Up!</h3>
                    <p>You reached Level ${newLevel}!</p>
                    ${rewards.coins > 0 || rewards.gems > 0 ?
                        `<p class="level-up-rewards">
                            +${rewards.coins} 🪙 +${rewards.gems} 💎
                        </p>` : ''}
                </div>
            </div>
        `;

        // Add to DOM
        document.body.appendChild(notification);

        // Add CSS if not exists
        if (!document.getElementById('level-up-styles')) {
            const styles = document.createElement('style');
            styles.id = 'level-up-styles';
            styles.textContent = `
                .level-up-notification {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    background: linear-gradient(135deg, var(--primary-color), var(--accent-color));
                    border-radius: 15px;
                    padding: 1.5rem;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.3);
                    z-index: 10000;
                    animation: slideIn 0.5s ease-out;
                    color: white;
                    min-width: 300px;
                }

                .level-up-content {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                }

                .level-up-icon {
                    font-size: 3rem;
                    animation: bounce 0.6s ease-in-out;
                }

                .level-up-text h3 {
                    margin: 0 0 0.5rem 0;
                    font-size: 1.5rem;
                    font-weight: bold;
                }

                .level-up-text p {
                    margin: 0.25rem 0;
                    opacity: 0.9;
                }

                .level-up-rewards {
                    font-weight: bold;
                    color: #ffd700 !important;
                }

                @keyframes slideIn {
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

        // Auto remove after 5 seconds
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.5s ease-in';
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 500);
        }, 5000);

        // Add slideOut animation
        const slideOutStyle = document.createElement('style');
        slideOutStyle.textContent = `
            @keyframes slideOut {
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

    // Debug: log profile info
    async debugLogProfile() {
        const profile = await this.getProfile(true);
        console.log('User Profile:', profile);
    }
}

// Export instance default
export const userProfile = new UserProfile();
