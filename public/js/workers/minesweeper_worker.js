// Minesweeper Worker - Game Logic
let board = [];
let rows = 0;
let cols = 0;
let numMines = 0;
let firstClick = true;
let gameOver = false;

// Cell structure
class Cell {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.isMine = false;
        this.isRevealed = false;
        this.isFlagged = false;
        this.neighborMines = 0;
    }
}

// Worker message handler
onmessage = function(event) {
    const { type, data } = event.data;

    switch (type) {
        case 'init': {
            initGame(data);
            break;
        }

        case 'openCell': {
            const result = openCell(data.x, data.y);
            postMessage({
                type: 'update',
                revealed: result.revealed,
                gameOver: result.gameOver
            });
            break;
        }

        case 'toggleFlag': {
            toggleFlag(data.x, data.y);
            postMessage({
                type: 'update',
                flagged: `${data.x},${data.y}`
            });
            break;
        }

        case 'checkWin': {
            postMessage({
                type: 'win',
                won: checkWin()
            });
            break;
        }

        default: {
            console.warn('Unknown message type:', type);
        }
    }
};

// Initialize game board
function initGame(config) {
    rows = config.rows;
    cols = config.cols;
    numMines = config.mines;
    firstClick = true;
    gameOver = false;
    gameWon = false;

    // Create board
    board = [];
    for (let x = 0; x < rows; x++) {
        board[x] = [];
        for (let y = 0; y < cols; y++) {
            board[x][y] = new Cell(x, y);
        }
    }

    // Send ready signal with config
    postMessage({
        type: 'ready',
        config: config
    });
}

// Check if cell is in the 3x3 safe zone around first click
function isInSafeZone(x, y, firstX, firstY) {
    return Math.abs(x - firstX) <= 1 && Math.abs(y - firstY) <= 1;
}

// Place mines randomly, avoiding the entire 3x3 safe zone
function placeMines(firstX, firstY) {
    let minesPlaced = 0;

    while (minesPlaced < numMines) {
        const x = Math.floor(Math.random() * rows);
        const y = Math.floor(Math.random() * cols);

        const cell = board[x][y];
        // Don't place mine in the 3x3 safe zone or if already has mine
        if (!cell.isMine && !isInSafeZone(x, y, firstX, firstY)) {
            cell.isMine = true;
            minesPlaced++;
        }
    }

    // Calculate neighbor mine counts
    for (let x = 0; x < rows; x++) {
        for (let y = 0; y < cols; y++) {
            if (!board[x][y].isMine) {
                board[x][y].neighborMines = countMinesAround(x, y);
            }
        }
    }
}

// Open cell and perform flood fill
function openCell(x, y) {
    const cell = board[x][y];
    const revealedCells = [];

    // Can't open flagged or already revealed cells
    if (cell.isRevealed || cell.isFlagged) {
        return { revealed: revealedCells, gameOver: false };
    }

    // Place mines on first click
    if (firstClick) {
        placeMines(x, y);
        firstClick = false;
    }

    // Hit a mine - game over
    if (cell.isMine) {
        revealAllMines();
        gameOver = true;
        return { revealed: getAllCells(), gameOver: true };
    }

    // Flood fill using BFS (optimized queue)
    const queue = [[x, y]];
    let head = 0;

    while (head < queue.length) {
        const [cx, cy] = queue[head++];
        const c = board[cx][cy];

        if (c.isRevealed || c.isFlagged) continue;

        c.isRevealed = true;
        revealedCells.push({
            x: cx,
            y: cy,
            isMine: c.isMine,
            isRevealed: c.isRevealed,
            isFlagged: c.isFlagged,
            neighborMines: c.neighborMines
        });

        // If cell has no neighboring mines, reveal all neighbors
        if (c.neighborMines === 0) {
            for (let dx = -1; dx <= 1; dx++) {
                for (let dy = -1; dy <= 1; dy++) {
                    const nx = cx + dx;
                    const ny = cy + dy;

                    if (inBounds(nx, ny) && !board[nx][ny].isRevealed && !board[nx][ny].isFlagged) {
                        queue.push([nx, ny]);
                    }
                }
            }
        }
    }

    return { revealed: revealedCells, gameOver: false };
}

// Toggle flag on cell
function toggleFlag(x, y) {
    const cell = board[x][y];
    if (!cell.isRevealed) {
        cell.isFlagged = !cell.isFlagged;
    }
}

// Check if player has won
function checkWin() {
    if (gameOver) return false;

    for (let x = 0; x < rows; x++) {
        for (let y = 0; y < cols; y++) {
            const cell = board[x][y];
            // If there's a non-mine cell that hasn't been revealed, game not won
            if (!cell.isMine && !cell.isRevealed) {
                return false;
            }
        }
    }

    return true;
}

// Reveal all mines (for game over)
function revealAllMines() {
    for (let x = 0; x < rows; x++) {
        for (let y = 0; y < cols; y++) {
            const cell = board[x][y];
            if (cell.isMine) {
                cell.isRevealed = true;
            }
        }
    }
}

// Count mines around a cell
function countMinesAround(x, y) {
    let count = 0;

    for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
            const nx = x + dx;
            const ny = y + dy;

            if (inBounds(nx, ny) && board[nx][ny].isMine) {
                count++;
            }
        }
    }

    return count;
}

// Check if coordinates are within board bounds
function inBounds(x, y) {
    return x >= 0 && x < rows && y >= 0 && y < cols;
}

// Get all cells (for game over reveal)
function getAllCells() {
    const allCells = [];

    for (let x = 0; x < rows; x++) {
        for (let y = 0; y < cols; y++) {
            const cell = board[x][y];
            allCells.push({
                x: cell.x,
                y: cell.y,
                isMine: cell.isMine,
                isRevealed: cell.isRevealed,
                isFlagged: cell.isFlagged,
                neighborMines: cell.neighborMines
            });
        }
    }

    return allCells;
}