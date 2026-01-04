// Difficulty constants
const DIFFICULTY = {
    EASY: "easy",
    MEDIUM: "medium",
    HARD: "hard",
    VERY_HARD: "very_hard",
    EXPERT: "expert"
};

// Import modules
import { rewards } from './rewards.js';
import { achievements } from './achievements.js';
import { supabase } from '../supabase/supabase.js';

// Utility function to format time
function formatTime(seconds) {
    if (seconds === null || seconds === undefined) {
        return '--:--';
    }

    const mins = String(Math.floor(seconds / 60)).padStart(2, '0');
    const secs = String(seconds % 60).padStart(2, '0');
    return `${mins}:${secs}`;
}

const DIFFICULTY_SETTINGS = {
    easy: { min: 35, max: 40, name: "EZ" },
    medium: { min: 45, max: 50, name: "MED" },
    hard: { min: 50, max: 55, name: "HARD" },
    very_hard: { min: 55, max: 60, name: "VERY HARD" },
    expert: { min: 60, max: 64, name: "EXPERT" }
};

// Hint penalty time in seconds (1,2,3,4,5 minutes)
const HINT_PENALTY = {
    easy: 60,        // 1 minute
    medium: 120,     // 2 minutes
    hard: 180,       // 3 minutes
    very_hard: 240,  // 4 minutes
    expert: 300      // 5 minutes
};

export class SudokuGame {
    constructor(sudokuScoresInstance = null, difficulty = DIFFICULTY.MEDIUM) {
        // Legacy parameter for backward compatibility
        this.sudokuScores = sudokuScoresInstance;
        this.difficulty = difficulty;

        // State duy nhất cho ô đang chọn
        this.selectedCell = null;

        // Khởi tạo rỗng - sẽ được tạo trong Web Worker sau

        this.grid = document.getElementById("sudoku-grid");
        this.checkBtn = document.getElementById("checkBtn");
        this.resetBtn = document.getElementById("resetBtn");
        this.hintBtn = document.getElementById("hintBtn");
        this.newGameBtn = document.getElementById("newGameBtn");
        this.difficultySelect = document.getElementById("difficulty");
        this.loadingIndicator = document.getElementById("loadingIndicator");
        this.bestTimeDisplay = document.getElementById("best-time-display");
        this.rankDisplay = document.getElementById("rank-display");
        this.achievementsBtn = document.getElementById("achievementsBtn");
        this.achievementsDropdown = document.getElementById("achievementsDropdown");
        this.achievementsList = document.getElementById("achievements-list");
        this.leaderboardBtn = document.getElementById("leaderboardBtn");
        this.leaderboardDropdown = document.getElementById("leaderboardDropdown");
        this.leaderboardList = document.getElementById("leaderboard-list");

        // Game config cache
        this.gameConfig = null;

        // Number input buttons for mobile
        this.numberButtons = document.getElementById("number-buttons");
        this.deleteBtn = document.getElementById("deleteBtn");

        // Web Worker cho việc sinh Sudoku
        this.worker = null;

        // Timer variables
        this.timer = null;
        this.seconds = 0;
        this.isRunning = false;
        this.timerEl = document.getElementById("timer");

        // Set difficulty select value
        if (this.difficultySelect) {
            this.difficultySelect.value = this.difficulty;
        }

        this.init();
    }

    // Load game configuration for current difficulty
    async loadGameConfig() {
        const cacheKey = `config_${this.difficulty}`;
        if (this.gameConfig && this.gameConfig.difficulty === this.difficulty) {
            return this.gameConfig;
        }

        try {
            // Get game ID
            const { data: gameData, error: gameError } = await supabase
                .from('games')
                .select('id')
                .eq('code', 'sudoku')
                .maybeSingle();

            if (gameError || !gameData) {
                console.error('Failed to load game config:', gameError);
                return null;
            }

            // Get mode ID for current difficulty
            const { data: modeData, error: modeError } = await supabase
                .from('game_modes')
                .select('id')
                .eq('game_id', gameData.id)
                .eq('code', this.difficulty)
                .maybeSingle();

            if (modeError || !modeData) {
                console.error('Failed to load game mode config:', modeError);
                return null;
            }

            this.gameConfig = {
                gameId: gameData.id,
                modeId: modeData.id,
                difficulty: this.difficulty
            };

            return this.gameConfig;
        } catch (error) {
            console.error('Error loading game config:', error);
            return null;
        }
    }

