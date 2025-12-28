// 🎯 Sudoku Game - Kiến trúc Production-Grade
// ✅ Web Worker cho thuật toán nặng
// ✅ Auth State Management chuyên nghiệp
// ✅ Supabase integration với RLS
// ✅ Dependency injection pattern

// Import Supabase v1 và SudokuScores
import { SudokuScores } from './sudoku_scores.js';

// Difficulty constants
const DIFFICULTY = {
    EASY: "easy",
    MEDIUM: "medium",
    HARD: "hard",
    VERY_HARD: "very_hard",
    EXPERT: "expert"
};

const DIFFICULTY_SETTINGS = {
    easy: { min: 35, max: 40, name: "EZ" },
    medium: { min: 45, max: 50, name: "MED" },
    hard: { min: 50, max: 55, name: "HARD" },
    very_hard: { min: 55, max: 60, name: "VERY HARD" },
    expert: { min: 60, max: 64, name: "EXPERT" }
};

export class SudokuGame {
    constructor({ supabase, user, difficulty = DIFFICULTY.MEDIUM }) {
        this.supabase = supabase;
        this.currentUser = user;
        this.difficulty = difficulty;

        // Khởi tạo rỗng - sẽ được tạo trong Web Worker sau

        this.grid = document.getElementById("sudoku-grid");
        this.checkBtn = document.getElementById("checkBtn");
        this.resetBtn = document.getElementById("resetBtn");
        this.hintBtn = document.getElementById("hintBtn");
        this.newGameBtn = document.getElementById("newGameBtn");
        this.difficultySelect = document.getElementById("difficulty");
        this.loadingIndicator = document.getElementById("loadingIndicator");

        // Web Worker cho việc sinh Sudoku
        this.worker = null;

        // Supabase scores management
        this.scoresManager = new SudokuScores(this.supabase);
        this.currentBestTime = null;
        this.currentBestTimeDisplay = document.getElementById("best-time-display");

        // Khởi tạo achievements dropdown
        const achievementsContainer = document.getElementById("achievements-container");
        if (achievementsContainer) {
            achievementsContainer.appendChild(this.createAchievementsDropdown());
        }

        // Setup achievements button event
        const achievementsBtn = document.getElementById("achievements-btn");
        if (achievementsBtn) {
            achievementsBtn.addEventListener('click', () => this.showAchievementsModal());
        }

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

    async init() {
        // Khởi tạo UI và events
        this.setupEventListeners();

        // Load thành tích cho độ khó hiện tại
        await this.loadScoreForDifficulty();

        // Sinh Sudoku đầu tiên qua Web Worker
        this.newGame();
    }

    // Tạo lưới Sudoku với UX COMMERCIAL APP LEVEL ULTIMATE PERFECT
    // ✅ Ô given: readOnly (focus được, highlight được, navigation mượt)
    // ✅ Ô user: edit + ghi đè tức thì (xóa value tại keydown)
    // ✅ Event: keydown (xóa số) → input (ghi) → navigation (focus tất cả)
    // ✅ IME/Telex: tắt được, không can thiệp
    // ✅ Caret: ẩn, text center (UX như game native)
    // ✅ Navigation: focus vào tất cả ô, arrow mượt trên given
    // ✅ Smart Highlight: highlight PERFECT - CSS priority fix, màu vàng đẹp
    // ✅ Result: Nhập số PERFECT, di chuyển mượt, highlight đỉnh cao
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
                    input.readOnly = true; // ❗ Thay disabled bằng readOnly để cho phép focus
                    input.classList.add('given');
                } else {
                    input.classList.add('user-input');
                }

                // Event listeners cho tất cả ô (bao gồm given để có thể di chuyển)
                input.addEventListener("mousedown", (e) => {
                    e.preventDefault();
                    input.focus(); // Đảm bảo focus khi click
                });

                input.addEventListener("input", (e) => this.handleInput(e));
                input.addEventListener("keydown", (e) => this.handleKeydown(e));
                input.addEventListener("focus", (e) => this.handleFocus(e));
                input.addEventListener("blur", (e) => this.handleBlur(e));

