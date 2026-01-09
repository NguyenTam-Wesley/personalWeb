// Minesweeper Game Class
import { rewards } from './rewards.js';
import { achievements } from './achievements.js';
import { leaderboard } from './leaderboard.js';
import { supabase } from '../supabase/supabase.js';
import { getAuthUser } from '../supabase/auth.js';

const DIFFICULTIES = {
    easy: { rows: 9, cols: 9, mines: 10, name: 'Dễ' },
    medium: { rows: 16, cols: 16, mines: 40, name: 'Trung bình' },
    hard: { rows: 16, cols: 30, mines: 99, name: 'Khó' },
    very_hard: { rows: 30, cols: 30, mines: 200, name: 'Rất khó' },
    expert: { rows: 50, cols: 50, mines: 500, name: 'Chuyên gia' }
};

const MAX_BATCH_RENDER = 50; // Maximum cells to render per frame

export class MinesweeperGame {
    constructor() {
        this.difficulty = 'medium';
        this.worker = null;
        this.gameBoard = null;
        this.revealedQueue = [];
        this.isRendering = false;
        this.gameStarted = false;
        this.gameOver = false;
        this.gameWon = false;
        this.timer = null;
        this.seconds = 0;

        // DOM elements
        this.gameBoardEl = document.getElementById('game-board');
        this.difficultySelect = document.getElementById('difficulty');
        this.newGameBtn = document.getElementById('newGameBtn');
        this.timerEl = document.getElementById('timer');
        this.mineCountEl = document.getElementById('mine-count');
        this.gameStatusEl = document.getElementById('game-status');

        // Achievements & Leaderboard
        this.achievementsBtn = document.getElementById('achievementsBtn');
        this.achievementsDropdown = document.getElementById('achievementsDropdown');
        this.achievementsList = document.getElementById('achievements-list');
        this.leaderboardBtn = document.getElementById('leaderboardBtn');
        this.leaderboardDropdown = document.getElementById('leaderboardDropdown');
        this.leaderboardList = document.getElementById('leaderboard-list');

        // Best time and rank displays
        this.bestTimeDisplay = document.getElementById('best-time-display');
        this.rankDisplay = document.getElementById('rank-display');

        this.init();
    }

    init() {
        this.setupWorker();
        this.setupEventListeners();
        this.startNewGame();
        this.updateBestTimeAndRank();
    }

    setupWorker() {
        try {
            // Try absolute path first, fallback to relative
            const workerPath = '/js/workers/minesweeper_worker.js';
            console.log('Loading worker from:', workerPath);

            this.worker = new Worker(workerPath);

            this.worker.onmessage = (event) => {
                this.handleWorkerMessage(event.data);
            };

            this.worker.onerror = (error) => {
                console.error('Worker error:', error);
                this.showGameMessage('Lỗi Worker! Vui lòng tải lại trang.');
            };
        } catch (error) {
            console.error('Failed to create worker:', error);
            this.showGameMessage('Trình duyệt không hỗ trợ Web Worker!');
        }
    }