    init() {
        // Khởi tạo UI và events
        this.setupEventListeners();

        // Hiển thị best time và rank ban đầu
        this.updateBestTimeDisplay();
        this.updateRankDisplay();

        // Sinh Sudoku đầu tiên qua Web Worker
        this.newGame();
    }

    // Quản lý selection state - thay thế cho :focus
    selectCell(cell) {
        // Xóa selected class khỏi tất cả cells
        this.grid.querySelectorAll('.selected')
            .forEach(c => c.classList.remove('selected'));

        // Thêm selected class và cập nhật state
        if (cell) {
            cell.classList.add('selected');
            this.selectedCell = cell;
        } else {
            this.selectedCell = null;
        }
    }

    createGrid() {
        this.grid.innerHTML = "";

        for (let row = 0; row < 9; row++) {
            for (let col = 0; col < 9; col++) {
                const input = document.createElement("input");
                input.type = "text";
                input.maxLength = 1;
                input.dataset.row = row;
                input.dataset.col = col;

                // Add CSS classes for styling
                const blockRow = Math.floor(row / 3);
                const blockCol = Math.floor(col / 3);
                input.className = `sudoku-cell block-${blockRow}-${blockCol}`;

                const value = this.puzzle[row][col];
                if (value !== null) {
                    input.value = value;
                    input.readOnly = true; 
                    input.classList.add('given');
                } else {
                    input.classList.add('user-input');
                    // Không set readonly - cho phép click chọn ô trên mobile
                }

                input.addEventListener("mousedown", (e) => {
                    e.preventDefault();
                    input.focus(); // Đảm bảo focus khi click
                    this.selectCell(input); // Cập nhật selectedCell state
                });

                // Mobile: thêm click event để chọn ô
                input.addEventListener("click", (e) => {
                    if (input.readOnly) return; // Không chọn given cells
                    this.selectCell(input);
                });

                input.addEventListener("input", (e) => this.handleInput(e));
                input.addEventListener("keydown", (e) => this.handleKeydown(e));
                input.addEventListener("focus", (e) => this.handleFocus(e));
                input.addEventListener("blur", (e) => this.handleBlur(e));

                this.grid.appendChild(input);
            }
        }
    }

    // Xử lý nhập số
    handleInput(e) {
        const input = e.target;

        // Trường hợp xóa (Backspace/Delete)
        if (e.inputType === "deleteContentBackward" || e.inputType === "deleteContentForward") {
            input.value = "";
            this.clearConflicts();
            return;
        }

        // Lấy ký tự vừa nhập
        const char = e.data;

        // Chỉ cho phép số 1-9
        if (!/^[1-9]$/.test(char)) {
            input.value = "";
            return;
        }

        // Ghi đè trực tiếp - không cần xử lý gì thêm
        input.value = char;

        this.checkConflicts(input);
        this.highlightCorrectFocus(input); // Cập nhật highlight sau khi nhập
    }

    // Kiểm tra ô có chứa số đúng không
    isCorrectCell(input) {
        if (!input.value) return false;

        const row = Number(input.dataset.row);
        const col = Number(input.dataset.col);
        const value = Number(input.value);

        // GIVEN luôn đúng (được lấy từ solution gốc)
        if (input.readOnly) return true;

        // USER nhập đúng mới true (so với solution)
        return this.solution?.[row]?.[col] === value;
    }

    // Xóa tất cả highlight
    clearHighlights() {
        this.grid.querySelectorAll(
            '.same-number, .focus-line, .focus-cell'
        ).forEach(cell => {
            cell.classList.remove('same-number', 'focus-line', 'focus-cell');
        });
    }

