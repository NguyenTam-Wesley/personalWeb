// 🎯 Items Module - Quản lý items và inventory
// ✅ Lấy danh sách items có sẵn
// ✅ Quản lý inventory user
// ✅ Mua/bán items
// ✅ Sử dụng consumable items
// ✅ Cache để tối ưu performance

import { supabase } from '../supabase/supabase.js';
import { getCurrentUser } from '../supabase/auth.js';
import { userProfile } from './user_profile.js';

export class Items {
    constructor() {
        // Cache để tránh query quá nhiều
        this.cache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 phút cho items
        this.inventoryCacheTimeout = 2 * 60 * 1000; // 2 phút cho inventory
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

    // Lấy danh sách tất cả items có sẵn
    async getAllItems(forceRefresh = false) {
        const cacheKey = 'all_items';

        // Kiểm tra cache
        if (!forceRefresh && this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.cacheTimeout) {
                return cached.data;
            }
        }

        try {
            const { data, error } = await supabase
                .from('items')
                .select('*')
                .eq('is_available', true)
                .order('rarity', { ascending: false })
                .order('name');

            if (error) {
                console.error('Error getting all items:', error);
                return [];
            }

            // Cache kết quả
            this.cache.set(cacheKey, {
                data: data,
                timestamp: Date.now()
            });

            return data;
        } catch (error) {
            console.error('Error in getAllItems:', error);
            return [];
        }
    }

    // Lấy items theo loại
    async getItemsByType(type, forceRefresh = false) {
        const allItems = await this.getAllItems(forceRefresh);
        return allItems.filter(item => item.type === type);
    }

    // Lấy items theo rarity
    async getItemsByRarity(rarity, forceRefresh = false) {
        const allItems = await this.getAllItems(forceRefresh);
        return allItems.filter(item => item.rarity === rarity);
    }

    // Lấy inventory của user
    async getUserInventory(forceRefresh = false) {
        if (!(await this.isLoggedIn())) {
            return {};
        }

        const cacheKey = 'user_inventory';

        // Kiểm tra cache
        if (!forceRefresh && this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.inventoryCacheTimeout) {
                return cached.data;
            }
        }