                this.grid.appendChild(input);
            }
        }
    }

    // Xử lý nhập số - FIX DỨT ĐIỂM lỗi "không ghi đè được số cũ"
    // ✅ Dùng e.data để lấy ký tự vừa nhập (không bị lệch trạng thái)
    // ✅ Xử lý inputType để phân biệt xóa và nhập
    // ✅ Ghi đè trực tiếp, không cần slice
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

    // Kiểm tra ô có chứa số đúng không (FIX quan trọng)
    isCorrectCell(input) {
        if (!input.value) return false;

        const row = Number(input.dataset.row);
        const col = Number(input.dataset.col);
        const value = Number(input.value);

        // ✅ GIVEN luôn đúng (được lấy từ solution gốc)
        if (input.readOnly) return true;

        // ✅ USER nhập đúng mới true (so với solution)
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

    // Highlight thông minh - CHUẨN COMMERCIAL APP (FIX hoàn hảo)
    highlightCorrectFocus(input) {
        this.clearHighlights();

        // ✅ GIVEN luôn highlight, USER chỉ khi đúng
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
        this.highlightCorrectFocus(input);
    }

    handleBlur(e) {
        // ❌ KHÔNG clear ở blur (tránh xóa highlight khi chuyển ô bằng arrow)
        // Highlight sẽ được clear bởi highlightCorrectFocus() hoặc clearHighlights()
    }

    // Xử lý phím đặc biệt - FIX ULTIMATE "navigation + highlight hoàn hảo"
    // 🔥 Xóa value cũ ngay tại keydown khi gõ số 1-9
    // 💡 GIVEN: không cho nhập số, NHƯNG cho navigation + highlight
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

        // ✅ USER INPUT: Gõ số 1-9 → XÓA GIÁ TRỊ CŨ TRƯỚC
        if (/^[1-9]$/.test(e.key)) {
            input.value = ""; // 🔥 Browser sẽ ghi ký tự mới vào ô trống
            return;
        }

        // Arrow key navigation - KHÔNG blur để tránh mất highlight
        if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
            e.preventDefault();
            // ❌ BỎ blur() - để tránh mất highlight

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

    // Di chuyển focus - CHUẨN COMMERCIAL: cho phép focus vào TẤT CẢ ô
    moveFocus(row, col, dRow = 0, dCol = 0) {
        for (let i = 0; i < 9; i++) {
            // Wrap around the grid
            if (row < 0) row = 8;
            if (row > 8) row = 0;
            if (col < 0) col = 8;
            if (col > 8) col = 0;

            const targetInput = this.grid.querySelector(`input[data-row="${row}"][data-col="${col}"]`);

            // ✅ Focus vào TẤT CẢ ô (given và user-input)
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
        this.checkBtn.addEventListener('click', () => this.checkSolution());
        this.resetBtn.addEventListener('click', () => this.reset());
        this.hintBtn.addEventListener('click', () => this.giveHint());
        if (this.newGameBtn) {
            this.newGameBtn.addEventListener('click', () => this.newGame());
        }

        // Difficulty selector
        if (this.difficultySelect) {
            this.difficultySelect.addEventListener('change', async (e) => {
                this.difficulty = e.target.value;
                await this.loadScoreForDifficulty(); // Load thành tích mới
                this.newGame();
            });
        }

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
    }

    checkSolution() {
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

        setTimeout(() => {
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

                // Lưu thành tích vào Supabase
                this.saveScore(this.seconds);

                alert(`🎉 Chúc mừng! Bạn đã hoàn thành Sudoku ${difficultyName} trong ${mins}:${secs}!`);
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

        const randomCell = emptyCells[Math.floor(Math.random() * emptyCells.length)];
        const { row, col } = randomCell.dataset;
        const hintValue = this.solution[row][col];

        randomCell.value = hintValue;
        randomCell.classList.add('hint');

        setTimeout(() => {
            randomCell.classList.remove('hint');
        }, 2000);
    }

    newGame(difficulty = "medium") {
        // Tạo đề mới
        this.solution = this.generateFullBoard();
        this.puzzle = this.generatePuzzle(this.solution, difficulty);

        // Reset UI
        this.createGrid();
    }

    // 🎯 Thuật toán sinh Sudoku đã được chuyển sang Web Worker
    // 📁 /js/workers/sudoku.worker.js
    // ✅ Không block UI, không lag, hỗ trợ Expert level

    // Timer functions
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

    // Lưu thành tích khi hoàn thành game
    async saveScore(timeInSeconds) {
        if (!this.currentUser) {
            console.info('Guest mode → skip saving score');
            return;
        }

        console.log('[SAVE SCORE]', {
            userId: this.currentUser.id,
            difficulty: this.difficulty,
            timeInSeconds
        });

        const result = await this.scoresManager.saveScore(this.currentUser.id, this.difficulty, timeInSeconds);

        if (result.success) {
            if (result.isNewRecord) {
                console.log(`🎉 New personal best for ${this.difficulty}: ${this.scoresManager.formatTime(timeInSeconds)}`);
            } else if (result.improved > 0) {
                console.log(`🚀 Improved personal best for ${this.difficulty} by ${result.improved}s!`);
            }
            // Cập nhật hiển thị thành tích
            this.updateBestTimeDisplay();
        }
    }

    // Tải và hiển thị thành tích cho độ khó hiện tại
    async loadScoreForDifficulty() {
        if (!this.currentUser) return;

        const score = await this.scoresManager.getScore(this.currentUser.id, this.difficulty);
        this.currentBestTime = score;

        this.updateBestTimeDisplay();
    }

    // Cập nhật hiển thị thành tích
    updateBestTimeDisplay() {
        if (!this.currentBestTimeDisplay) return;

        if (this.currentBestTime) {
            const timeStr = this.scoresManager.formatTime(this.currentBestTime.best_time);
            const dateStr = new Date(this.currentBestTime.completed_at).toLocaleDateString('vi-VN');
            this.currentBestTimeDisplay.innerHTML = `🏆 Best: ${timeStr}<br><small style="opacity: 0.7; font-size: 0.8em;">${dateStr}</small>`;
            this.currentBestTimeDisplay.style.display = 'block';
        } else {
            this.currentBestTimeDisplay.textContent = '🏆 No record yet';
            this.currentBestTimeDisplay.style.display = 'block';
        }
    }

    // Tạo dropdown thành tích
    createAchievementsDropdown() {
        const container = document.createElement('div');
        container.className = 'achievements-container';

        const button = document.createElement('button');
        button.className = 'achievements-btn btn-secondary';
        button.innerHTML = '🏆 Thành tích';
        button.id = 'achievements-btn';

        // Event listener sẽ được setup trong init
        container.appendChild(button);
        return container;
    }

    // Hiển thị modal thành tích
    async showAchievementsModal() {
        if (!this.currentUser) {
            alert('Vui lòng đăng nhập để xem thành tích!');
            return;
        }

        const scores = await this.scoresManager.getAllScores(this.currentUser.id);
        const stats = this.scoresManager.calculateStats(scores);

        let content = '<div style="text-align: center; padding: 20px; color: white;">';
        content += '<h3>🏆 Thành tích Sudoku của bạn</h3>';

        if (scores.length === 0) {
            content += '<p>Bạn chưa hoàn thành game nào!</p>';
        } else {
            content += '<div style="margin: 20px 0;">';
            content += `<p><strong>Games completed:</strong> ${stats.totalGames}</p>`;
            content += `<p><strong>Best time:</strong> ${this.scoresManager.formatTime(stats.bestTime)}</p>`;
            content += `<p><strong>Average time:</strong> ${this.scoresManager.formatTime(stats.averageTime)}</p>`;
            content += `<p><strong>Favorite difficulty:</strong> ${stats.favoriteDifficulty.toUpperCase()}</p>`;
            content += '</div>';

            content += '<h4>Chi tiết theo độ khó:</h4>';
            content += '<div style="display: grid; gap: 10px; margin-top: 15px;">';

            const difficulties = ['easy', 'medium', 'hard', 'very_hard', 'expert'];
            difficulties.forEach(diff => {
                const score = scores.find(s => s.difficulty === diff);
                const diffName = DIFFICULTY_SETTINGS[diff]?.name || diff.toUpperCase();
                const timeStr = score ? this.scoresManager.formatTime(score.best_time) : '--:--';
                const dateStr = score ? new Date(score.completed_at).toLocaleDateString('vi-VN') : '';

                content += `<div style="display: flex; justify-content: space-between; align-items: center; padding: 8px; background: rgba(255,255,255,0.1); border-radius: 6px;">`;
                content += `<span>${diffName}</span>`;
                content += `<div style="text-align: right;">`;
                content += `<div>${timeStr}</div>`;
                if (dateStr) content += `<div style="font-size: 0.8em; opacity: 0.7;">${dateStr}</div>`;
                content += `</div>`;
                content += '</div>';
            });

            content += '</div>';
        }

        content += '<button id="close-achievements-modal" style="margin-top: 20px; padding: 10px 20px; background: #4a5568; color: white; border: none; border-radius: 6px; cursor: pointer;">Đóng</button>';
        content += '</div>';

        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.9); display: flex; align-items: center;
            justify-content: center; z-index: 10000; font-family: 'Inter', sans-serif;
        `;
        modal.innerHTML = content;

        document.body.appendChild(modal);

        // Setup close button event listener
        const closeBtn = modal.querySelector('#close-achievements-modal');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => modal.remove());
        }
    }

    // Update user state (gọi từ auth state manager)
    updateUser(user) {
        const wasLoggedIn = !!this.currentUser;
        const nowLoggedIn = !!user;

        this.currentUser = user;

        // Reload scores khi login/logout
        if (wasLoggedIn !== nowLoggedIn) {
            this.loadScoreForDifficulty();
        }
    }
}