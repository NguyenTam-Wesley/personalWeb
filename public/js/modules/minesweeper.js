// Minesweeper Game Class
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
        this.resetBtn = document.getElementById('resetBtn');
        this.timerEl = document.getElementById('timer');
        this.mineCountEl = document.getElementById('mine-count');
        this.gameStatusEl = document.getElementById('game-status');

        this.init();
    }

    init() {
        this.setupWorker();
        this.setupEventListeners();
        this.startNewGame();
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
        });

        // New game button
        this.newGameBtn.addEventListener('click', () => {
            this.startNewGame();
        });

        // Reset button
        this.resetBtn.addEventListener('click', () => {
            this.startNewGame();
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

    handleGameWin(data) {
        if (data.won) {
            this.gameWon = true;
            this.stopTimer();
            this.gameBoardEl.classList.add('game-won');
            this.updateGameStatus('🎉 Chiến thắng!');
            this.showGameMessage(`🎉 Chiến thắng!\n⏱ Thời gian: ${this.formatTime(this.seconds)}`);
        }
    }

    handleGameOver() {
        this.gameOver = true;
        this.stopTimer();
        this.gameBoardEl.classList.add('game-over');
        this.updateGameStatus('💥 Thua cuộc!');
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

    destroy() {
        if (this.worker) {
            this.worker.terminate();
        }
        this.stopTimer();
    }
}