        try {
            const user = await this.getCurrentUser();
            if (!user) return {};

            const { data, error } = await supabase
                .from('user_items')
                .select(`
                    id,
                    quantity,
                    acquired_at,
                    items (
                        id,
                        name,
                        description,
                        type,
                        rarity,
                        price_coins,
                        price_gems,
                        max_owned
                    )
                `)
                .eq('user_id', user.id);

            if (error) {
                console.error('Error getting user inventory:', error);
                return {};
            }

            // Convert thành object {item_id: {item: {...}, quantity: X}}
            const inventory = {};
            data.forEach(record => {
                inventory[record.items.id] = {
                    item: record.items,
                    quantity: record.quantity,
                    acquired_at: record.acquired_at,
                    record_id: record.id
                };
            });

            // Cache kết quả
            this.cache.set(cacheKey, {
                data: inventory,
                timestamp: Date.now()
            });

            return inventory;
        } catch (error) {
            console.error('Error in getUserInventory:', error);
            return {};
        }
    }

    // Lấy thông tin item cụ thể từ inventory
    async getInventoryItem(itemId) {
        const inventory = await this.getUserInventory();
        return inventory[itemId] || null;
    }

    // Kiểm tra user có đủ item không
    async hasItem(itemId, quantity = 1) {
        const item = await this.getInventoryItem(itemId);
        return item && item.quantity >= quantity;
    }

    // Mua item
    async buyItem(itemId) {
        if (!(await this.isLoggedIn())) {
            return { success: false, message: 'Vui lòng đăng nhập để mua items' };
        }

        try {
            // Lấy thông tin item
            const allItems = await this.getAllItems();
            const item = allItems.find(i => i.id === itemId);

            if (!item) {
                return { success: false, message: 'Item không tồn tại' };
            }

            if (!item.is_available) {
                return { success: false, message: 'Item không còn khả dụng' };
            }

            // Kiểm tra profile và đủ tiền
            const profile = await userProfile.getProfile();
            if (!profile) {
                return { success: false, message: 'Không thể tải thông tin user' };
            }

            let currencySpent = false;
            if (item.price_coins > 0) {
                if (profile.coins < item.price_coins) {
                    return { success: false, message: 'Không đủ coins' };
                }
                currencySpent = await userProfile.spendCoins(item.price_coins);
            } else if (item.price_gems > 0) {
                if (profile.gems < item.price_gems) {
                    return { success: false, message: 'Không đủ gems' };
                }
                currencySpent = await userProfile.spendGems(item.price_gems);
            }

            if (!currencySpent) {
                return { success: false, message: 'Lỗi khi thanh toán' };
            }

            // Kiểm tra số lượng hiện có
            const currentItem = await this.getInventoryItem(itemId);
            const currentQuantity = currentItem ? currentItem.quantity : 0;

            // Kiểm tra max_owned
            if (item.max_owned && currentQuantity >= item.max_owned) {
                // Hoàn tiền lại
                if (item.price_coins > 0) {
                    await userProfile.addCoins(item.price_coins);
                } else if (item.price_gems > 0) {
                    await userProfile.addGems(item.price_gems);
                }
                return { success: false, message: `Bạn đã sở hữu tối đa ${item.max_owned} item này` };
            }

            // Thêm vào inventory
            const user = await this.getCurrentUser();
            const { data, error } = await supabase
                .from('user_items')
                .upsert({
                    user_id: user.id,
                    item_id: itemId,
                    quantity: currentQuantity + 1
                })
                .select()
                .single();

            if (error) {
                console.error('Error buying item:', error);
                // Hoàn tiền lại
                if (item.price_coins > 0) {
                    await userProfile.addCoins(item.price_coins);
                } else if (item.price_gems > 0) {
                    await userProfile.addGems(item.price_gems);
                }
                return { success: false, message: 'Lỗi khi mua item' };
            }

            // Clear inventory cache
            this.cache.delete('user_inventory');

            return {
                success: true,
                message: `Đã mua ${item.name} thành công!`,
                item: item,
                newQuantity: currentQuantity + 1
            };
        } catch (error) {
            console.error('Error in buyItem:', error);
            return { success: false, message: 'Lỗi không xác định' };
        }
    }

    // Sử dụng consumable item
    async useItem(itemId, quantity = 1) {
        if (!(await this.isLoggedIn())) {
            return { success: false, message: 'Vui lòng đăng nhập' };
        }

        try {
            const inventoryItem = await this.getInventoryItem(itemId);
            if (!inventoryItem || inventoryItem.quantity < quantity) {
                return { success: false, message: 'Không đủ item để sử dụng' };
            }

            // Kiểm tra item type
            if (inventoryItem.item.type !== 'consumable') {
                return { success: false, message: 'Item này không thể sử dụng' };
            }

            // Áp dụng effect dựa trên item
            const result = await this.applyItemEffect(inventoryItem.item, quantity);
            if (!result.success) {
                return result;
            }

            // Giảm số lượng item
            const user = await this.getCurrentUser();
            const newQuantity = inventoryItem.quantity - quantity;

            if (newQuantity <= 0) {
                // Xóa item khỏi inventory
                const { error } = await supabase
                    .from('user_items')
                    .delete()
                    .eq('user_id', user.id)
                    .eq('item_id', itemId);

                if (error) {
                    console.error('Error removing item:', error);
                    return { success: false, message: 'Lỗi khi xóa item' };
                }
            } else {
                // Cập nhật số lượng
                const { error } = await supabase
                    .from('user_items')
                    .update({ quantity: newQuantity })
                    .eq('user_id', user.id)
                    .eq('item_id', itemId);

                if (error) {
                    console.error('Error updating item quantity:', error);
                    return { success: false, message: 'Lỗi khi cập nhật số lượng' };
                }
            }

            // Clear inventory cache
            this.cache.delete('user_inventory');

            return {
                success: true,
                message: `Đã sử dụng ${inventoryItem.item.name}!`,
                effect: result.effect
            };
        } catch (error) {
            console.error('Error in useItem:', error);
            return { success: false, message: 'Lỗi không xác định' };
        }
    }

    // Áp dụng effect của item
    async applyItemEffect(item, quantity) {
        try {
            switch (item.name) {
                case 'XP Booster':
                    // Tăng 50% XP trong thời gian sử dụng
                    // (Logic này sẽ được implement trong game rewards system)
                    return {
                        success: true,
                        effect: {
                            type: 'xp_boost',
                            value: 50,
                            duration: 60 * 60 * 1000 // 1 giờ
                        }
                    };

                case 'Coin Magnet':
                    // Tăng 25% coins từ games
                    return {
                        success: true,
                        effect: {
                            type: 'coin_boost',
                            value: 25,
                            duration: 60 * 60 * 1000 // 1 giờ
                        }
                    };

                case 'Lucky Charm':
                    // Tăng tỉ lệ nhận rare items
                    return {
                        success: true,
                        effect: {
                            type: 'luck_boost',
                            value: 10,
                            duration: 24 * 60 * 60 * 1000 // 24 giờ
                        }
                    };

                default:
                    return {
                        success: false,
                        message: 'Effect chưa được implement'
                    };
            }
        } catch (error) {
            console.error('Error in applyItemEffect:', error);
            return { success: false, message: 'Lỗi khi áp dụng effect' };
        }
    }

    // Thêm item vào inventory (cho rewards, etc.)
    async addItemToInventory(itemId, quantity = 1) {
        if (!(await this.isLoggedIn())) {
            return false;
        }

        try {
            const user = await this.getCurrentUser();

            // Kiểm tra item hiện có
            const currentItem = await this.getInventoryItem(itemId);
            const currentQuantity = currentItem ? currentItem.quantity : 0;

            const { data, error } = await supabase
                .from('user_items')
                .upsert({
                    user_id: user.id,
                    item_id: itemId,
                    quantity: currentQuantity + quantity
                })
                .select()
                .single();

            if (error) {
                console.error('Error adding item to inventory:', error);
                return false;
            }

            // Clear inventory cache
            this.cache.delete('user_inventory');
            return true;
        } catch (error) {
            console.error('Error in addItemToInventory:', error);
            return false;
        }
    }

    // Clear cache
    clearCache() {
        this.cache.clear();
    }

    // Debug: log inventory
    async debugLogInventory() {
        const inventory = await this.getUserInventory(true);
        console.log('User Inventory:', inventory);
    }
}

// Export instance default
export const items = new Items();
