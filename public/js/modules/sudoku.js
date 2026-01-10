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
import { leaderboard } from './leaderboard.js';
import { supabase } from '../supabase/supabase.js';
import { getAuthUser } from '../supabase/auth.js';

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
    constructor(difficulty = DIFFICULTY.MEDIUM) {
        this.difficulty = difficulty;

        // State duy nhất cho ô đang chọn
        this.selectedCell = null;

        // Game completion state
        this.gameCompleted = false;

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

        // Pencil and clear buttons
        this.pencilBtn = document.getElementById("pencilBtn");
        this.clearBtn = document.getElementById("clearBtn");

        // Pencil mode state
        this.pencilMode = false;

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

        // Show mobile instruction if on mobile device
        this.showMobileInstruction();

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
                const cell = document.createElement("div");
                cell.className = `sudoku-cell block-${Math.floor(row / 3)}-${Math.floor(col / 3)}`;
                cell.dataset.row = row;
                cell.dataset.col = col;

                // Create value span
                const valueSpan = document.createElement("span");
                valueSpan.className = "cell-value";

                // Create notes grid
                const notesDiv = document.createElement("div");
                notesDiv.className = "cell-notes";
                for (let i = 1; i <= 9; i++) {
                    const noteSpan = document.createElement("span");
                    noteSpan.dataset.n = i;
                    notesDiv.appendChild(noteSpan);
                }

                // Add notes data structure to cell
                cell.notes = new Set();

                cell.appendChild(valueSpan);
                cell.appendChild(notesDiv);

                const value = this.puzzle[row][col];
                if (value !== null) {
                    valueSpan.textContent = value;
                    cell.classList.add('given');
                    cell.given = true;
                } else {
                    cell.classList.add('user-input');
                    cell.given = false;
                }

                // Make cell focusable
                cell.tabIndex = 0;

                cell.addEventListener("mousedown", (e) => {
                    e.preventDefault();
                    cell.focus();
                    this.selectCell(cell);
                });

                // Mobile: touch event để chọn ô
                cell.addEventListener("touchstart", (e) => {
                    if (cell.given) return; // Không chọn given cells
                    e.preventDefault();
                    this.selectCell(cell);
                    cell.focus();
                });

                // Mobile: click event để chọn ô
                cell.addEventListener("click", (e) => {
                    if (cell.given) return; // Không chọn given cells
                    this.selectCell(cell);
                });

                // Only handle input/key events on desktop, mobile uses number buttons only
                if (!this.isMobileDevice()) {
                    cell.addEventListener("keydown", (e) => this.handleKeydown(e));
                }
                cell.addEventListener("focus", (e) => this.handleFocus(e));
                cell.addEventListener("blur", (e) => this.handleBlur(e));

                this.grid.appendChild(cell);
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
    isCorrectCell(cell) {
        const valueSpan = cell.querySelector('.cell-value');
        if (!valueSpan || !valueSpan.textContent) return false;

        const row = Number(cell.dataset.row);
        const col = Number(cell.dataset.col);
        const value = Number(valueSpan.textContent);

        // GIVEN luôn đúng (được lấy từ solution gốc)
        if (cell.given) return true;

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
    highlightCorrectFocus(cell) {
        this.clearHighlights();

        // GIVEN luôn highlight, USER chỉ khi đúng
        if (!this.isCorrectCell(cell)) return;

        const valueSpan = cell.querySelector('.cell-value');
        const value = valueSpan.textContent;
        const row = parseInt(cell.dataset.row);
        const col = parseInt(cell.dataset.col);

        cell.classList.add('focus-cell');

        // Highlight row
        for (let c = 0; c < 9; c++) {
            this.grid
                .querySelector(`[data-row="${row}"][data-col="${c}"]`)
                .classList.add('focus-line');
        }

        // Highlight column
        for (let r = 0; r < 9; r++) {
            this.grid
                .querySelector(`[data-row="${r}"][data-col="${col}"]`)
                .classList.add('focus-line');
        }

        // Highlight block 3x3
        const br = Math.floor(row / 3) * 3;
        const bc = Math.floor(col / 3) * 3;
        for (let r = br; r < br + 3; r++) {
            for (let c = bc; c < bc + 3; c++) {
                this.grid
                    .querySelector(`[data-row="${r}"][data-col="${c}"]`)
                    .classList.add('focus-line');
            }
        }

        // Highlight same number - CHỈ KHI Ô ĐÓ CŨNG ĐÚNG
        this.grid.querySelectorAll('.sudoku-cell').forEach(otherCell => {
            const otherValueSpan = otherCell.querySelector('.cell-value');
            if (otherValueSpan && otherValueSpan.textContent === value && this.isCorrectCell(otherCell)) {
                otherCell.classList.add('same-number');
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
        const cell = e.target;

        // ❗ GIVEN: không cho nhập số, NHƯNG cho navigation + highlight
        if (cell.given) {
            // ✅ Cho phép arrow keys trên ô given
            if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
                e.preventDefault();

                let row = Number(cell.dataset.row);
                let col = Number(cell.dataset.col);

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

        // Number input with pencil mode support
        if (/^[1-9]$/.test(e.key)) {
            e.preventDefault();
            const number = parseInt(e.key);
            this.inputNumber(cell, number);
            return;
        }

        // Arrow key navigation
        if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
            e.preventDefault();

            let row = parseInt(cell.dataset.row);
            let col = parseInt(cell.dataset.col);

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

        // Backspace/Delete - xóa giá trị và notes
        if (e.key === 'Backspace' || e.key === 'Delete') {
            e.preventDefault();
            const valueSpan = cell.querySelector('.cell-value');
            valueSpan.textContent = '';
            cell.notes.clear();
            this.renderNotes(cell);
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

            const targetCell = this.grid.querySelector(`[data-row="${row}"][data-col="${col}"]`);

            // Focus vào TẤT CẢ ô (given và user-input)
            if (targetCell) {
                targetCell.focus();
                return;
            }

            // Nếu không tìm thấy ô (không nên xảy ra), tiếp tục
            row += dRow;
            col += dCol;
        }
    }

    checkConflicts(currentCell) {
        this.clearConflicts();

        const valueSpan = currentCell.querySelector('.cell-value');
        const value = valueSpan ? valueSpan.textContent : '';
        if (!value) return;

        const { row, col } = currentCell.dataset;
        const rowNum = parseInt(row);
        const colNum = parseInt(col);

        // Check row conflicts
        for (let c = 0; c < 9; c++) {
            if (c !== colNum) {
                const cell = this.grid.querySelector(`[data-row="${rowNum}"][data-col="${c}"]`);
                const cellValueSpan = cell.querySelector('.cell-value');
                const cellValue = cellValueSpan ? cellValueSpan.textContent : '';
                if (cellValue === value) {
                    cell.classList.add('conflict');
                    currentCell.classList.add('conflict');
                }
            }
        }

        // Check column conflicts
        for (let r = 0; r < 9; r++) {
            if (r !== rowNum) {
                const cell = this.grid.querySelector(`[data-row="${r}"][data-col="${colNum}"]`);
                const cellValueSpan = cell.querySelector('.cell-value');
                const cellValue = cellValueSpan ? cellValueSpan.textContent : '';
                if (cellValue === value) {
                    cell.classList.add('conflict');
                    currentCell.classList.add('conflict');
                }
            }
        }

        // Check 3x3 block conflicts
        const blockRow = Math.floor(rowNum / 3) * 3;
        const blockCol = Math.floor(colNum / 3) * 3;

        for (let r = blockRow; r < blockRow + 3; r++) {
            for (let c = blockCol; c < blockCol + 3; c++) {
                if (r !== rowNum || c !== colNum) {
                    const cell = this.grid.querySelector(`[data-row="${r}"][data-col="${c}"]`);
                    const cellValueSpan = cell.querySelector('.cell-value');
                    const cellValue = cellValueSpan ? cellValueSpan.textContent : '';
                    if (cellValue === value) {
                        cell.classList.add('conflict');
                        currentCell.classList.add('conflict');
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

        // Pencil and clear buttons
        if (this.pencilBtn) {
            this.pencilBtn.addEventListener('click', () => this.togglePencilMode());
        }
        if (this.clearBtn) {
            this.clearBtn.addEventListener('click', () => this.clearAll());
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
        const cells = this.grid.querySelectorAll('.sudoku-cell:not(.given)');
        let complete = true;
        let correct = true;

        cells.forEach(cell => {
            const { row, col } = cell.dataset;
            const valueSpan = cell.querySelector('.cell-value');
            const userValue = valueSpan && valueSpan.textContent ? parseInt(valueSpan.textContent) : null;
            const correctValue = this.solution[row][col];

            if (!userValue) {
                complete = false;
                cell.classList.add('empty');
            } else if (userValue !== correctValue) {
                correct = false;
                cell.classList.add('wrong');
            } else {
                cell.classList.add('correct');
            }
        });

        setTimeout(async () => {
            // Clear visual feedback
            cells.forEach(cell => {
                cell.classList.remove('empty', 'wrong', 'correct');
            });

            if (!complete) {
                alert("❌ Còn ô trống! Hãy điền đầy đủ Sudoku.");
            } else if (!correct) {
                alert("❌ Có lỗi! Kiểm tra lại các số đã điền.");
            } else {
                // Game completed successfully - hide check button
                this.gameCompleted = true;
                this.checkBtn.style.display = 'none';

                this.stopTimer();
                const mins = String(Math.floor(this.seconds / 60)).padStart(2, '0');
                const secs = String(this.seconds % 60).padStart(2, '0');
                const difficultyName = DIFFICULTY_SETTINGS[this.difficulty].name;

                let message = `🎉 Chúc mừng! Bạn đã hoàn thành Sudoku ${difficultyName} trong ${mins}:${secs}!`;

                // Submit game result qua Edge Function (tự động tính XP và update best score)
                const authUser = await getAuthUser();
                if (authUser?.id) {
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

                            // 🎁 Calculate and apply rewards using rewards module
                            try {
                                const sessionId = submitResult.data?.session_id;
                                if (sessionId) {
                                    const rewardData = await rewards.calculateRewardsForSession(sessionId);

                                    // Show reward notification if rewards were given
                                    if (rewardData && (rewardData.xp_gained > 0 || rewardData.coins_gained > 0 || rewardData.gems_gained > 0)) {
                                        this.showRewardNotification(rewardData);
                                    }

                                    // 🏆 Update leaderboard using leaderboard module
                                    try {
                                        await leaderboard.updateLeaderboard(sessionId);
                                    } catch (leaderboardError) {
                                        console.error('❌ Error updating leaderboard:', leaderboardError);
                                    }
                                }
                            } catch (rewardError) {
                                console.error('❌ Error calculating rewards:', rewardError);
                            }

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

                // Alert removed - using custom popup instead
                console.log('Game completed:', message);
            }
        }, 500);
    }

    reset() {
        const cells = this.grid.querySelectorAll('.sudoku-cell:not(.given)');
        cells.forEach(cell => {
            const valueSpan = cell.querySelector('.cell-value');
            if (valueSpan) valueSpan.textContent = '';
            cell.notes.clear();
            this.renderNotes(cell);
            cell.classList.remove('conflict');
        });
        this.clearHighlights(); // Xóa tất cả highlight khi reset
        this.resetTimer();
        this.startTimer();
    }

    giveHint() {
        const emptyCells = Array.from(this.grid.querySelectorAll('.sudoku-cell:not(.given)'))
            .filter(cell => {
                const valueSpan = cell.querySelector('.cell-value');
                return !valueSpan || !valueSpan.textContent;
            });

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

        const valueSpan = randomCell.querySelector('.cell-value');
        valueSpan.textContent = hintValue;
        randomCell.notes.clear();
        this.renderNotes(randomCell);
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
        // Reset game completion state and show check button
        this.gameCompleted = false;
        this.checkBtn.style.display = 'inline-block';

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

        const authUser = await getAuthUser();
        if (!authUser?.id) {
            this.bestTimeDisplay.textContent = 'Best: --:--';
            return;
        }

        try {
            const userBest = await leaderboard.getUserBestScore(authUser.id, 'sudoku', this.difficulty);
            
            if (!userBest || !userBest.metric_value) {
                this.bestTimeDisplay.textContent = 'Best: --:--';
                return;
            }

            this.bestTimeDisplay.textContent = `Best: ${formatTime(userBest.metric_value)}`;
        } catch (error) {
            console.error('Error updating best time display:', error);
            this.bestTimeDisplay.textContent = 'Best: --:--';
        }
    }

    // Get all best scores using leaderboard module
    async getAllBestScores() {
        try {
            const authUser = await getAuthUser();
            if (!authUser?.id) return {};

            const difficulties = ['easy', 'medium', 'hard', 'very_hard', 'expert'];
            const scores = {};

            // Get best score for each difficulty using leaderboard module
            const promises = difficulties.map(difficulty =>
                leaderboard.getUserBestScore(authUser.id, 'sudoku', difficulty)
                    .then(userBest => {
                        if (userBest && userBest.metric_value) {
                            scores[difficulty] = userBest.metric_value;
                        }
                    })
                    .catch(error => {
                        console.error(`Error getting best score for ${difficulty}:`, error);
                    })
            );

            await Promise.all(promises);
            return scores;
        } catch (error) {
            console.error('Error getting all best scores:', error);
            return {};
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

    // Handle number button clicks for mobile input (ONLY WAY TO INPUT ON MOBILE)
    handleNumberButtonClick(number) {
        // Use selectedCell state instead of browser focus
        const cell = this.selectedCell;

        if (!cell) {
            // If no cell is selected, select first empty cell
            const emptyCells = Array.from(this.grid.querySelectorAll('.sudoku-cell:not(.given)'))
                .filter(cell => !cell.querySelector('.cell-value').textContent);
            if (emptyCells.length > 0) {
                this.selectCell(emptyCells[0]);
                return; // Let user click again to input number
            }
            return;
        }

        // Don't allow input on given cells
        if (cell.given) {
            return;
        }

        if (number === 'delete') {
            // Delete current value and notes
            const valueSpan = cell.querySelector('.cell-value');
            valueSpan.textContent = '';
            cell.notes.clear();
            this.renderNotes(cell);
            this.clearConflicts();
            this.clearHighlights();
        } else {
            // Input number using pencil mode logic
            const numValue = parseInt(number);
            if (numValue >= 1 && numValue <= 9) {
                this.inputNumber(cell, numValue);
            }
        }
    }

    // Hiển thị achievements dropdown
    async showAchievements() {
        if (!this.achievementsDropdown || !this.achievementsList) return;

        const authUser = await getAuthUser();
        if (!authUser?.id) {
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

    async updateRankDisplay() {
        if (!this.rankDisplay) {
            return;
        }

        const authUser = await getAuthUser();
        if (!authUser?.id) {
            this.rankDisplay.textContent = 'Rank: --';
            return;
        }

        try {
            const userBest = await leaderboard.getUserBestScore(authUser.id, 'sudoku', this.difficulty);

            if (!userBest || !userBest.user_rank) {
                this.rankDisplay.textContent = 'Rank: --';
                return;
            }

            this.rankDisplay.textContent = `Rank: #${userBest.user_rank}`;
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
            const result = await leaderboard.getLeaderboardWithCurrentUser('sudoku', this.difficulty, 10);
            const leaderboardData = result.leaderboard || [];
            const currentUserId = result.currentUserId;

            if (leaderboardData.length === 0) {
                this.leaderboardList.innerHTML = '<div class="leaderboard-item">Chưa có dữ liệu</div>';
                return;
            }

            this.leaderboardList.innerHTML = leaderboardData.map(item => {
                const rankClass = leaderboard.getRankDisplayClass(item.rank);
                const itemClass = `leaderboard-item ${rankClass} ${item.user_id === currentUserId ? 'current-user' : ''}`;

                return `
                    <div class="${itemClass}">
                        <span class="leaderboard-rank ${rankClass}">${item.rank}</span>
                        <span class="leaderboard-username">${item.username}</span>
                        <span class="leaderboard-score">${leaderboard.formatMetricValue(item.metric_value, 'time')}</span>
                    </div>
                `;
            }).join('');

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

    // Show mobile instruction for touch devices
    showMobileInstruction() {
        const mobileInstruction = document.getElementById('mobile-instruction');
        if (mobileInstruction && this.isMobileDevice()) {
            mobileInstruction.style.display = 'block';
        }
    }

    // 🎁 Show reward notification after successful game submission
    showRewardNotification(rewardData) {
        if (!rewardData) return;

        const { xp_gained = 0, coins_gained = 0, gems_gained = 0, level_up = false } = rewardData;

        // Create notification element
        const notification = document.createElement('div');
        notification.className = 'reward-notification';

        // Build reward message
        let message = '<h3>🎉 Rewards Earned!</h3>';
        const rewards = [];

        if (xp_gained > 0) rewards.push(`⭐ ${xp_gained} XP`);
        if (coins_gained > 0) rewards.push(`🪙 ${coins_gained} Coins`);
        if (gems_gained > 0) rewards.push(`💎 ${gems_gained} Gems`);
        if (level_up) rewards.push(`⬆️ LEVEL UP!`);

        if (rewards.length > 0) {
            message += '<div class="reward-list">' + rewards.join('<br>') + '</div>';
        }

        message += '<button class="reward-close-btn" onclick="this.parentElement.remove()">OK</button>';

        notification.innerHTML = message;

        // Add to page and auto-remove after 5 seconds
        document.body.appendChild(notification);
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);

        console.log('🎁 Reward notification shown:', rewardData);
    }

    // ===== PENCIL MODE METHODS =====

    togglePencilMode() {
        this.pencilMode = !this.pencilMode;
        this.pencilBtn.classList.toggle('active', this.pencilMode);

        // Disable pencil mode when a given cell is selected
        if (this.selectedCell && this.selectedCell.given) {
            this.pencilMode = false;
            this.pencilBtn.classList.remove('active');
        }
    }

    clearAll() {
        // Clear all user input cells and notes, but keep given cells
        const cells = this.grid.querySelectorAll('.sudoku-cell');
        cells.forEach(cell => {
            if (!cell.given) {
                // Clear value
                const valueSpan = cell.querySelector('.cell-value');
                if (valueSpan) valueSpan.textContent = '';

                // Clear notes
                cell.notes.clear();
                this.renderNotes(cell);
            }
        });

        // Clear highlights and conflicts
        this.clearHighlights();
        this.clearConflicts();

        // Reset selected cell
        this.selectCell(null);
    }

    // ===== NOTE LOGIC METHODS =====

    toggleNote(cell, number) {
        if (cell.given) return;

        // Initialize notes if not exists
        if (!cell.notes) {
            cell.notes = new Set();
        }

        const valueSpan = cell.querySelector('.cell-value');

        if (cell.notes.has(number)) {
            // Deleting existing note - don't clear value
            cell.notes.delete(number);
        } else {
            // Adding new note - clear value only when adding the first note
            if (valueSpan.textContent) {
                valueSpan.textContent = '';
            }
            cell.notes.add(number);
        }

        this.renderNotes(cell);
    }

    setValue(cell, number) {
        if (cell.given) return;

        // 1. Set value FIRST (most important!)
        const valueSpan = cell.querySelector('.cell-value');
        valueSpan.textContent = number;

        // 2. Then clear notes (since we now have a main value)
        cell.notes.clear();

        // 3. Remove has-notes class (notes should be hidden when main value exists)
        cell.classList.remove('has-notes');

        // 4. Update notes display (will hide all note spans)
        this.renderNotes(cell);

        // 5. Auto-clear notes in peers
        this.clearNotesInPeers(cell, number);

        // 6. Check conflicts and update highlights
        this.checkConflicts(cell);
        this.highlightCorrectFocus(cell);
    }

    clearNotesInPeers(cell, number) {
        const peers = this.getPeers(cell);
        peers.forEach(peer => {
            if (peer.notes.has(number)) {
                peer.notes.delete(number);
                this.renderNotes(peer);
            }
        });
    }

    getPeers(cell) {
        const row = Number(cell.dataset.row);
        const col = Number(cell.dataset.col);
        const peers = [];

        // Same row
        for (let c = 0; c < 9; c++) {
            if (c !== col) {
                const peer = this.grid.querySelector(`[data-row="${row}"][data-col="${c}"]`);
                if (peer) peers.push(peer);
            }
        }

        // Same column
        for (let r = 0; r < 9; r++) {
            if (r !== row) {
                const peer = this.grid.querySelector(`[data-row="${r}"][data-col="${col}"]`);
                if (peer) peers.push(peer);
            }
        }

        // Same 3x3 block
        const br = Math.floor(row / 3) * 3;
        const bc = Math.floor(col / 3) * 3;
        for (let r = br; r < br + 3; r++) {
            for (let c = bc; c < bc + 3; c++) {
                if (r !== row || c !== col) {
                    const peer = this.grid.querySelector(`[data-row="${r}"][data-col="${c}"]`);
                    if (peer) peers.push(peer);
                }
            }
        }

        return peers;
    }

    renderNotes(cell) {
        // Initialize notes if not exists
        if (!cell.notes) {
            cell.notes = new Set();
        }

        const noteSpans = cell.querySelectorAll('.cell-notes span');
        const valueSpan = cell.querySelector('.cell-value');

        noteSpans.forEach(span => {
            const n = Number(span.dataset.n);
            // Explicitly manage active class and text content
            if (cell.notes.has(n)) {
                span.classList.add('active');
                span.textContent = n; // 🔥 CRITICAL: Set text content to display the number!
            } else {
                span.classList.remove('active');
                span.textContent = ''; // Clear text when not active
            }
        });

        // Manage has-notes class: show notes only when cell has notes AND no main value
        // Check trim() to avoid whitespace confusion
        const hasNotes = cell.notes.size > 0;
        const hasValue = valueSpan && valueSpan.textContent.trim() !== '';

        if (hasNotes && !hasValue) {
            cell.classList.add('has-notes');
        } else {
            cell.classList.remove('has-notes');
        }
    }

    // ===== INPUT HANDLING =====

    inputNumber(cell, number) {
        if (cell.given) return;

        // Pencil mode: toggle notes (small numbers) in cell
        // Normal mode: set main value (large number), clears notes
        if (this.pencilMode) {
            this.toggleNote(cell, number);
        } else {
            this.setValue(cell, number);
        }
    }
}