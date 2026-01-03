// 🎯 Items Module - Quản lý items và inventory
// ✅ Lấy danh sách items có sẵn
// ✅ Quản lý inventory user
// ✅ Mua/bán items
// ✅ Sử dụng consumable items
// ✅ Cache để tối ưu performance

import { supabase } from '../supabase/supabase.js';
import { userProfile } from './user_profile.js';

export class Items {
    constructor() {
        // Cache để tránh query quá nhiều
        this.cache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 phút cho items
        this.inventoryCacheTimeout = 2 * 60 * 1000; // 2 phút cho inventory

        // Prevent concurrent buy operations
        this.buyInProgress = new Set();

        // Listen auth state changes để clear cache khi logout
        supabase.auth.onAuthStateChange((event, session) => {
            console.log('🔄 Items auth state:', event);

            if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
                if (session?.user) {
                    console.log('✅ Items: User logged in, ID:', session.user.id);

                    // Auto-load inventory khi user sign in
                    this.getUserInventory(true).catch(error => {
                        console.error('❌ Auto-load inventory failed:', error);
                    });
                }
            } else if (event === 'SIGNED_OUT') {
                // Clear cache khi logout
                this.clearCache();
            }
        });
    }

    // Helper method để validate user authentication
    async validateUser() {
        const user = await this.getCurrentUser();
        if (!user || !user.id) {
            return { isValid: false, user: null, error: 'Vui lòng đăng nhập để thực hiện thao tác này' };
        }
        return { isValid: true, user, error: null };
    }


    // Lấy thông tin user hiện tại (direct from Supabase Auth)
    async getCurrentUser() {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error) {
            console.error('❌ Auth getUser error:', error);
            return null;
        }
        if (!user) {
            console.warn('❌ getCurrentUser: No user from Supabase auth');
            return null;
        }
        return user;
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
        // Validate user first to get user ID for cache key
        const { isValid, user, error } = await this.validateUser();
        if (!isValid) {
            console.warn('🔍 getUserInventory:', error);
            return {};
        }

        const cacheKey = `user_inventory_${user.id}`;

        // Kiểm tra cache
        if (!forceRefresh && this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.inventoryCacheTimeout) {
                return cached.data;
            }
        }

        try {
            console.log('🔍 getUserInventory: User authenticated with ID:', user.id);
            console.log('🔍 getUserInventory: Querying user_items with user_id =', user.id);

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
        try {
            // Validate user authentication
            const { isValid, user, error } = await this.validateUser();
            if (!isValid) {
                return { success: false, message: error };
            }

            // Prevent concurrent buys for same item
            const buyKey = `${user.id}_${itemId}`;
            if (this.buyInProgress.has(buyKey)) {
                return { success: false, message: 'Đang xử lý giao dịch khác cho item này' };
            }
            this.buyInProgress.add(buyKey);

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

            // Double-check inventory right before purchase to prevent race conditions
            const latestInventory = await this.getUserInventory(true); // Force refresh
            const latestItem = latestInventory[itemId];
            const latestQuantity = latestItem ? latestItem.quantity : 0;

            if (item.max_owned && latestQuantity >= item.max_owned) {
                // Hoàn tiền lại
                if (item.price_coins > 0) {
                    await userProfile.addCoins(item.price_coins);
                } else if (item.price_gems > 0) {
                    await userProfile.addGems(item.price_gems);
                }
                return { success: false, message: `Bạn đã sở hữu tối đa ${item.max_owned} item này` };
            }

            // Insert/update inventory item
            {
                const { data, error } = await supabase
                    .from('user_items')
                    .upsert({
                        user_id: user.id,
                        item_id: itemId,
                        quantity: latestQuantity + 1
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
            }

            // Clear inventory cache
            this.cache.delete(`user_inventory_${user.id}`);

            return {
                success: true,
                message: `Đã mua ${item.name} thành công!`,
                item: item,
                newQuantity: latestQuantity + 1
            };
        } catch (error) {
            console.error('Error in buyItem:', error);
            return { success: false, message: 'Lỗi không xác định' };
        } finally {
            // Cleanup concurrent buy prevention
            this.buyInProgress.delete(buyKey);
        }
    }

    // Sử dụng consumable item
    async useItem(itemId, quantity = 1) {
        try {
            // Validate user authentication
            const { isValid, user, error } = await this.validateUser();
            if (!isValid) {
                return { success: false, message: error };
            }

            // Validate quantity
            if (quantity <= 0) {
                return { success: false, message: 'Số lượng phải lớn hơn 0' };
            }

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

            // Cleanup expired effects while we're at it
            await this.cleanupExpiredEffects(user.id);

            const newQuantity = Math.max(0, inventoryItem.quantity - quantity);

            // Validate final quantity is not negative (extra safety check)
            if (newQuantity < 0) {
                return { success: false, message: 'Số lượng không hợp lệ' };
            }

            if (newQuantity === 0) {
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
            this.cache.delete(`user_inventory_${user.id}`);

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
            // Use effect_type if available, otherwise fallback to mapping from item name
            const effectType = item.effect_type || this.getEffectTypeFromName(item.name);

            // Validate user for effect persistence
            const { isValid, user, error } = await this.validateUser();
            if (!isValid) {
                return { success: false, message: error };
            }

            let effect;
            switch (effectType) {
                case 'xp_boost':
                    // Tăng 50% XP trong thời gian sử dụng
                    // (Logic này sẽ được implement trong game rewards system)
                    effect = {
                        type: 'xp_boost',
                        value: 50,
                        duration: 60 * 60 * 1000, // 1 giờ
                        item_id: item.id,
                        quantity: quantity
                    };
                    break;

                case 'coin_boost':
                    // Tăng 25% coins từ games
                    effect = {
                        type: 'coin_boost',
                        value: 25,
                        duration: 60 * 60 * 1000, // 1 giờ
                        item_id: item.id,
                        quantity: quantity
                    };
                    break;

                case 'luck_boost':
                    // Tăng tỉ lệ nhận rare items
                    effect = {
                        type: 'luck_boost',
                        value: 10,
                        duration: 24 * 60 * 60 * 1000, // 24 giờ
                        item_id: item.id,
                        quantity: quantity
                    };
                    break;

                default:
                    return {
                        success: false,
                        message: `Effect type '${effectType}' chưa được implement`
                    };
            }

            // Save effect to database
            const saved = await this.saveActiveEffect(user.id, effect);
            if (!saved) {
                console.warn('⚠️ Effect applied but failed to persist to database');
            }

            return {
                success: true,
                effect: effect
            };
        } catch (error) {
            console.error('Error in applyItemEffect:', error);
            return { success: false, message: 'Lỗi khi áp dụng effect' };
        }
    }

    // Helper method để map item name sang effect type (backward compatibility)
    getEffectTypeFromName(itemName) {
        const nameToEffectMap = {
            'XP Booster': 'xp_boost',
            'Coin Magnet': 'coin_boost',
            'Lucky Charm': 'luck_boost'
        };
        return nameToEffectMap[itemName] || 'unknown';
    }

    // Lưu active effect vào database
    async saveActiveEffect(userId, effect) {
        try {
            const expiresAt = new Date(Date.now() + effect.duration);

            const { error } = await supabase
                .from('active_effects')
                .insert({
                    user_id: userId,
                    effect_type: effect.type,
                    value: effect.value,
                    expires_at: expiresAt.toISOString(),
                    item_id: effect.item_id
                });

            if (error) {
                console.error('Error saving active effect:', error);
                return false;
            }

            console.log('✅ Active effect saved:', data);
            return true;
        } catch (error) {
            console.error('Error in saveActiveEffect:', error);
            return false;
        }
    }

    // Lấy active effects của user
    async getActiveEffects(userId) {
        try {
            const { data, error } = await supabase
                .from('active_effects')
                .select('*')
                .eq('user_id', userId)
                .gt('expires_at', new Date().toISOString())
                .order('expires_at', { ascending: true });

            if (error) {
                console.error('Error getting active effects:', error);
                return [];
            }

            return data;
        } catch (error) {
            console.error('Error in getActiveEffects:', error);
            return [];
        }
    }

    // Xóa expired effects
    async cleanupExpiredEffects(userId) {
        try {
            const { error } = await supabase
                .from('active_effects')
                .delete()
                .eq('user_id', userId)
                .lt('expires_at', new Date().toISOString());

            if (error) {
                console.error('Error cleaning up expired effects:', error);
            }
        } catch (error) {
            console.error('Error in cleanupExpiredEffects:', error);
        }
    }

    // Thêm item vào inventory (cho rewards, etc.)
    async addItemToInventory(itemId, quantity = 1) {
        try {
            // Validate quantity
            if (quantity <= 0) {
                console.warn('🔍 addItemToInventory: Quantity phải lớn hơn 0');
                return false;
            }

            const { isValid, user, error } = await this.validateUser();
            if (!isValid) {
                console.warn('🔍 addItemToInventory:', error);
                return false;
            }

            // Kiểm tra item hiện có
            const currentItem = await this.getInventoryItem(itemId);
            const currentQuantity = currentItem ? currentItem.quantity : 0;

            // Insert/update inventory item
            {
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
            }

            // Clear inventory cache
            this.cache.delete(`user_inventory_${user.id}`);
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

    // Lấy effects đang active của user (cho rewards system)
    async getCurrentActiveEffects() {
        const { isValid, user, error } = await this.validateUser();
        if (!isValid) {
            console.warn('🔍 getCurrentActiveEffects:', error);
            return [];
        }

        // Cleanup expired effects first
        await this.cleanupExpiredEffects(user.id);

        return await this.getActiveEffects(user.id);
    }

    // Debug: log inventory
    async debugLogInventory() {
        const inventory = await this.getUserInventory(true);
        console.log('User Inventory:', inventory);
    }
}

// Export instance default
export const items = new Items();
