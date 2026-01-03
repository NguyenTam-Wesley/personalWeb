// 🎯 Pets Module - Quản lý pets và pet system
// ✅ Lấy danh sách pets có sẵn
// ✅ Quản lý pets của user
// ✅ Mua pets
// ✅ Set active pet với bonuses
// ✅ Feed pets với pet food
// ✅ Tính toán pet bonuses
// ✅ Cache để tối ưu performance

import { supabase } from '../supabase/supabase.js';
import { getCurrentUser } from '../supabase/auth.js';
import { userProfile } from './user_profile.js';
import { items } from './items.js';

export class Pets {
    constructor() {
        // Cache để tránh query quá nhiều
        this.cache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 phút cho pets
        this.userPetsCacheTimeout = 2 * 60 * 1000; // 2 phút cho user pets
    }

    // Kiểm tra user đã đăng nhập chưa
    async isLoggedIn() {
        const userData = await getCurrentUser();
        return !!userData?.user;
    }

    // Lấy thông tin user hiện tại từ auth.js
    async getCurrentUserData() {
        return await getCurrentUser();
    }

    // Helper function để lấy user ID một cách an toàn
    async getUserId() {
        const userData = await this.getCurrentUserData();
        if (!userData?.user) {
            console.error('No user data found');
            return null;
        }
        
        // userData có cấu trúc: { user, profile }
        // user.id là UUID từ auth
        return userData.user.id;
    }

    // Lấy danh sách tất cả pets có sẵn
    async getAllPets(forceRefresh = false) {
        const cacheKey = 'all_pets';

        // Kiểm tra cache
        if (!forceRefresh && this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.cacheTimeout) {
                return cached.data;
            }
        }