    // Highlight thông minh
    highlightCorrectFocus(input) {
        this.clearHighlights();

        // GIVEN luôn highlight, USER chỉ khi đúng
        if (!this.isCorrectCell(input)) return;

        const value = input.value;
        const row = parseInt(input.dataset.row);
        const col = parseInt(input.dataset.col);

        input.classList.add('focus-cell');

        // Highlight row
        for (let c = 0; c < 9; c++) {
            this.grid
                .querySelector(`input[data-row="${row}"][data-col="${c}"]`)
                .classList.add('focus-line');
        }

        // Highlight column
        for (let r = 0; r < 9; r++) {
            this.grid
                .querySelector(`input[data-row="${r}"][data-col="${col}"]`)
                .classList.add('focus-line');
        }

        // Highlight block 3x3
        const br = Math.floor(row / 3) * 3;
        const bc = Math.floor(col / 3) * 3;
        for (let r = br; r < br + 3; r++) {
            for (let c = bc; c < bc + 3; c++) {
                this.grid
                    .querySelector(`input[data-row="${r}"][data-col="${c}"]`)
                    .classList.add('focus-line');
            }
        }

        // Highlight same number - CHỈ KHI Ô ĐÓ CŨNG ĐÚNG
        this.grid.querySelectorAll('input').forEach(cell => {
            if (cell.value === value && this.isCorrectCell(cell)) {
                cell.classList.add('same-number');
            }
        });
    }

    handleFocus(e) {
        const input = e.target;
        this.selectCell(input); // Cập nhật selectedCell state
        this.highlightCorrectFocus(input);
    }

    handleBlur(e) {
       
    }

    handleKeydown(e) {
        const input = e.target;

        // ❗ GIVEN: không cho nhập số, NHƯNG cho navigation + highlight
        if (input.readOnly) {
            // ✅ Cho phép arrow keys trên ô given
            if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
                e.preventDefault();

                let row = Number(input.dataset.row);
                let col = Number(input.dataset.col);

                switch (e.key) {
                    case 'ArrowUp':
                        this.moveFocus(row - 1, col, -1, 0);
                        break;
                    case 'ArrowDown':
                        this.moveFocus(row + 1, col, 1, 0);
                        break;
                    case 'ArrowLeft':
                        this.moveFocus(row, col - 1, 0, -1);
                        break;
                    case 'ArrowRight':
                        this.moveFocus(row, col + 1, 0, 1);
                        break;
                }
            }
            return; // Chặn tất cả keys khác trên given
        }

        if (/^[1-9]$/.test(e.key)) {
            input.value = "";
            return;
        }

        // Arrow key navigation
        if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
            e.preventDefault();

            let row = parseInt(input.dataset.row);
            let col = parseInt(input.dataset.col);

