// 🎯 Profile Page JavaScript
// ✅ Load và hiển thị user profile
// ✅ Quản lý tabs (inventory, achievements, pets, daily)
// ✅ Handle item usage và pet management
// ✅ Claim daily rewards

import { userProfile } from './user_profile.js';
import { items } from './items.js';
import { pets } from './pets.js';
import { achievements } from './achievements.js';
import { rewards } from './rewards.js';
import {
  getCurrentUserWithRetry,
  logoutUser
} from '../supabase/auth.js';

class ProfilePage {
    constructor() {
        this.currentTab = 'inventory';
        this.init();
    }

    async init() {
        await this.checkAuth();
        this.setupEventListeners();
        await this.loadProfile();
        await this.loadCurrentTab();
    }

    async checkAuth() {
        const userData = await getCurrentUserWithRetry();
        if (!userData?.user) {
            window.location.href = '/pages/login.html';
            return;
        }
        console.log('👤 Profile page auth check passed:', userData.user.email);
    }

    setupEventListeners() {
        // Tab switching
        const tabButtons = document.querySelectorAll('.tab-button');
        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const tab = button.dataset.tab;
                this.switchTab(tab);
            });
        });

        // Modal close buttons
        document.getElementById('item-modal-close')?.addEventListener('click', () => {
            this.closeItemModal();
        });

        document.getElementById('achievement-modal-close')?.addEventListener('click', () => {
            this.closeAchievementModal();
        });

        // Close modals when clicking outside
        document.getElementById('item-modal')?.addEventListener('click', (e) => {
            if (e.target.id === 'item-modal') {
                this.closeItemModal();
            }
        });

        document.getElementById('achievement-modal')?.addEventListener('click', (e) => {
            if (e.target.id === 'achievement-modal') {
                this.closeAchievementModal();
            }
        });

        // Claim daily reward button
        document.getElementById('claim-daily-btn')?.addEventListener('click', async () => {
            await this.claimDailyReward();
        });

        // Auto refresh profile when user returns to tab
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                // User returned to tab, refresh profile data
                this.loadProfile();
            }
        });

        // Refresh profile when page gains focus
        window.addEventListener('focus', () => {
            this.loadProfile();
        });
    }

    async loadProfile() {
        try {
            // Force refresh profile data to ensure latest XP/coins are displayed
            const profile = await userProfile.getProfile(true);

            if (profile) {
                // Update profile info
                document.getElementById('username-display').textContent = profile.username || 'Anonymous';
                document.getElementById('level-badge').textContent = `Lv. ${profile.level}`;
                document.getElementById('coins-amount').textContent = userProfile.formatNumber(profile.coins);
                document.getElementById('gems-amount').textContent = userProfile.formatNumber(profile.gems);

                // Update XP bar
                const currentLevelXP = userProfile.getCurrentLevelXP(profile);
                const progressPercent = userProfile.getLevelProgress(profile);
                document.getElementById('xp-fill').style.width = `${progressPercent}%`;
                document.getElementById('xp-text').textContent = `${currentLevelXP} / ${profile.xp_to_next_level} XP`;

                // Update stats
                document.getElementById('games-played').textContent = profile.total_games_played;
                document.getElementById('total-time').textContent = `${Math.floor(profile.total_time_played / 3600)}h`;
                document.getElementById('current-streak').textContent = profile.current_streak;
                document.getElementById('best-streak').textContent = profile.best_streak;
            }
        } catch (error) {
            console.error('Error loading profile:', error);
        }
    }

    async switchTab(tab) {
        // Update tab buttons
        document.querySelectorAll('.tab-button').forEach(button => {
            button.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tab}"]`).classList.add('active');

        // Update tab panes
        document.querySelectorAll('.tab-pane').forEach(pane => {
            pane.classList.remove('active');
        });
        document.getElementById(`${tab}-tab`).classList.add('active');

        this.currentTab = tab;
        await this.loadCurrentTab();
    }

    async loadCurrentTab() {
        switch (this.currentTab) {
            case 'inventory':
                await this.loadInventory();
                break;
            case 'achievements':
                await this.loadAchievements();
                break;
            case 'pets':
                await this.loadPets();
                break;
            case 'daily':
                await this.loadDailyRewards();
                break;
        }
    }

    async loadInventory() {
        try {
            const inventory = await items.getUserInventory();
            const inventoryGrid = document.getElementById('inventory-grid');
            const emptyState = document.getElementById('empty-inventory');

            inventoryGrid.innerHTML = '';

            if (Object.keys(inventory).length === 0) {
                emptyState.style.display = 'block';
                return;
            }

            emptyState.style.display = 'none';

            Object.values(inventory).forEach(({ item, quantity }) => {
                const itemElement = this.createInventoryItem(item, quantity);
                inventoryGrid.appendChild(itemElement);
            });
        } catch (error) {
            console.error('Error loading inventory:', error);
        }
    }

    createInventoryItem(item, quantity) {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'inventory-item';
        itemDiv.onclick = () => this.showItemModal(item, quantity);

        itemDiv.innerHTML = `
            <div class="item-icon">${this.getItemIcon(item.type)}</div>
            <div class="item-name">${item.name}</div>
            <div class="item-quantity">${quantity}</div>
            <div class="item-rarity ${item.rarity}">${item.rarity}</div>
        `;

        return itemDiv;
    }

    getItemIcon(type) {
        const icons = {
            consumable: '🧪',
            cosmetic: '🎨',
            tool: '🔧',
            pet_food: '🍖'
        };
        return icons[type] || '📦';
    }

    async loadAchievements() {
        try {
            const [allAchievements, userAchievements, stats] = await Promise.all([
                achievements.getAllAchievements(),
                achievements.getUserAchievements(),
                achievements.getAchievementStats()
            ]);

            // Update stats
            document.getElementById('achievements-unlocked').textContent = stats.unlocked;
            document.getElementById('achievements-total').textContent = stats.total;
            document.getElementById('completion-rate').textContent = `${stats.completionRate.toFixed(1)}%`;

            const achievementsGrid = document.getElementById('achievements-grid');
            achievementsGrid.innerHTML = '';

            // Create achievement cards
            allAchievements.forEach(achievement => {
                const userAchievement = userAchievements.find(ua => ua.achievements.id === achievement.id);
                const card = this.createAchievementCard(achievement, userAchievement);
                achievementsGrid.appendChild(card);
            });
        } catch (error) {
            console.error('Error loading achievements:', error);
        }
    }

    createAchievementCard(achievement, userAchievement) {
        const isUnlocked = !!userAchievement;
        const isClaimed = userAchievement?.claimed;

        const card = document.createElement('div');
        card.className = `achievement-card ${isUnlocked ? '' : 'locked'}`;
        card.onclick = () => this.showAchievementModal(achievement, userAchievement);

        const statusText = isClaimed ? 'Claimed' : (isUnlocked ? 'Claim' : 'Locked');
        const statusClass = isClaimed ? 'claimed' : (isUnlocked ? 'unlocked' : 'locked');

        card.innerHTML = `
            <div class="achievement-icon">${achievement.icon || '🏆'}</div>
            <div class="achievement-info">
                <div class="achievement-name">${achievement.name}</div>
                <div class="achievement-description">${achievement.description}</div>
                ${userAchievement?.progress ? `<div class="achievement-progress">${userAchievement.progress}/100</div>` : ''}
            </div>
            <div class="achievement-status ${statusClass}">${statusText}</div>
        `;

        return card;
    }

    async loadPets() {
        try {
            const userPets = await pets.getUserPets();
            const activePet = await pets.getActivePet();
            const petsGrid = document.getElementById('pets-grid');
            const emptyState = document.getElementById('empty-pets');

            petsGrid.innerHTML = '';

            if (userPets.length === 0) {
                emptyState.style.display = 'block';
                return;
            }

            emptyState.style.display = 'none';

            userPets.forEach(pet => {
                const petCard = this.createPetCard(pet, activePet);
                petsGrid.appendChild(petCard);
            });
        } catch (error) {
            console.error('Error loading pets:', error);
        }
    }

    createPetCard(userPet, activePet) {
        const pet = userPet.pets;
        const isActive = activePet && activePet.pets.id === pet.id;

        const card = document.createElement('div');
        card.className = `pet-card ${isActive ? 'active' : ''}`;
        card.onclick = async () => {
            if (isActive) return; // Already active
            const result = await pets.setActivePet(pet.id);
            if (result.success) {
                await this.loadPets(); // Reload to update UI
                alert(result.message);
            } else {
                alert(result.message);
            }
        };

        const statusText = isActive ? 'Active' : 'Owned';
        const statusClass = isActive ? 'active' : 'owned';

        card.innerHTML = `
            <div class="pet-icon">${this.getPetEmoji(pet.name)}</div>
            <div class="pet-name">${pet.name}</div>
            <div class="pet-description">${pet.description}</div>
            <div class="pet-stats">
                <div class="pet-stat">❤️ ${pet.happiness_boost}%</div>
                <div class="pet-stat">💰 ${pet.luck_boost}%</div>
            </div>
            <div class="pet-status ${statusClass}">${statusText}</div>
        `;

        return card;
    }

    getPetEmoji(petName) {
        const emojis = {
            'Lucky Cat': '🐱',
            'Wise Owl': '🦉',
            'Golden Dragon': '🐉'
        };
        return emojis[petName] || '🐾';
    }

    async loadDailyRewards() {
        try {
            const dailyConfig = await rewards.getDailyRewardsConfig();
            const currentStreak = await rewards.getCurrentDailyStreak();
            const hasClaimedToday = !!(await rewards.getUserDailyRewards());

            // Update streak display
            document.getElementById('daily-streak').textContent = currentStreak;

            const dailyGrid = document.getElementById('daily-rewards-grid');
            dailyGrid.innerHTML = '';

            dailyConfig.forEach(day => {
                const isToday = (currentStreak % 7) + 1 === day.day;
                const isClaimed = hasClaimedToday && isToday;
                const isAvailable = !hasClaimedToday && isToday;

                const dayElement = document.createElement('div');
                dayElement.className = `daily-item ${isToday ? 'today' : ''} ${isClaimed ? 'claimed' : ''}`;

                dayElement.innerHTML = `
                    <div class="day-number">Day ${day.day}</div>
                    <div class="reward-amount">
                        ${day.reward_coins > 0 ? `${day.reward_coins}🪙` : ''}
                        ${day.reward_gems > 0 ? `${day.reward_gems}💎` : ''}
                    </div>
                `;

                dailyGrid.appendChild(dayElement);
            });

            // Update claim button
            const claimBtn = document.getElementById('claim-daily-btn');
            if (hasClaimedToday) {
                claimBtn.textContent = 'Already Claimed Today';
                claimBtn.disabled = true;
            } else {
                claimBtn.textContent = 'Claim Today\'s Reward';
                claimBtn.disabled = false;
            }
        } catch (error) {
            console.error('Error loading daily rewards:', error);
        }
    }

    async claimDailyReward() {
        try {
            const result = await rewards.claimDailyReward();
            if (result.success) {
                alert(`Daily reward claimed! You received: ${result.rewards.coins} coins, ${result.rewards.gems} gems`);
                await this.loadProfile(); // Update currency display
                await this.loadDailyRewards(); // Update daily rewards UI
            } else {
                alert(result.message);
            }
        } catch (error) {
            console.error('Error claiming daily reward:', error);
            alert('Error claiming daily reward');
        }
    }

    showItemModal(item, quantity) {
        const modal = document.getElementById('item-modal');
        const title = document.getElementById('item-modal-title');
        const body = document.getElementById('item-modal-body');

        title.textContent = item.name;
        body.innerHTML = `
            <div class="item-details">
                <div class="item-icon-large">${this.getItemIcon(item.type)}</div>
                <p class="item-description">${item.description}</p>
                <div class="item-info">
                    <div class="info-row"><strong>Type:</strong> ${item.type}</div>
                    <div class="info-row"><strong>Rarity:</strong> <span class="rarity-${item.rarity}">${item.rarity}</span></div>
                    <div class="info-row"><strong>Owned:</strong> ${quantity}</div>
                </div>
                ${item.type === 'consumable' ? `
                    <button class="use-item-btn" onclick="profilePage.useItem('${item.id}')">Use Item</button>
                ` : ''}
            </div>
        `;

        modal.classList.add('show');
    }

    closeItemModal() {
        document.getElementById('item-modal').classList.remove('show');
    }

    async useItem(itemId) {
        const result = await items.useItem(itemId);
        if (result.success) {
            alert(result.message);
            this.closeItemModal();
            await this.loadInventory();
        } else {
            alert(result.message);
        }
    }

    showAchievementModal(achievement, userAchievement) {
        const modal = document.getElementById('achievement-modal');
        const title = document.getElementById('achievement-modal-title');
        const body = document.getElementById('achievement-modal-body');

        title.textContent = achievement.name;
        body.innerHTML = `
            <div class="achievement-details">
                <div class="achievement-icon-large">${achievement.icon || '🏆'}</div>
                <p class="achievement-description">${achievement.description}</p>
                <div class="achievement-info">
                    <div class="info-row"><strong>Category:</strong> ${achievement.category}</div>
                    <div class="info-row"><strong>Status:</strong> ${userAchievement ? (userAchievement.claimed ? 'Claimed' : 'Unlocked') : 'Locked'}</div>
                    ${userAchievement?.progress ? `<div class="info-row"><strong>Progress:</strong> ${userAchievement.progress}/100</div>` : ''}
                </div>
                ${userAchievement && !userAchievement.claimed ? `
                    <div class="achievement-rewards">
                        <h4>Rewards:</h4>
                        <div class="rewards-list">
                            ${achievement.reward_coins > 0 ? `<div class="reward-item">🪙 ${achievement.reward_coins} coins</div>` : ''}
                            ${achievement.reward_gems > 0 ? `<div class="reward-item">💎 ${achievement.reward_gems} gems</div>` : ''}
                            ${achievement.reward_xp > 0 ? `<div class="reward-item">⭐ ${achievement.reward_xp} XP</div>` : ''}
                        </div>
                        <button class="claim-achievement-btn" onclick="profilePage.claimAchievement('${achievement.id}')">Claim Rewards</button>
                    </div>
                ` : ''}
            </div>
        `;

        modal.classList.add('show');
    }

    closeAchievementModal() {
        document.getElementById('achievement-modal').classList.remove('show');
    }

    async claimAchievement(achievementId) {
        const result = await achievements.claimAchievementReward(achievementId);
        if (result.success) {
            alert(result.message);
            this.closeAchievementModal();
            await this.loadProfile(); // Update currency/XP
            await this.loadAchievements(); // Update achievements UI
        } else {
            alert(result.message);
        }
    }
}

// Export for entry point
export { ProfilePage };
