// 🎯 Shop Page JavaScript
// ✅ Load và hiển thị items và pets có thể mua
// ✅ Handle purchase logic
// ✅ Update currency display
// ✅ Filter items by type

import { userProfile } from './user_profile.js';
import { items } from './items.js';
import { pets } from './pets.js';
import {
  getCurrentUser,
  logoutUser
} from '../supabase/auth.js';

class ShopPage {
    constructor() {
        this.currentTab = 'items';
        this.currentFilter = 'all';
        this.selectedItem = null;
        this.init();
    }

    async init() {
        await this.checkAuth();
        this.setupEventListeners();
        await this.loadCurrency();
        await this.loadCurrentTab();
    }

    async checkAuth() {
        const user = await getCurrentUser();
        if (!user) {
            window.location.href = '/pages/login.html';
            return;
        }
    }

    setupEventListeners() {
        // Tab switching
        const shopTabs = document.querySelectorAll('.shop-tab');
        shopTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const category = tab.dataset.category;
                this.switchTab(category);
            });
        });

        // Item filtering
        const filterBtns = document.querySelectorAll('.filter-btn');
        filterBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const filter = btn.dataset.filter;
                this.setFilter(filter);
            });
        });

        // Modal close
        document.getElementById('purchase-modal-close')?.addEventListener('click', () => {
            this.closePurchaseModal();
        });

        document.getElementById('purchase-cancel')?.addEventListener('click', () => {
            this.closePurchaseModal();
        });

        document.getElementById('purchase-confirm')?.addEventListener('click', async () => {
            await this.confirmPurchase();
        });

        // Close modal when clicking outside
        document.getElementById('purchase-modal')?.addEventListener('click', (e) => {
            if (e.target.id === 'purchase-modal') {
                this.closePurchaseModal();
            }
        });
    }

    async switchTab(tab) {
        // Update tab buttons
        document.querySelectorAll('.shop-tab').forEach(button => {
            button.classList.remove('active');
        });
        document.querySelector(`[data-category="${tab}"]`).classList.add('active');

        // Update tab content
        document.querySelectorAll('.shop-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(`${tab}-shop`).classList.add('active');

        this.currentTab = tab;
        await this.loadCurrentTab();
    }

    async loadCurrentTab() {
        if (this.currentTab === 'items') {
            await this.loadItems();
        } else if (this.currentTab === 'pets') {
            await this.loadPets();
        }
    }

    async loadCurrency() {
        try {
            const profile = await userProfile.getProfile();
            if (profile) {
                document.getElementById('coins-amount').textContent = userProfile.formatNumber(profile.coins);
                document.getElementById('gems-amount').textContent = userProfile.formatNumber(profile.gems);
            }
        } catch (error) {
            console.error('Error loading currency:', error);
        }
    }

    async loadItems() {
        try {
            const allItems = await items.getAllItems();
            const itemsGrid = document.getElementById('items-grid');

            itemsGrid.innerHTML = '';

            let filteredItems = allItems;
            if (this.currentFilter !== 'all') {
                filteredItems = allItems.filter(item => item.type === this.currentFilter);
            }

            filteredItems.forEach(item => {
                const itemElement = this.createShopItem(item);
                itemsGrid.appendChild(itemElement);
            });
        } catch (error) {
            console.error('Error loading items:', error);
        }
    }

    createShopItem(item) {
        const itemDiv = document.createElement('div');
        itemDiv.className = `shop-item ${!item.is_available ? 'sold-out' : ''}`;

        if (item.is_available) {
            itemDiv.onclick = () => this.showPurchaseModal('item', item);
        }

        const priceText = item.price_coins > 0 ?
            `${item.price_coins}🪙` :
            `${item.price_gems}💎`;

        itemDiv.innerHTML = `
            <div class="item-icon">${this.getItemIcon(item.type)}</div>
            <div class="item-name">${item.name}</div>
            <div class="item-description">${item.description}</div>
            <div class="item-price">
                <span class="currency-icon">${item.price_coins > 0 ? '🪙' : '💎'}</span>
                <span>${item.price_coins > 0 ? item.price_coins : item.price_gems}</span>
            </div>
            <div class="item-rarity ${item.rarity}">${item.rarity}</div>
            ${!item.is_available ? '<div class="sold-out-badge">Sold Out</div>' : ''}
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

    setFilter(filter) {
        // Update filter buttons
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-filter="${filter}"]`).classList.add('active');

        this.currentFilter = filter;
        this.loadItems();
    }

    async loadPets() {
        try {
            const allPets = await pets.getAllPets();
            const petsGrid = document.getElementById('pets-grid');

            petsGrid.innerHTML = '';

            allPets.forEach(pet => {
                const petElement = this.createShopPet(pet);
                petsGrid.appendChild(petElement);
            });
        } catch (error) {
            console.error('Error loading pets:', error);
        }
    }

    async createShopPet(pet) {
        const owned = await pets.ownsPet(pet.id);
        const profile = await userProfile.getProfile();
        const canAfford = (pet.price_coins > 0 && profile.coins >= pet.price_coins) ||
                          (pet.price_gems > 0 && profile.gems >= pet.price_gems);
        const meetsRequirement = !profile || profile.level >= pet.unlock_level;

        const petDiv = document.createElement('div');
        petDiv.className = `pet-card ${!meetsRequirement ? 'locked' : ''}`;

        if (pet.is_available && !owned && meetsRequirement && canAfford) {
            petDiv.onclick = () => this.showPurchaseModal('pet', pet);
        }

        const priceText = pet.price_coins > 0 ?
            `${pet.price_coins}🪙` :
            `${pet.price_gems}💎`;

        let statusText = 'Available';
        let statusClass = 'available';

        if (owned) {
            statusText = 'Owned';
            statusClass = 'owned';
        } else if (!meetsRequirement) {
            statusText = `Requires Lv.${pet.unlock_level}`;
            statusClass = 'locked';
        } else if (!canAfford) {
            statusText = 'Not enough currency';
            statusClass = 'locked';
        }

        petDiv.innerHTML = `
            <div class="pet-icon">${this.getPetEmoji(pet.name)}</div>
            <div class="pet-name">${pet.name}</div>
            <div class="pet-description">${pet.description}</div>
            <div class="pet-stats">
                <div class="pet-stat">
                    <div class="pet-stat-value">+${pet.happiness_boost}%</div>
                    <div>Happiness</div>
                </div>
                <div class="pet-stat">
                    <div class="pet-stat-value">+${pet.luck_boost}%</div>
                    <div>Luck</div>
                </div>
            </div>
            <div class="pet-price">
                <span class="currency-icon">${pet.price_coins > 0 ? '🪙' : '💎'}</span>
                <span>${pet.price_coins > 0 ? pet.price_coins : pet.price_gems}</span>
            </div>
            ${!meetsRequirement ? `<div class="pet-requirement">Level ${pet.unlock_level} required</div>` : ''}
            <div class="pet-status ${statusClass}">${statusText}</div>
        `;

        return petDiv;
    }

    getPetEmoji(petName) {
        const emojis = {
            'Lucky Cat': '🐱',
            'Wise Owl': '🦉',
            'Golden Dragon': '🐉'
        };
        return emojis[petName] || '🐾';
    }

    showPurchaseModal(type, item) {
        this.selectedItem = { type, item };
        const modal = document.getElementById('purchase-modal');
        const title = document.getElementById('purchase-modal-title');
        const body = document.getElementById('purchase-modal-body');

        title.textContent = `Buy ${item.name}?`;

        const priceText = item.price_coins > 0 ?
            `${item.price_coins} coins` :
            `${item.price_gems} gems`;

        body.innerHTML = `
            <div class="purchase-details">
                <div class="purchase-icon">${type === 'item' ? this.getItemIcon(item.type) : this.getPetEmoji(item.name)}</div>
                <div class="purchase-info">
                    <h4>${item.name}</h4>
                    <p>${item.description}</p>
                    <div class="purchase-price">
                        <strong>Price: ${priceText}</strong>
                    </div>
                </div>
            </div>
            <div class="purchase-confirm-text">
                Are you sure you want to purchase this ${type}?
            </div>
        `;

        modal.classList.add('show');
    }

    closePurchaseModal() {
        document.getElementById('purchase-modal').classList.remove('show');
        this.selectedItem = null;
    }

    async confirmPurchase() {
        if (!this.selectedItem) return;

        const { type, item } = this.selectedItem;
        let result;

        try {
            if (type === 'item') {
                result = await items.buyItem(item.id);
            } else if (type === 'pet') {
                result = await pets.buyPet(item.id);
            }

            if (result.success) {
                alert(result.message);
                this.closePurchaseModal();
                await this.loadCurrency(); // Update currency display

                if (type === 'item') {
                    await this.loadItems(); // Reload items if bought an item
                } else {
                    await this.loadPets(); // Reload pets if bought a pet
                }
            } else {
                alert(result.message);
            }
        } catch (error) {
            console.error('Error during purchase:', error);
            alert('An error occurred during purchase');
        }
    }
}

// Export for entry point
export { ShopPage };