            // Truyền hướng di chuyển
            switch (e.key) {
                case 'ArrowUp':
                    this.moveFocus(row - 1, col, -1, 0);
                    break;
                case 'ArrowDown':
                    this.moveFocus(row + 1, col, 1, 0);
                    break;
                case 'ArrowLeft':
                    this.moveFocus(row, col - 1, 0, -1);
                    break;
                case 'ArrowRight':
                    this.moveFocus(row, col + 1, 0, 1);
                    break;
            }
        }

        // Backspace/Delete - xóa giá trị
        if (e.key === 'Backspace' || e.key === 'Delete') {
            input.value = "";
            this.clearConflicts();
            this.clearHighlights(); // Xóa highlight khi xóa số
        }
    }

    // Di chuyển focus - cho phép focus vào TẤT CẢ ô
    moveFocus(row, col, dRow = 0, dCol = 0) {
        for (let i = 0; i < 9; i++) {
            // Wrap around the grid
            if (row < 0) row = 8;
            if (row > 8) row = 0;
            if (col < 0) col = 8;
            if (col > 8) col = 0;

            const targetInput = this.grid.querySelector(`input[data-row="${row}"][data-col="${col}"]`);

            // Focus vào TẤT CẢ ô (given và user-input)
            if (targetInput) {
                targetInput.focus();
                return;
            }

            // Nếu không tìm thấy ô (không nên xảy ra), tiếp tục
            row += dRow;
            col += dCol;
        }
    }

    checkConflicts(currentInput) {
        this.clearConflicts();

        const value = currentInput.value;
        if (!value) return;

        const { row, col } = currentInput.dataset;
        const rowNum = parseInt(row);
        const colNum = parseInt(col);

        // Check row conflicts
        for (let c = 0; c < 9; c++) {
            if (c !== colNum) {
                const cell = this.grid.querySelector(`input[data-row="${rowNum}"][data-col="${c}"]`);
                if (cell.value === value) {
                    cell.classList.add('conflict');
                    currentInput.classList.add('conflict');
                }
            }
        }

        // Check column conflicts
        for (let r = 0; r < 9; r++) {
            if (r !== rowNum) {
                const cell = this.grid.querySelector(`input[data-row="${r}"][data-col="${colNum}"]`);
                if (cell.value === value) {
                    cell.classList.add('conflict');
                    currentInput.classList.add('conflict');
                }
            }
        }

        // Check 3x3 block conflicts
        const blockRow = Math.floor(rowNum / 3) * 3;
        const blockCol = Math.floor(colNum / 3) * 3;

        for (let r = blockRow; r < blockRow + 3; r++) {
            for (let c = blockCol; c < blockCol + 3; c++) {
                if (r !== rowNum || c !== colNum) {
                    const cell = this.grid.querySelector(`input[data-row="${r}"][data-col="${c}"]`);
                    if (cell.value === value) {
                        cell.classList.add('conflict');
                        currentInput.classList.add('conflict');
                    }
                }
            }
        }
    }

    clearConflicts() {
        const conflicts = this.grid.querySelectorAll('.conflict');
        conflicts.forEach(cell => cell.classList.remove('conflict'));
    }

    setupEventListeners() {
        this.checkBtn.addEventListener('click', async () => await this.checkSolution());
        this.resetBtn.addEventListener('click', () => this.reset());
        this.hintBtn.addEventListener('click', () => this.giveHint());
        if (this.newGameBtn) {
            this.newGameBtn.addEventListener('click', () => this.newGame());
        }

        // Difficulty selector
        if (this.difficultySelect) {
            this.difficultySelect.addEventListener('change', (e) => {
                this.difficulty = e.target.value;
                this.updateBestTimeDisplay();
                this.updateRankDisplay();
                this.newGame();
            });
        }

        // Achievements dropdown
        if (this.achievementsBtn) {
            this.achievementsBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleAchievements();
            });
        }

        // Leaderboard dropdown
        if (this.leaderboardBtn) {
            this.leaderboardBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleLeaderboard();
            });
        }

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (this.achievementsDropdown &&
                !this.achievementsDropdown.contains(e.target) &&
                !this.achievementsBtn.contains(e.target)) {
                this.achievementsDropdown.style.display = 'none';
            }

            if (this.leaderboardDropdown &&
                !this.leaderboardDropdown.contains(e.target) &&
                !this.leaderboardBtn.contains(e.target)) {
                this.leaderboardDropdown.style.display = 'none';
            }
        });

        // Tạm dừng timer khi rời tab
        document.addEventListener("visibilitychange", () => {
            if (document.hidden) {
                this.stopTimer();
            } else if (!this.isRunning) {
                this.startTimer();
            }
        });

        // Clear highlight khi click ra ngoài grid
        document.addEventListener("click", (e) => {
            if (!this.grid.contains(e.target)) {
                this.clearHighlights();
            }
        });

        // Number button event listeners for mobile
        if (this.numberButtons) {
            const numberBtns = this.numberButtons.querySelectorAll('.number-btn');
            numberBtns.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.handleNumberButtonClick(btn.dataset.number);
                });
            });
        }

        // ✅ SAFE AUTH LISTENER: Listen to global auth events (no conflicts)
        this.handleAuthChange = (e) => {
            const { event, session } = e.detail;
            console.log('🔄 Sudoku received auth event:', event);

            if (event === 'SIGNED_IN' && session) {
                console.log('✅ User signed in, updating Sudoku displays...');
                this.updateBestTimeDisplay();
                this.updateRankDisplay();
            } else if (event === 'SIGNED_OUT') {
                console.log('🔓 User signed out, resetting Sudoku displays...');
                if (this.bestTimeDisplay) {
                    this.bestTimeDisplay.textContent = 'Best: --:--';
                }
                if (this.rankDisplay) {
                    this.rankDisplay.textContent = 'Rank: --';
                }
                if (this.achievementsDropdown) {
                    this.achievementsDropdown.style.display = 'none';
                }
                if (this.leaderboardDropdown) {
                    this.leaderboardDropdown.style.display = 'none';
                }
            }
        };

        window.addEventListener('authStateChanged', this.handleAuthChange);
    }

    // Cleanup method
    destroy() {
        // Remove auth event listener
        if (this.handleAuthChange) {
            window.removeEventListener('authStateChanged', this.handleAuthChange);
        }
    }

    async checkSolution() {
        const inputs = this.grid.querySelectorAll('input:not(.given)');
        let complete = true;
        let correct = true;

        inputs.forEach(input => {
            const { row, col } = input.dataset;
            const userValue = parseInt(input.value);
            const correctValue = this.solution[row][col];

            if (!input.value) {
                complete = false;
                input.classList.add('empty');
            } else if (userValue !== correctValue) {
                correct = false;
                input.classList.add('wrong');
            } else {
                input.classList.add('correct');
            }
        });

        setTimeout(async () => {
            // Clear visual feedback
            inputs.forEach(input => {
                input.classList.remove('empty', 'wrong', 'correct');
            });

            if (!complete) {
                alert("❌ Còn ô trống! Hãy điền đầy đủ Sudoku.");
            } else if (!correct) {
                alert("❌ Có lỗi! Kiểm tra lại các số đã điền.");
            } else {
                this.stopTimer();
                const mins = String(Math.floor(this.seconds / 60)).padStart(2, '0');
                const secs = String(this.seconds % 60).padStart(2, '0');
                const difficultyName = DIFFICULTY_SETTINGS[this.difficulty].name;

                let message = `🎉 Chúc mừng! Bạn đã hoàn thành Sudoku ${difficultyName} trong ${mins}:${secs}!`;

                // Submit game result qua Edge Function (tự động tính XP và update best score)
                const user = await supabase.auth.getUser();
                if (user.data.user) {
                    try {
                        const submitResult = await supabase.functions.invoke('submitGameResult', {
                            body: {
                                game_code: 'sudoku',
                                mode_code: this.difficulty,
                                metric_type: 'time',
                                metric_value: this.seconds,
                                extra_data: {
                                    mistakes: 0, // TODO: Track mistakes in sudoku game
                                    completed: true
                                }
                            }
                        });

                        if (submitResult.error) {
                            console.error('Failed to submit game result:', submitResult.error);
                        } else {
                            message += '\n🎯 Game result submitted! Best score updated automatically.';

                            // 🔄 REALTIME UI UPDATE: Refresh displays after successful submission
                            try {
                                await this.updateBestTimeDisplay();
                                await this.updateRankDisplay();

                                // Update achievements if dropdown is open
                                if (this.achievementsDropdown && this.achievementsDropdown.style.display !== 'none') {
                                    await this.showAchievements();
                                }

                                // Update leaderboard if it's currently open
                                if (this.leaderboardDropdown && this.leaderboardDropdown.style.display !== 'none') {
                                    await this.loadLeaderboard();
                                }

                                console.log('✅ Sudoku UI updated with latest best time and rank');
                            } catch (updateError) {
                                console.error('❌ Error updating Sudoku UI after game submission:', updateError);
                            }
                        }
                    } catch (error) {
                        console.error('Error submitting game result:', error);
                    }

                    // Grant game rewards using new architecture
                    const gameResult = {
                        difficulty: this.difficulty,
                        timeTaken: this.seconds,
                        mistakes: 0 // TODO: Track mistakes in sudoku game
                    };
                    const gameRewards = await rewards.grantGameRewards('sudoku', gameResult);

                    if (gameRewards.success) {
                        message += `\n💰 Nhận được ${gameRewards.rewards.xp} XP và ${gameRewards.rewards.coins} coins!`;

                        // Check for achievements
                        const achievementResult = await achievements.unlockAchievements('games_completed', {
                            difficulty: this.difficulty,
                            timeTaken: this.seconds
                        });

                        if (achievementResult.unlocked_count > 0) {
                            message += `\n🏆 Unlock ${achievementResult.unlocked_count} achievement(s)!`;
                        }
                    }

                } else {
                    message += '\n💡 Đăng nhập để lưu thành tích và nhận rewards!';
                }

                alert(message);
            }
        }, 500);
    }

    reset() {
        const inputs = this.grid.querySelectorAll('input:not(.given)');
        inputs.forEach(input => {
            input.value = "";
            input.classList.remove('conflict');
        });
        this.clearHighlights(); // Xóa tất cả highlight khi reset
        this.resetTimer();
        this.startTimer();
    }

    giveHint() {
        const emptyCells = Array.from(this.grid.querySelectorAll('input:not(.given)'))
            .filter(input => !input.value);

        if (emptyCells.length === 0) {
            alert("🎯 Không còn ô trống nào để gợi ý!");
            return;
        }

        // Áp dụng hint penalty dựa trên độ khó
        const penaltySeconds = HINT_PENALTY[this.difficulty];
        this.seconds += penaltySeconds;

        // Cập nhật UI timer ngay lập tức
        this.updateTimerUI();

        // Thông báo penalty cho người dùng
        const penaltyMinutes = Math.floor(penaltySeconds / 60);
        const penaltyText = penaltyMinutes === 1 ? "1 phút" : `${penaltyMinutes} phút`;
        console.log(`💡 Sử dụng gợi ý: +${penaltyText} penalty time`);

        const randomCell = emptyCells[Math.floor(Math.random() * emptyCells.length)];
        const { row, col } = randomCell.dataset;
        const hintValue = this.solution[row][col];

        randomCell.value = hintValue;
        randomCell.classList.add('hint');

        setTimeout(() => {
            randomCell.classList.remove('hint');
        }, 2000);
    }


    startTimer() {
        if (this.timer) clearInterval(this.timer);

        this.isRunning = true;
        this.timer = setInterval(() => {
            this.seconds++;
            this.updateTimerUI();
        }, 1000);
    }

    updateTimerUI() {
        const mins = String(Math.floor(this.seconds / 60)).padStart(2, '0');
        const secs = String(this.seconds % 60).padStart(2, '0');
        this.timerEl.textContent = `⏱ ${mins}:${secs}`;
    }

    stopTimer() {
        clearInterval(this.timer);
        this.isRunning = false;
    }

    resetTimer() {
        this.stopTimer();
        this.seconds = 0;
        this.updateTimerUI();
    }

    newGame() {
        // Hiển thị loading cho tất cả level (vì dùng Web Worker)
        if (this.loadingIndicator) {
            this.loadingIndicator.style.display = 'flex';
        }

        // Terminate worker cũ nếu có
        if (this.worker) {
            this.worker.terminate();
        }

        // Tạo Web Worker mới
        this.worker = new Worker('../../../js/workers/sudoku.worker.js');

        // Gửi yêu cầu sinh Sudoku
        this.worker.postMessage({
            difficulty: this.difficulty
        });

        // Nhận kết quả từ Web Worker
        this.worker.onmessage = (e) => {
            const { solution, puzzle } = e.data;

            this.solution = solution;
            this.puzzle = puzzle;

            // Reset UI
            this.createGrid();

            // Reset timer
            this.resetTimer();
            this.startTimer();

            // Ẩn loading
            if (this.loadingIndicator) {
                this.loadingIndicator.style.display = 'none';
            }

            // Cleanup worker
            this.worker.terminate();
            this.worker = null;
        };

        // Handle lỗi Web Worker
        this.worker.onerror = (error) => {
            console.error('Sudoku Worker error:', error);
            if (this.loadingIndicator) {
                this.loadingIndicator.style.display = 'none';
            }
            alert('Có lỗi khi tạo đề Sudoku. Vui lòng thử lại.');
        };
    }

    // Cập nhật hiển thị best time cho độ khó hiện tại
    async updateBestTimeDisplay() {
        if (!this.bestTimeDisplay) {
            return;
        }

        const user = await supabase.auth.getUser();
        if (!user.data.user) {
            this.bestTimeDisplay.textContent = 'Best: --:--';
            return;
        }

        const bestTime = await this.getBestTimeFromBestScores(this.difficulty);
        this.bestTimeDisplay.textContent = `Best: ${formatTime(bestTime)}`;
    }

    // Get all best scores từ game_best_scores table
    async getAllBestScores() {
        try {
            const user = await supabase.auth.getUser();
            if (!user.data.user) return {};

            const { data, error } = await supabase
                .from('game_best_scores')
                .select('mode_id, metric_value')
                .eq('user_id', user.data.user.id)
                .eq('game_id', (await this.loadGameConfig())?.gameId)
                .eq('metric_type', 'time');

            if (error || !data) return {};

            // Map mode_id back to difficulty codes
            const modeToDifficulty = {};
            const difficulties = ['easy', 'medium', 'hard', 'very_hard', 'expert'];

            // Get all mode data
            const { data: modes } = await supabase
                .from('game_modes')
                .select('id, code')
                .eq('game_id', (await this.loadGameConfig())?.gameId);

            if (modes) {
                modes.forEach(mode => {
                    modeToDifficulty[mode.id] = mode.code;
                });
            }

            // Convert to object format {easy: time, medium: time, ...}
            const scores = {};
            data.forEach(record => {
                const difficulty = modeToDifficulty[record.mode_id];
                if (difficulty) {
                    scores[difficulty] = record.metric_value;
                }
            });

            return scores;
        } catch (error) {
            console.error('Error getting all best scores:', error);
            return {};
        }
    }

    // Get best time từ game_best_scores table
    async getBestTimeFromBestScores(difficulty) {
        try {
            const user = await supabase.auth.getUser();
            if (!user.data.user) return null;

            const config = await this.loadGameConfig();
            if (!config) return null;

            const { data, error } = await supabase
                .from('game_best_scores')
                .select('metric_value')
                .eq('user_id', user.data.user.id)
                .eq('game_id', config.gameId)
                .eq('mode_id', config.modeId);

            if (error || !data || data.length === 0) {
                return null;
            }

            return data[0].metric_value;
        } catch (error) {
            console.error('Error getting best time from best scores:', error);
            return null;
        }
    }

    // Toggle achievements dropdown
    toggleAchievements() {
        if (!this.achievementsDropdown) return;

        const isVisible = this.achievementsDropdown.style.display !== 'none';

        if (isVisible) {
            this.achievementsDropdown.style.display = 'none';
        } else {
            this.showAchievements();
        }
    }

    // Handle number button clicks for mobile input
    handleNumberButtonClick(number) {
        // Use selectedCell state instead of browser focus
        const cell = this.selectedCell;

        if (!cell) {
            // If no cell is selected, select first empty cell
            const emptyCells = Array.from(this.grid.querySelectorAll('input:not(.given)'))
                .filter(input => !input.value);
            if (emptyCells.length > 0) {
                this.selectCell(emptyCells[0]);
                emptyCells[0].focus();
                return; // Let user click again to input number
            }
            return;
        }

        // Don't allow input on given cells
        if (cell.readOnly) {
            return;
        }

        if (number === 'delete') {
            // Delete current value
            cell.value = '';
            this.clearConflicts();
            this.clearHighlights();
        } else {
            // Input number
            const numValue = number;

            // Validate input (1-9 only, though buttons should only provide valid numbers)
            if (/^[1-9]$/.test(numValue)) {
                cell.value = numValue;
                this.checkConflicts(cell);
                this.highlightCorrectFocus(cell);
            }
        }
    }

    // Hiển thị achievements dropdown
    async showAchievements() {
        if (!this.achievementsDropdown || !this.achievementsList) return;

        const user = await supabase.auth.getUser();
        if (!user.data.user) {
            this.achievementsList.innerHTML = '<div style="text-align: center; color: var(--text-light);">Vui lòng đăng nhập để xem thành tích</div>';
            this.achievementsDropdown.style.display = 'block';
            return;
        }

        const scores = await this.getAllBestScores();

        const difficultyNames = {
            easy: 'EZ',
            medium: 'MED',
            hard: 'HARD',
            very_hard: 'VERY HARD',
            expert: 'EXPERT'
        };

        const difficulties = ['easy', 'medium', 'hard', 'very_hard', 'expert'];

        this.achievementsList.innerHTML = difficulties.map(diff => {
            const time = scores[diff];
            return `
                <div class="achievement-item">
                    <span class="achievement-difficulty">${difficultyNames[diff]}</span>
                    <span class="achievement-time">${time ? formatTime(time) : '<span class="achievement-no-score">Chưa chơi</span>'}</span>
                </div>
            `;
        }).join('');

        this.achievementsDropdown.style.display = 'block';
    }

    // Check if current game maintains the daily streak (DISABLED)
    // checkStreakMaintenance() {
    //     // Simple implementation: check if last game was completed today
    //     // In a real implementation, you'd track this in the database
    //     const today = new Date().toDateString();
    //     const lastGameDate = localStorage.getItem('lastGameDate');

    //     if (lastGameDate === today) {
    //         // Already played today, streak maintained
    //         return true;
    //     }

    //     // Update last game date
    //     localStorage.setItem('lastGameDate', today);
    //     return false;
    // }

    // Update rank display
    async updateRankDisplay() {
        if (!this.rankDisplay) {
            return;
        }

        const user = await supabase.auth.getUser();
        if (!user.data.user) {
            this.rankDisplay.textContent = 'Rank: --';
            return;
        }

        try {
            const { data, error } = await supabase
                .from('v_user_best_scores')
                .select('user_rank')
                .eq('game_code', 'sudoku')
                .eq('mode_code', this.difficulty)
                .maybeSingle();

            if (error || !data) {
                this.rankDisplay.textContent = 'Rank: --';
                return;
            }

            this.rankDisplay.textContent = `Rank: #${data.user_rank || '--'}`;
        } catch (error) {
            console.error('Error updating rank display:', error);
            this.rankDisplay.textContent = 'Rank: --';
        }
    }

    // Toggle leaderboard dropdown
    toggleLeaderboard() {
        if (!this.leaderboardDropdown) return;

        const isVisible = this.leaderboardDropdown.style.display !== 'none';

        // Hide achievements dropdown if visible
        if (this.achievementsDropdown && this.achievementsDropdown.style.display !== 'none') {
            this.achievementsDropdown.style.display = 'none';
        }

        if (isVisible) {
            this.leaderboardDropdown.style.display = 'none';
        } else {
            this.leaderboardDropdown.style.display = 'block';
            this.loadLeaderboard();
        }
    }

    // Load leaderboard data
    async loadLeaderboard() {
        if (!this.leaderboardList) return;

        try {
            const { data, error } = await supabase
                .rpc('get_leaderboard', {
                    p_game_code: 'sudoku',
                    p_mode_code: this.difficulty,
                    p_limit: 10
                });

            if (error) {
                console.error('Error loading leaderboard:', error);
                this.leaderboardList.innerHTML = '<div class="leaderboard-item">Không thể tải leaderboard</div>';
                return;
            }

            const user = await supabase.auth.getUser();
            const currentUserId = user.data.user?.id;

            this.leaderboardList.innerHTML = data.map(item => `
                <div class="leaderboard-item ${item.user_id === currentUserId ? 'current-user' : ''}">
                    <span class="leaderboard-rank">${item.rank}</span>
                    <span class="leaderboard-username">${item.username}</span>
                    <span class="leaderboard-score">${formatTime(item.metric_value)}</span>
                </div>
            `).join('');

        } catch (error) {
            console.error('Error in loadLeaderboard:', error);
            this.leaderboardList.innerHTML = '<div class="leaderboard-item">Lỗi tải dữ liệu</div>';
        }
    }

    // Detect if device is mobile/touch device
    isMobileDevice() {
        return (('ontouchstart' in window) ||
                (navigator.maxTouchPoints > 0) ||
                (navigator.msMaxTouchPoints > 0)) &&
               window.innerWidth <= 768;
    }
}