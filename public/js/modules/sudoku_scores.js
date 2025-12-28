// sudoku-scores.js - Quản lý thành tích Sudoku với Supabase

export class SudokuScores {
    constructor(supabase) {
        this.supabase = supabase;
    }

    // Lưu thành tích mới (chỉ nếu tốt hơn thành tích cũ)
    async saveScore(userId, difficulty, timeInSeconds, score = 0) {
        try {
            // Kiểm tra thành tích hiện tại - dùng limit(1) production-safe
            const { data, error: fetchError } = await this.supabase
                .from('sudoku_scores')
                .select('best_time, best_score')
                .eq('user_id', userId)
                .eq('difficulty', difficulty)
                .limit(1); // ✅ Production-safe, không bao giờ throw error

            if (fetchError) throw fetchError;

            const currentScore = data?.[0] || null;

            // Nếu chưa có thành tích hoặc thời gian tốt hơn (hoặc score cao hơn nếu có)
            const shouldUpdate = !currentScore ||
                timeInSeconds < currentScore.best_time ||
                (score > 0 && score > currentScore.best_score);

            if (shouldUpdate) {
                const { data, error } = await this.supabase
                    .from('sudoku_scores')
                    .upsert({
                        user_id: userId,
                        difficulty: difficulty,
                        best_time: timeInSeconds,
                        best_score: Math.max(score, currentScore?.best_score || 0),
                        completed_at: new Date().toISOString()
                    }, {
                        onConflict: 'user_id,difficulty'
                    });

                if (error) throw error;

                return {
                    success: true,
                    isNewRecord: !currentScore,
                    improved: currentScore ? currentScore.best_time - timeInSeconds : 0
                };
            }

            return { success: true, isNewRecord: false, improved: 0 };
        } catch (error) {
            console.error('Error saving Sudoku score:', error);
            return { success: false, error: error.message };
        }
    }

    // Lấy thành tích của user theo độ khó
    // ✅ Dùng limit(1) để tránh hoàn toàn lỗi PGRST116
    async getScore(userId, difficulty) {
        try {
            const { data, error } = await this.supabase
                .from('sudoku_scores')
                .select('best_time, best_score, completed_at')
                .eq('user_id', userId)
                .eq('difficulty', difficulty)
                .limit(1); // ✅ Production-safe, không bao giờ throw PGRST116

            if (error) throw error;

            return data.length ? data[0] : null; // ✅ 0 record → null, không error
        } catch (error) {
            console.error('Error getting Sudoku score:', error);
            return null;
        }
    }

    // Lấy tất cả thành tích của user
    async getAllScores(userId) {
        try {
            const { data, error } = await this.supabase
                .from('sudoku_scores')
                .select('difficulty, best_time, best_score, completed_at')
                .eq('user_id', userId)
                .order('difficulty');

            if (error) throw error;

            return data || [];
        } catch (error) {
            console.error('Error getting all Sudoku scores:', error);
            return [];
        }
    }

    // Format thời gian thành MM:SS
    formatTime(seconds) {
        const mins = String(Math.floor(seconds / 60)).padStart(2, '0');
        const secs = String(seconds % 60).padStart(2, '0');
        return `${mins}:${secs}`;
    }

    // Tính thống kê
    calculateStats(scores) {
        const stats = {
            totalGames: scores.length,
            bestTime: null,
            worstTime: null,
            averageTime: 0,
            favoriteDifficulty: null
        };

        if (scores.length === 0) return stats;

        let totalTime = 0;
        const difficultyCount = {};

        scores.forEach(score => {
            totalTime += score.best_time;

            if (!stats.bestTime || score.best_time < stats.bestTime) {
                stats.bestTime = score.best_time;
            }
            if (!stats.worstTime || score.best_time > stats.worstTime) {
                stats.worstTime = score.best_time;
            }

            difficultyCount[score.difficulty] = (difficultyCount[score.difficulty] || 0) + 1;
        });

        stats.averageTime = Math.round(totalTime / scores.length);

        // Tìm độ khó yêu thích (chơi nhiều nhất)
        stats.favoriteDifficulty = Object.entries(difficultyCount)
            .sort(([,a], [,b]) => b - a)[0][0];

        return stats;
    }
}
