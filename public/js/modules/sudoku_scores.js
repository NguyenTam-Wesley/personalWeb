// 🎯 Sudoku Scores Module - Quản lý thành tích Sudoku
// ✅ Lưu best time cho mỗi độ khó
// ✅ Hiển thị best time theo độ khó
// ✅ Dropdown thành tích tất cả độ khó

import { supabase } from '../supabase/supabase.js';
import { getCurrentUser } from '../supabase/auth.js';

export class SudokuScores {
    constructor() {
        // Cache để tránh query quá nhiều
        this.cache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 phút
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

    // Lưu thành tích mới (chỉ khi tốt hơn best_time hiện tại)
    async saveScore(difficulty, timeInSeconds) {
        if (!(await this.isLoggedIn())) {
            console.log('User not logged in');
            return false;
        }

        const user = await this.getCurrentUser();
        if (!user) return false;

        try {
            // Kiểm tra best_time hiện tại
            const currentBest = await this.getBestScore(difficulty);

            // Chỉ lưu nếu thời gian mới tốt hơn (nhỏ hơn) hoặc chưa có record
            if (currentBest === null || timeInSeconds < currentBest) {
                const { data, error } = await supabase
                    .from('sudoku_scores')
                    .upsert({
                        user_id: user.id,
                        difficulty: difficulty,
                        best_time: timeInSeconds,
                        completed_at: new Date().toISOString()
                    });

                if (error) {
                    console.error('Error saving score:', error);
                    return false;
                }

                // Clear cache cho difficulty này
                this.cache.delete(`best_${difficulty}`);
                this.cache.delete('all_scores');

                return true;
            }

            return false; // Không cải thiện được thành tích
        } catch (error) {
            console.error('Error in saveScore:', error);
            return false;
        }
    }

    // Lấy best time cho một độ khó cụ thể
    async getBestScore(difficulty) {
        if (!(await this.isLoggedIn())) {
            return null;
        }

        const cacheKey = `best_${difficulty}`;

        // Kiểm tra cache
        if (this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.cacheTimeout) {
                return cached.data;
            }
        }

        try {
            const user = await this.getCurrentUser();
            if (!user) return null;

            const { data, error } = await supabase
                .from('sudoku_scores')
                .select('best_time')
                .eq('user_id', user.id)
                .eq('difficulty', difficulty)
                .single();

            if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
                console.error('Error getting best score:', error);
                return null;
            }

            const bestTime = data ? data.best_time : null;

            // Cache kết quả
            this.cache.set(cacheKey, {
                data: bestTime,
                timestamp: Date.now()
            });

            return bestTime;
        } catch (error) {
            console.error('Error in getBestScore:', error);
            return null;
        }
    }

    // Lấy tất cả best times cho tất cả difficulties
    async getAllScores() {
        if (!(await this.isLoggedIn())) {
            return {};
        }

        // Kiểm tra cache
        if (this.cache.has('all_scores')) {
            const cached = this.cache.get('all_scores');
            if (Date.now() - cached.timestamp < this.cacheTimeout) {
                return cached.data;
            }
        }

        try {
            const user = await this.getCurrentUser();
            if (!user) return {};

            const { data, error } = await supabase
                .from('sudoku_scores')
                .select('difficulty, best_time')
                .eq('user_id', user.id);

            if (error) {
                console.error('Error getting all scores:', error);
                return {};
            }

            // Convert thành object {easy: time, medium: time, ...}
            const scores = {};
            data.forEach(record => {
                scores[record.difficulty] = record.best_time;
            });

            // Cache kết quả
            this.cache.set('all_scores', {
                data: scores,
                timestamp: Date.now()
            });

            return scores;
        } catch (error) {
            console.error('Error in getAllScores:', error);
            return {};
        }
    }

    // Format thời gian từ giây thành mm:ss
    formatTime(seconds) {
        if (seconds === null || seconds === undefined) {
            return '--:--';
        }

        const mins = String(Math.floor(seconds / 60)).padStart(2, '0');
        const secs = String(seconds % 60).padStart(2, '0');
        return `${mins}:${secs}`;
    }

    // Clear cache (có thể gọi khi user đăng xuất)
    clearCache() {
        this.cache.clear();
    }

    // Debug: log tất cả scores (cho development)
    async debugLogAllScores() {
        if (!(await this.isLoggedIn())) {
            console.log('User not logged in');
            return;
        }

        const scores = await this.getAllScores();
        console.log('All Sudoku Scores:', scores);
    }
}

// Export instance default để sử dụng trong entry
export const sudokuScores = new SudokuScores();
