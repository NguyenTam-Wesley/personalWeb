// 🎯 Sudoku Game - Tối ưu hóa kiến trúc với Web Worker
// ✅ Thuật toán sinh Sudoku chạy nền, không block UI
// ✅ Hỗ trợ tất cả level từ EZ đến EXPERT mượt mà
// ✅ Loading indicator cho trải nghiệm tốt

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

// Hint penalty time in seconds (1,2,3,4,5 minutes)
const HINT_PENALTY = {
    easy: 60,        // 1 minute
    medium: 120,     // 2 minutes
    hard: 180,       // 3 minutes
    very_hard: 240,  // 4 minutes
    expert: 300      // 5 minutes
};

export class SudokuGame {
    constructor(sudokuScoresInstance, difficulty = DIFFICULTY.MEDIUM) {
        this.sudokuScores = sudokuScoresInstance;
        this.difficulty = difficulty;

        // Khởi tạo rỗng - sẽ được tạo trong Web Worker sau

        this.grid = document.getElementById("sudoku-grid");
        this.checkBtn = document.getElementById("checkBtn");
        this.resetBtn = document.getElementById("resetBtn");
        this.hintBtn = document.getElementById("hintBtn");
        this.newGameBtn = document.getElementById("newGameBtn");
        this.difficultySelect = document.getElementById("difficulty");
        this.loadingIndicator = document.getElementById("loadingIndicator");
        this.bestTimeDisplay = document.getElementById("best-time-display");
        this.achievementsBtn = document.getElementById("achievementsBtn");
        this.achievementsDropdown = document.getElementById("achievementsDropdown");
        this.achievementsList = document.getElementById("achievements-list");

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

    init() {
        // Khởi tạo UI và events
        this.setupEventListeners();

        // Hiển thị best time ban đầu
        this.updateBestTimeDisplay();

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
                    // Set readonly on mobile to prevent virtual keyboard
                    if (this.isMobileDevice()) {
                        input.readOnly = true;
                    }
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

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (this.achievementsDropdown &&
                !this.achievementsDropdown.contains(e.target) &&
                !this.achievementsBtn.contains(e.target)) {
                this.achievementsDropdown.style.display = 'none';
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

                // Lưu best time nếu user đã đăng nhập
                if (await this.sudokuScores.isLoggedIn()) {
                    const saved = await this.sudokuScores.saveScore(this.difficulty, this.seconds);
                    if (saved) {
                        // Cập nhật best time display
                        await this.updateBestTimeDisplay();
                        alert(`🎉 Chúc mừng! Bạn đã hoàn thành Sudoku ${difficultyName} trong ${mins}:${secs}!\n🎯 Thành tích mới được lưu!`);
                    } else {
                        alert(`🎉 Chúc mừng! Bạn đã hoàn thành Sudoku ${difficultyName} trong ${mins}:${secs}!`);
                    }
                } else {
                    alert(`🎉 Chúc mừng! Bạn đã hoàn thành Sudoku ${difficultyName} trong ${mins}:${secs}!\n💡 Đăng nhập để lưu thành tích!`);
                }
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

    // Cập nhật hiển thị best time cho độ khó hiện tại
    async updateBestTimeDisplay() {
        if (!this.bestTimeDisplay || !(await this.sudokuScores.isLoggedIn())) {
            if (this.bestTimeDisplay) {
                this.bestTimeDisplay.textContent = 'Best: --:--';
            }
            return;
        }

        const bestTime = await this.sudokuScores.getBestScore(this.difficulty);
        this.bestTimeDisplay.textContent = `Best: ${this.sudokuScores.formatTime(bestTime)}`;
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
        // Find currently focused cell
        const focusedCell = this.grid.querySelector('input:focus');

        if (!focusedCell) {
            // If no cell is focused, focus on first empty cell
            const emptyCells = Array.from(this.grid.querySelectorAll('input:not(.given)'))
                .filter(input => !input.value);
            if (emptyCells.length > 0) {
                emptyCells[0].focus();
                return; // Let user click again to input number
            }
            return;
        }

        // Don't allow input on given cells
        if (focusedCell.readOnly) {
            return;
        }

        if (number === 'delete') {
            // Delete current value
            focusedCell.value = '';
            this.clearConflicts();
            this.clearHighlights();
        } else {
            // Input number
            const numValue = number;

            // Validate input (1-9 only, though buttons should only provide valid numbers)
            if (/^[1-9]$/.test(numValue)) {
                focusedCell.value = numValue;
                this.checkConflicts(focusedCell);
                this.highlightCorrectFocus(focusedCell);
            }
        }
    }

    // Hiển thị achievements dropdown
    async showAchievements() {
        if (!this.achievementsDropdown || !this.achievementsList) return;

        if (!(await this.sudokuScores.isLoggedIn())) {
            this.achievementsList.innerHTML = '<div style="text-align: center; color: var(--text-light);">Vui lòng đăng nhập để xem thành tích</div>';
            this.achievementsDropdown.style.display = 'block';
            return;
        }

        const scores = await this.sudokuScores.getAllScores();

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
                    <span class="achievement-time">${time ? this.sudokuScores.formatTime(time) : '<span class="achievement-no-score">Chưa chơi</span>'}</span>
                </div>
            `;
        }).join('');

        this.achievementsDropdown.style.display = 'block';
    }

    // Detect if device is mobile/touch device
    isMobileDevice() {
        return (('ontouchstart' in window) ||
                (navigator.maxTouchPoints > 0) ||
                (navigator.msMaxTouchPoints > 0)) &&
               window.innerWidth <= 768;
    }
}