        try {
            const { data, error } = await supabase
                .from('pets')
                .select('*')
                .eq('is_available', true)
                .order('rarity', { ascending: false })
                .order('name');

            if (error) {
                console.error('Error getting all pets:', error);
                return [];
            }

            // Cache kết quả
            this.cache.set(cacheKey, {
                data: data || [],
                timestamp: Date.now()
            });

            return data || [];
        } catch (error) {
            console.error('Error in getAllPets:', error);
            return [];
        }
    }

    // Lấy pets theo rarity
    async getPetsByRarity(rarity, forceRefresh = false) {
        const allPets = await this.getAllPets(forceRefresh);
        return allPets.filter(pet => pet.rarity === rarity);
    }

    // Lấy pets user sở hữu
    async getUserPets(forceRefresh = false) {
        if (!(await this.isLoggedIn())) {
            console.log('User not logged in, returning empty pets array');
            return [];
        }

        const cacheKey = 'user_pets';

        // Kiểm tra cache
        if (!forceRefresh && this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.userPetsCacheTimeout) {
                return cached.data;
            }
        }

        try {
            const userId = await this.getUserId();
            if (!userId) {
                console.error('User ID not found in getUserPets');
                return [];
            }

            console.log('Fetching pets for user:', userId);

            const { data, error } = await supabase
                .from('user_pets')
                .select(`
                    id,
                    is_active,
                    acquired_at,
                    last_fed_at,
                    happiness_level,
                    pets (
                        id,
                        name,
                        description,
                        rarity,
                        happiness_boost,
                        luck_boost,
                        unlock_level
                    )
                `)
                .eq('user_id', userId);

            if (error) {
                console.error('Error getting user pets:', error);
                return [];
            }

            // Cache kết quả
            this.cache.set(cacheKey, {
                data: data || [],
                timestamp: Date.now()
            });

            return data || [];
        } catch (error) {
            console.error('Error in getUserPets:', error);
            return [];
        }
    }

    // Lấy pet đang active
    async getActivePet() {
        const userPets = await this.getUserPets();
        return userPets.find(pet => pet.is_active) || null;
    }

    // Lấy thông tin pet cụ thể của user
    async getUserPet(petId) {
        const userPets = await this.getUserPets();
        return userPets.find(pet => pet.pets.id === petId) || null;
    }

    // Kiểm tra user có sở hữu pet không
    async ownsPet(petId) {
        const userPet = await this.getUserPet(petId);
        return !!userPet;
    }

    // Mua pet
    async buyPet(petId) {
        if (!(await this.isLoggedIn())) {
            return { success: false, message: 'Vui lòng đăng nhập để mua pets' };
        }

        try {
            // Kiểm tra đã sở hữu chưa
            if (await this.ownsPet(petId)) {
                return { success: false, message: 'Bạn đã sở hữu pet này rồi' };
            }

            // Lấy thông tin pet
            const allPets = await this.getAllPets();
            const pet = allPets.find(p => p.id === petId);

            if (!pet) {
                return { success: false, message: 'Pet không tồn tại' };
            }

            if (!pet.is_available) {
                return { success: false, message: 'Pet không còn khả dụng' };
            }

            // Kiểm tra level yêu cầu
            const profile = await userProfile.getProfile();
            if (!profile) {
                return { success: false, message: 'Không thể tải thông tin user' };
            }

            if (profile.level < pet.unlock_level) {
                return { success: false, message: `Cần đạt level ${pet.unlock_level} để mua pet này` };
            }

            // Kiểm tra đủ tiền
            let currencySpent = false;
            if (pet.price_coins > 0) {
                if (profile.coins < pet.price_coins) {
                    return { success: false, message: 'Không đủ coins' };
                }
                currencySpent = await userProfile.spendCoins(pet.price_coins);
            } else if (pet.price_gems > 0) {
                if (profile.gems < pet.price_gems) {
                    return { success: false, message: 'Không đủ gems' };
                }
                currencySpent = await userProfile.spendGems(pet.price_gems);
            }

            if (!currencySpent) {
                return { success: false, message: 'Lỗi khi thanh toán' };
            }

            // Thêm pet vào user_pets
            const userId = await this.getUserId();
            if (!userId) {
                return { success: false, message: 'Không thể lấy user ID' };
            }

            const { data, error } = await supabase
                .from('user_pets')
                .insert({
                    user_id: userId,
                    pet_id: petId,
                    is_active: false,
                    happiness_level: 100
                })
                .select()
                .single();

            if (error) {
                console.error('Error buying pet:', error);
                // Hoàn tiền lại
                if (pet.price_coins > 0) {
                    await userProfile.addCoins(pet.price_coins);
                } else if (pet.price_gems > 0) {
                    await userProfile.addGems(pet.price_gems);
                }
                return { success: false, message: 'Lỗi khi mua pet' };
            }

            // Clear user pets cache
            this.cache.delete('user_pets');

            return {
                success: true,
                message: `Đã mua ${pet.name} thành công!`,
                pet: pet
            };
        } catch (error) {
            console.error('Error in buyPet:', error);
            return { success: false, message: 'Lỗi không xác định' };
        }
    }

    // Set active pet
    async setActivePet(petId) {
        if (!(await this.isLoggedIn())) {
            return { success: false, message: 'Vui lòng đăng nhập' };
        }

        try {
            // Kiểm tra sở hữu pet
            if (!(await this.ownsPet(petId))) {
                return { success: false, message: 'Bạn không sở hữu pet này' };
            }

            const userId = await this.getUserId();
            if (!userId) {
                return { success: false, message: 'Không thể lấy user ID' };
            }

            // Set tất cả pets thành inactive
            const { error: updateError } = await supabase
                .from('user_pets')
                .update({ is_active: false })
                .eq('user_id', userId);

            if (updateError) {
                console.error('Error deactivating pets:', updateError);
                return { success: false, message: 'Lỗi khi cập nhật pet' };
            }

            // Set pet mới thành active
            const { error: activateError } = await supabase
                .from('user_pets')
                .update({ is_active: true })
                .eq('user_id', userId)
                .eq('pet_id', petId);

            if (activateError) {
                console.error('Error activating pet:', activateError);
                return { success: false, message: 'Lỗi khi kích hoạt pet' };
            }

            // Clear user pets cache
            this.cache.delete('user_pets');

            // Lấy thông tin pet để trả về
            const allPets = await this.getAllPets();
            const pet = allPets.find(p => p.id === petId);

            return {
                success: true,
                message: `${pet.name} đã được kích hoạt!`,
                pet: pet
            };
        } catch (error) {
            console.error('Error in setActivePet:', error);
            return { success: false, message: 'Lỗi không xác định' };
        }
    }

    // Feed pet với pet food
    async feedPet(petId) {
        if (!(await this.isLoggedIn())) {
            return { success: false, message: 'Vui lòng đăng nhập' };
        }

        try {
            // Kiểm tra sở hữu pet
            const userPet = await this.getUserPet(petId);
            if (!userPet) {
                return { success: false, message: 'Bạn không sở hữu pet này' };
            }

            // Kiểm tra có pet food không
            const hasPetFood = await items.hasItem('pet_food_item_id', 1);
            if (!hasPetFood) {
                return { success: false, message: 'Bạn không có pet food' };
            }

            // Sử dụng pet food
            const useResult = await items.useItem('pet_food_item_id', 1);
            if (!useResult.success) {
                return useResult;
            }

            // Cập nhật happiness và last_fed_at
            const userId = await this.getUserId();
            if (!userId) {
                return { success: false, message: 'Không thể lấy user ID' };
            }

            const newHappiness = Math.min(userPet.happiness_level + 25, 100);

            const { error } = await supabase
                .from('user_pets')
                .update({
                    happiness_level: newHappiness,
                    last_fed_at: new Date().toISOString()
                })
                .eq('user_id', userId)
                .eq('pet_id', petId);

            if (error) {
                console.error('Error feeding pet:', error);
                return { success: false, message: 'Lỗi khi cho pet ăn' };
            }

            // Clear user pets cache
            this.cache.delete('user_pets');

            return {
                success: true,
                message: `${userPet.pets.name} đã được cho ăn! Happiness: ${newHappiness}/100`,
                newHappiness: newHappiness
            };
        } catch (error) {
            console.error('Error in feedPet:', error);
            return { success: false, message: 'Lỗi không xác định' };
        }
    }

    // Tính toán pet bonuses hiện tại
    async getCurrentPetBonuses() {
        const activePet = await this.getActivePet();
        if (!activePet) {
            return { happiness_boost: 0, luck_boost: 0 };
        }

        // Happiness level ảnh hưởng đến effectiveness của bonuses
        const happinessMultiplier = activePet.happiness_level / 100;

        return {
            happiness_boost: activePet.pets.happiness_boost * happinessMultiplier,
            luck_boost: activePet.pets.luck_boost * happinessMultiplier
        };
    }

    // Tự động giảm happiness theo thời gian
    async updatePetHappiness() {
        if (!(await this.isLoggedIn())) {
            return;
        }

        try {
            const userPets = await this.getUserPets();
            const userId = await this.getUserId();

            if (!userId) {
                console.error('No user ID for happiness update');
                return;
            }

            const updates = userPets.map(pet => {
                const lastFed = new Date(pet.last_fed_at || pet.acquired_at);
                const hoursSinceFed = (Date.now() - lastFed.getTime()) / (1000 * 60 * 60);
                const happinessDecrease = Math.floor(hoursSinceFed);
                const newHappiness = Math.max(pet.happiness_level - happinessDecrease, 0);

                return {
                    id: pet.id,
                    happiness_level: newHappiness
                };
            }).filter(update => update.happiness_level !== userPets.find(p => p.id === update.id).happiness_level);

            if (updates.length > 0) {
                for (const update of updates) {
                    await supabase
                        .from('user_pets')
                        .update({ happiness_level: update.happiness_level })
                        .eq('id', update.id);
                }

                // Clear cache
                this.cache.delete('user_pets');
            }
        } catch (error) {
            console.error('Error updating pet happiness:', error);
        }
    }

    // Clear cache
    clearCache() {
        this.cache.clear();
    }

    // Debug: log user pets
    async debugLogUserPets() {
        console.log('=== DEBUG USER PETS ===');
        const userData = await this.getCurrentUserData();
        console.log('User Data:', userData);
        console.log('User ID:', userData?.user?.id);
        console.log('Profile:', userData?.profile);
        
        const userPets = await this.getUserPets(true);
        console.log('User Pets:', userPets);
        console.log('======================');
    }
}

// Export instance default
export const pets = new Pets();