    setupEventListeners() {
        // Difficulty change
        this.difficultySelect.addEventListener('change', (e) => {
            this.difficulty = e.target.value;
            this.startNewGame();
            this.updateBestTimeAndRank();
        });

        // New game button
        this.newGameBtn.addEventListener('click', () => {
            this.startNewGame();
        });

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

        // Board click events
        this.gameBoardEl.addEventListener('click', (e) => {
            e.preventDefault();
            const cell = e.target.closest('.cell');
            if (cell && !this.gameOver) {
                const x = parseInt(cell.dataset.x);
                const y = parseInt(cell.dataset.y);
                this.handleCellClick(x, y, 'open');
            }
        });

        // Right click for flagging
        this.gameBoardEl.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            const cell = e.target.closest('.cell');
            if (cell && !this.gameOver) {
                const x = parseInt(cell.dataset.x);
                const y = parseInt(cell.dataset.y);
                this.handleCellClick(x, y, 'flag');
            }
        });
    }

    startNewGame() {
        if (this.worker) {
            this.resetGameState();
            const config = DIFFICULTIES[this.difficulty];
            this.worker.postMessage({
                type: 'init',
                data: config
            });

            // Update mine counter
            this.updateMineCounter(config.mines);
        }
    }

    resetGameState() {
        this.gameStarted = false;
        this.gameOver = false;
        this.gameWon = false;
        this.seconds = 0;
        this.stopTimer();
        this.updateTimer();
        this.updateGameStatus('Sẵn sàng');
        this.gameBoardEl.classList.remove('game-over', 'game-won');
    }

    handleCellClick(x, y, action) {
        if (!this.worker || this.gameOver) return;

        if (action === 'open') {
            this.worker.postMessage({
                type: 'openCell',
                data: { x, y }
            });
        } else if (action === 'flag') {
            this.worker.postMessage({
                type: 'toggleFlag',
                data: { x, y }
            });
        }
    }

    handleWorkerMessage(data) {
        switch (data.type) {
            case 'ready':
                this.renderBoard(data.config);
                break;

            case 'update':
                this.handleGameUpdate(data);
                break;

            case 'win':
                this.handleGameWin(data);
                break;

            default:
                console.warn('Unknown worker message type:', data.type);
        }
    }

    handleGameUpdate(data) {
        // Start timer on first move
        if (!this.gameStarted && data.revealed && data.revealed.length > 0) {
            this.startTimer();
            this.gameStarted = true;
        }

        // Handle revealed cells with batch rendering
        if (data.revealed) {
            this.revealedQueue = this.revealedQueue.concat(data.revealed);
            this.renderBatch();
        }

        // Handle flagged cells
        if (data.flagged) {
            this.updateFlagUI(data.flagged);
        }

        // Handle game over
        if (data.gameOver) {
            this.handleGameOver();
        }
    }

    async handleGameWin(data) {
        if (data.won) {
            this.gameWon = true;
            this.stopTimer();
            this.gameBoardEl.classList.add('game-won');
            this.updateGameStatus('🎉 Chiến thắng!');

            const difficultyName = DIFFICULTIES[this.difficulty].name;
            let message = `🎉 Chiến thắng!\n⏱ Thời gian: ${this.formatTime(this.seconds)}\n📏 Độ khó: ${difficultyName}`;

            // Submit game result for leaderboard and rewards
            const authUser = await getAuthUser();
            if (authUser?.id) {
                try {
                    console.log('📤 Submitting Minesweeper result...');
                    const submitResult = await supabase.functions.invoke('submitGameResult', {
                        body: {
                            game_code: 'minesweeper',
                            mode_code: this.difficulty,
                            metric_type: 'time',
                            metric_value: this.seconds,
                            extra_data: {
                                completed: true,
                                difficulty: this.difficulty
                            }
                        }
                    });

                    if (submitResult.error) {
                        console.error('Failed to submit game result:', submitResult.error);
                    } else {
                        console.log('✅ Minesweeper result submitted successfully');
                        message += '\n🎯 Kết quả đã lưu!';

                        // Apply rewards using rewards module
                        try {
                            const sessionId = submitResult.data?.session_id;
                            if (sessionId) {
                                await rewards.applyGameRewards(sessionId);
                                message += '\n🎁 Phần thưởng đã nhận!';
                            }
                        } catch (rewardError) {
                            console.error('Failed to apply rewards:', rewardError);
                        }

                        // Update UI with latest achievements and leaderboard
                        try {
                            // Refresh best time and rank displays
                            await this.updateBestTimeAndRank();

                            // Refresh achievements if dropdown is open
                            if (this.achievementsDropdown && this.achievementsDropdown.style.display !== 'none') {
                                await this.showAchievements();
                            }

                            // Refresh leaderboard if dropdown is open
                            if (this.leaderboardDropdown && this.leaderboardDropdown.style.display !== 'none') {
                                await this.loadLeaderboard();
                            }
                        } catch (uiError) {
                            console.error('Error updating UI:', uiError);
                        }
                    }
                } catch (error) {
                    console.error('Error submitting game result:', error);
                    message += '\n⚠️ Không thể lưu kết quả (chưa đăng nhập?)';
                }
            } else {
                message += '\n💡 Đăng nhập để lưu kết quả và nhận thưởng!';
            }

            this.showGameMessage(message);
        }
    }

    async handleGameOver() {
        this.gameOver = true;
        this.stopTimer();
        this.gameBoardEl.classList.add('game-over');
        this.updateGameStatus('💥 Thua cuộc!');

        // Submit game result for progress tracking (even on loss)
        const authUser = await getAuthUser();
        if (authUser?.id) {
            try {
                const submitResult = await supabase.functions.invoke('submitGameResult', {
                    body: {
                        game_code: 'minesweeper',
                        mode_code: this.difficulty,
                        metric_type: 'progress', // Track progress even on loss
                        metric_value: this.seconds, // Time played
                        extra_data: {
                            completed: false,
                            difficulty: this.difficulty,
                            gameOver: true
                        }
                    }
                });

                if (submitResult.error) {
                    console.error('Failed to submit game result:', submitResult.error);
                }
            } catch (error) {
                console.error('Error submitting game result:', error);
            }
        }

        this.showGameMessage('💥 Bạn đã thua!\nThử lại nhé!');
    }

    renderBoard(config) {
        if (!this.gameBoardEl) return;

        this.gameBoardEl.innerHTML = '';

        // Fixed cell size for all difficulties
        const cellSize = 24;

        // Calculate board dimensions based on cells
        const boardWidth = config.cols * cellSize;
        const boardHeight = config.rows * cellSize;

        // Create grid container directly on gameBoardEl
        this.gameBoardEl.className = 'minesweeper-grid';
        this.gameBoardEl.style.display = 'grid';
        this.gameBoardEl.style.gridTemplateColumns = `repeat(${config.cols}, ${cellSize}px)`;
        this.gameBoardEl.style.gridTemplateRows = `repeat(${config.rows}, ${cellSize}px)`;
        this.gameBoardEl.style.width = `${boardWidth}px`;
        this.gameBoardEl.style.height = `${boardHeight}px`;
        this.gameBoardEl.style.margin = '0 auto';

        console.log(`Creating board: ${config.rows}x${config.cols} (${boardWidth}x${boardHeight}px)`);

        // Create cells
        for (let x = 0; x < config.rows; x++) {
            for (let y = 0; y < config.cols; y++) {
                const cell = document.createElement('div');
                cell.className = 'cell';
                cell.dataset.x = x;
                cell.dataset.y = y;
                cell.style.width = `${cellSize}px`;
                cell.style.height = `${cellSize}px`;
                cell.style.fontSize = '14px'; // Fixed font size
                this.gameBoardEl.appendChild(cell);
            }
        }

        this.gameBoard = this.gameBoardEl;
    }

    renderBatch() {
        if (this.isRendering || this.revealedQueue.length === 0) return;

        this.isRendering = true;

        const batch = this.revealedQueue.splice(0, MAX_BATCH_RENDER);

        // Use requestAnimationFrame for smooth rendering
        requestAnimationFrame(() => {
            batch.forEach(cellData => {
                this.renderCell(cellData);
            });

            this.isRendering = false;

            // Continue rendering if more cells in queue
            if (this.revealedQueue.length > 0) {
                this.renderBatch();
            }
        });
    }

    renderCell(cellData) {
        const cell = this.gameBoard.querySelector(`[data-x="${cellData.x}"][data-y="${cellData.y}"]`);
        if (!cell) return;

        // Reset classes
        cell.className = 'cell';

        // Set revealed state
        if (cellData.isRevealed) {
            cell.classList.add('revealed');

            // Show mine or number
            if (cellData.isMine) {
                cell.classList.add('mine');
            } else if (cellData.neighborMines > 0) {
                cell.textContent = cellData.neighborMines;
                cell.classList.add(`number-${cellData.neighborMines}`);
            }
        }

        // Set flagged state
        if (cellData.isFlagged) {
            cell.classList.add('flagged');
        }
    }

    updateFlagUI(flagData) {
        const [x, y] = flagData.split(',');
        const cell = this.gameBoard.querySelector(`[data-x="${x}"][data-y="${y}"]`);
        if (cell) {
            cell.classList.toggle('flagged');
        }
    }

    updateMineCounter(count) {
        if (this.mineCountEl) {
            this.mineCountEl.textContent = count;
        }
    }

    updateGameStatus(status) {
        if (this.gameStatusEl) {
            this.gameStatusEl.textContent = status;
        }
    }

    startTimer() {
        if (this.timer) return;

        this.isRunning = true;
        this.timer = setInterval(() => {
            this.seconds++;
            this.updateTimer();
        }, 1000);
    }

    stopTimer() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
            this.isRunning = false;
        }
    }

    updateTimer() {
        if (this.timerEl) {
            this.timerEl.textContent = `⏱ ${this.formatTime(this.seconds)}`;
        }
    }

    formatTime(seconds) {
        const mins = String(Math.floor(seconds / 60)).padStart(2, '0');
        const secs = String(seconds % 60).padStart(2, '0');
        return `${mins}:${secs}`;
    }

    showGameMessage(message) {
        // Remove existing message
        const existingMessage = document.querySelector('.game-message');
        if (existingMessage) {
            existingMessage.remove();
        }

        // Create new message
        const messageEl = document.createElement('div');
        messageEl.className = 'game-message';
        messageEl.innerHTML = message.replace('\n', '<br>');

        // Add close on click
        messageEl.addEventListener('click', () => {
            messageEl.remove();
        });

        // Auto remove after 3 seconds
        setTimeout(() => {
            if (messageEl.parentNode) {
                messageEl.remove();
            }
        }, 3000);

        document.body.appendChild(messageEl);
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

    // Get all best scores for current user across all difficulties
    async getAllBestScores() {
        try {
            const authUser = await getAuthUser();
            if (!authUser?.id) return {};

            const difficulties = ['easy', 'medium', 'hard', 'very_hard', 'expert'];
            const scores = {};

            // Get best score for each difficulty using leaderboard module
            const promises = difficulties.map(difficulty =>
                leaderboard.getUserBestScore(authUser.id, 'minesweeper', difficulty)
            );

            const results = await Promise.all(promises);

            difficulties.forEach((difficulty, index) => {
                const result = results[index];
                if (result && result.metric_value) {
                    scores[difficulty] = result.metric_value;
                }
            });

            return scores;
        } catch (error) {
            console.error('Error getting best scores:', error);
            return {};
        }
    }

    // Update best time and rank displays
    async updateBestTimeAndRank() {
        if (!this.bestTimeDisplay || !this.rankDisplay) return;

        const authUser = await getAuthUser();
        if (!authUser?.id) {
            this.bestTimeDisplay.textContent = 'Best: --:--';
            this.rankDisplay.textContent = 'Rank: --';
            return;
        }

        try {
            // Get best score for current difficulty
            const bestScore = await leaderboard.getUserBestScore(authUser.id, 'minesweeper', this.difficulty);
            if (bestScore && bestScore.metric_value) {
                this.bestTimeDisplay.textContent = `Best: ${this.formatTime(bestScore.metric_value)}`;
            } else {
                this.bestTimeDisplay.textContent = 'Best: --:--';
            }

            // Get rank for current difficulty
            const leaderboardResult = await leaderboard.getLeaderboardWithCurrentUser('minesweeper', this.difficulty, 100);
            const currentUserEntry = leaderboardResult.leaderboard?.find(item => item.user_id === authUser.id);
            if (currentUserEntry && currentUserEntry.rank) {
                this.rankDisplay.textContent = `Rank: ${currentUserEntry.rank}`;
            } else {
                this.rankDisplay.textContent = 'Rank: --';
            }
        } catch (error) {
            console.error('Error updating best time and rank:', error);
            this.bestTimeDisplay.textContent = 'Best: --:--';
            this.rankDisplay.textContent = 'Rank: --';
        }
    }

    // Show achievements for current user
    async showAchievements() {
        if (!this.achievementsDropdown || !this.achievementsList) return;

        const authUser = await getAuthUser();
        if (!authUser?.id) {
            this.achievementsList.innerHTML = '<div style="text-align: center; color: #b0b0b0;">Vui lòng đăng nhập để xem thành tích</div>';
            this.achievementsDropdown.style.display = 'block';
            return;
        }

        const scores = await this.getAllBestScores();

        const difficultyNames = {
            easy: 'Dễ',
            medium: 'Trung bình',
            hard: 'Khó',
            very_hard: 'Rất khó',
            expert: 'Chuyên gia'
        };

        const difficulties = ['easy', 'medium', 'hard', 'very_hard', 'expert'];

        this.achievementsList.innerHTML = difficulties.map(difficulty => {
            const bestTime = scores[difficulty];
            const timeDisplay = bestTime ? this.formatTime(bestTime) : '--:--';
            const difficultyName = difficultyNames[difficulty];

            return `
                <div class="achievement-item ${bestTime ? 'unlocked' : 'locked'}">
                    <div class="achievement-icon">${bestTime ? '⏱️' : '🔒'}</div>
                    <div class="achievement-info">
                        <div class="achievement-name">${difficultyName}</div>
                        <div class="achievement-description">Thời gian tốt nhất: ${timeDisplay}</div>
                    </div>
                </div>
            `;
        }).join('');

        this.achievementsDropdown.style.display = 'block';
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
            const result = await leaderboard.getLeaderboardWithCurrentUser('minesweeper', this.difficulty, 10);
            const leaderboardData = result.leaderboard || [];
            const currentUserId = result.currentUserId;

            if (leaderboardData.length === 0) {
                this.leaderboardList.innerHTML = '<div class="leaderboard-item" style="text-align: center; color: #b0b0b0;">Chưa có dữ liệu</div>';
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
            this.leaderboardList.innerHTML = '<div class="leaderboard-item" style="text-align: center; color: #b0b0b0;">Lỗi tải dữ liệu</div>';
        }
    }

    destroy() {
        if (this.worker) {
            this.worker.terminate();
        }
        this.stopTimer();
    }
}