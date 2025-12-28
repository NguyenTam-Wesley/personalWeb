// sudoku.worker.js - Web Worker để sinh Sudoku không block UI

// ===== Helper =====
function cloneBoard(board) {
    return board.map(row => [...row]);
}

function isValid(board, row, col, num) {
    for (let i = 0; i < 9; i++) {
        if (board[row][i] === num) return false;
        if (board[i][col] === num) return false;
    }

    const br = Math.floor(row / 3) * 3;
    const bc = Math.floor(col / 3) * 3;

    for (let r = br; r < br + 3; r++) {
        for (let c = bc; c < bc + 3; c++) {
            if (board[r][c] === num) return false;
        }
    }
    return true;
}

// ===== Generate full Sudoku =====
function generateFullBoard() {
    const board = Array.from({ length: 9 }, () => Array(9).fill(0));

    function solve() {
        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                if (board[r][c] === 0) {
                    const nums = [1,2,3,4,5,6,7,8,9].sort(() => Math.random() - 0.5);
                    for (let n of nums) {
                        if (isValid(board, r, c, n)) {
                            board[r][c] = n;
                            if (solve()) return true;
                            board[r][c] = 0;
                        }
                    }
                    return false;
                }
            }
        }
        return true;
    }

    solve();
    return board;
}

// ===== Check unique solution =====
function hasUniqueSolution(board, limit = 2) {
    let count = 0;

    function solve() {
        if (count >= limit) return;

        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                if (board[r][c] === null) {
                    for (let n = 1; n <= 9; n++) {
                        if (isValid(board, r, c, n)) {
                            board[r][c] = n;
                            solve();
                            board[r][c] = null;
                        }
                    }
                    return;
                }
            }
        }
        count++;
    }

    solve();
    return count === 1;
}

// ===== Create puzzle =====
function generatePuzzle(solution, difficulty) {
    const DIFF = {
        easy: [35, 40],
        medium: [45, 50],
        hard: [50, 55],
        very_hard: [55, 60],
        expert: [60, 64]
    };

    const [min, max] = DIFF[difficulty];
    const puzzle = cloneBoard(solution);
    let removeCount = Math.floor(Math.random() * (max - min + 1)) + min;

    let tries = 0;
    while (removeCount > 0 && tries < 500) {
        tries++;
        const r = Math.floor(Math.random() * 9);
        const c = Math.floor(Math.random() * 9);

        if (puzzle[r][c] === null) continue;

        const backup = puzzle[r][c];
        puzzle[r][c] = null;

        // chỉ kiểm tra nghiệm cho mức khó
        if (["hard", "very_hard", "expert"].includes(difficulty)) {
            const test = cloneBoard(puzzle);
            if (!hasUniqueSolution(test)) {
                puzzle[r][c] = backup;
                continue;
            }
        }

        removeCount--;
    }

    return puzzle;
}

// ===== Worker listener =====
self.onmessage = function (e) {
    const { difficulty } = e.data;

    const solution = generateFullBoard();
    const puzzle = generatePuzzle(solution, difficulty);

    self.postMessage({ solution, puzzle });
};
