export class GamesManager {
    constructor() {
        this.games = {
            '2048': {
                id: '2048',
                name: '2048',
                subtitle: 'Number Puzzle Game',
                image: 'https://calwzopyjitbtahiafzw.supabase.co/storage/v1/object/sign/web-pic/bg/game/2048/2048.avif?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV84Mzg1MDYzNy1jNjQwLTQwYjQtYTk0OS1hODY4YmI0Yzk2YmMiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJ3ZWItcGljL2JnL2dhbWUvMjA0OC8yMDQ4LmF2aWYiLCJpYXQiOjE3NjgwOTU1NDYsImV4cCI6MTA0MDgwMDkxNDZ9.NI1qgVSmTl6N_BppKjYhTs8X_A75N0po3Mj5A2-lgUU',
                detailUrl: './games/2048/2048.html',
                description: '2048 là một game ghép số vui nhộn, kết hợp các ô có cùng số để tạo ra ô có giá trị cao hơn.'
            },
            sudoku: {
                id: 'sudoku',
                name: 'Sudoku',
                subtitle: 'Logic Number Puzzle',
                image: 'https://calwzopyjitbtahiafzw.supabase.co/storage/v1/object/sign/web-pic/bg/game/sudoku/sudoku.avif?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV84Mzg1MDYzNy1jNjQwLTQwYjQtYTk0OS1hODY4YmI0Yzk2YmMiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJ3ZWItcGljL2JnL2dhbWUvc3Vkb2t1L3N1ZG9rdS5hdmlmIiwiaWF0IjoxNzY4MDk1NDk3LCJleHAiOjg4MTY4MDA5MDk3fQ.IG0os6rmQ1Cv46no0geNTh8nMGZwc9yE9WuxqslNksg',
                detailUrl: './games/sudoku/sudoku.html',
                description: 'Sudoku là một trò chơi logic điền số vui nhộn, điền các số từ 1-9 vào lưới 9x9 theo quy tắc.'
            },
            valorant: {
                id: 'valorant',
                name: 'Valorant',
                subtitle: 'Tactical Shooter 5v5',
                image: 'https://calwzopyjitbtahiafzw.supabase.co/storage/v1/object/sign/web-pic/bg/game/valorant/gameCard/supersonic-the-jett-valorant-fan-art-4k-g9.avif?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV84Mzg1MDYzNy1jNjQwLTQwYjQtYTk0OS1hODY4YmI0Yzk2YmMiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJ3ZWItcGljL2JnL2dhbWUvdmFsb3JhbnQvZ2FtZUNhcmQvc3VwZXJzb25pYy10aGUtamV0dC12YWxvcmFudC1mYW4tYXJ0LTRrLWc5LmF2aWYiLCJpYXQiOjE3NjgwOTU4MDQsImV4cCI6ODgxNjgwMDk0MDR9.vf7uUtFbI-GXQ1fQ-q5xpavL3Y9IEe1wLrKLKrJmYWE',
                detailUrl: './games/valorant.html',
                description: 'Valorant là một game bắn súng chiến thuật 5v5 được phát triển bởi Riot Games.'
            },
            arknights: {
                id: 'arknights',
                name: 'Arknights',
                subtitle: 'Tower Defense Strategy RPG',
                image: 'https://calwzopyjitbtahiafzw.supabase.co/storage/v1/object/sign/web-pic/bg/game/a9/a9.avif?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV84Mzg1MDYzNy1jNjQwLTQwYjQtYTk0OS1hODY4YmI0Yzk2YmMiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJ3ZWItcGljL2JnL2dhbWUvYTkvYTkuYXZpZiIsImlhdCI6MTc2ODA5NzEwNywiZXhwIjoxMDQwODAxMDcwN30.dJZ-EZcSXxIeNQ9-9re0-g_oz7cGjl3flTIHy4WBTqE',
                detailUrl: './games/arknights.html',
                description: 'Arknights là một game tower defense kết hợp với RPG, được phát triển bởi Hypergryph.'
            },
            hsr: {
                id: 'hsr',
                name: 'Honkai: Star Rail',
                subtitle: 'Space Fantasy RPG',
                image: 'https://calwzopyjitbtahiafzw.supabase.co/storage/v1/object/sign/web-pic/bg/game/hsr/gameCard/hsr.avif?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV84Mzg1MDYzNy1jNjQwLTQwYjQtYTk0OS1hODY4YmI0Yzk2YmMiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJ3ZWItcGljL2JnL2dhbWUvaHNyL2dhbWVDYXJkL2hzci5hdmlmIiwiaWF0IjoxNzY4MDk2NzYzLCJleHAiOjg4MTY4MDEwMzYzfQ.MKKc_G1xI_1behSymw1JzMnQWBy4PEgN8E1_zRxSsDQ',
                detailUrl: './games/hsr.html',
                description: 'Honkai: Star Rail là một game nhập vai phiêu lưu không gian được phát triển bởi HoYoverse.'
            },
            ww: {
                id: 'ww',
                name: 'Wuthering Waves',
                subtitle: 'Open World Action RPG',
                image: 'https://calwzopyjitbtahiafzw.supabase.co/storage/v1/object/sign/web-pic/bg/game/ww/wuthering-waves.avif?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV84Mzg1MDYzNy1jNjQwLTQwYjQtYTk0OS1hODY4YmI0Yzk2YmMiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJ3ZWItcGljL2JnL2dhbWUvd3cvd3V0aGVyaW5nLXdhdmVzLmF2aWYiLCJpYXQiOjE3NjgwOTY1MTcsImV4cCI6NDg5MDE2MDUxN30.jA1CXjMqc8RKBqf9xsWs1cNabS7WRKUM-byQd9nJ3dU',
                detailUrl: './games/ww.html',
                description: 'Wuthering Waves là một game nhập vai hành động thế giới mở được phát triển bởi KURO Game.'
            },
            minesweeper: {
                id: 'minesweeper',
                name: 'Minesweeper',
                subtitle: 'Classic Puzzle Game',
                image: 'https://calwzopyjitbtahiafzw.supabase.co/storage/v1/object/sign/web-pic/bg/game/minesweeper/minesweeper.avif?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV84Mzg1MDYzNy1jNjQwLTQwYjQtYTk0OS1hODY4YmI0Yzk2YmMiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJ3ZWItcGljL2JnL2dhbWUvbWluZXN3ZWVwZXIvbWluZXN3ZWVwZXIuYXZpZiIsImlhdCI6MTc2ODA5Njk1MywiZXhwIjo4ODE2ODAxMDU1M30.F4oZQIlCz9NdoaeghoRQeRYXF24I5fK_tP1-leVvcAE',
                detailUrl: './games/minesweeper/minesweeper.html',
                description: 'Minesweeper là một game giải đố cổ điển, tìm tất cả các quả mìn ẩn trong bảng mà không kích hoạt chúng.'
            }
        };
        this.init()
    }

    init() {
        try {
            this.renderGames();
            this.setupEventListeners();
        } catch (err) {
            console.error('Error initializing GamesManager:', err);
        }
    }

    renderGames() {
        try {
            const gamesGrid = document.querySelector('.games-grid');
            if (!gamesGrid) {
                console.error('Games grid element not found');
                return;
            }

            gamesGrid.innerHTML = Object.values(this.games).map(game => `
                <a href="${this.escapeHtml(game.detailUrl)}" class="game-card" data-game="${this.escapeHtml(game.id)}">
                    <img src="${this.escapeHtml(game.image)}" alt="${this.escapeHtml(game.name)}" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22/%3E';">
                    <div class="game-info">
                        <span>${this.escapeHtml(game.name)}</span>
                    </div>
                </a>
            `).join('');
        } catch (err) {
            console.error('Error rendering games:', err);
            const gamesGrid = document.querySelector('.games-grid');
            if (gamesGrid) {
                gamesGrid.innerHTML = '<div style="color: red; padding: 20px;">❌ Lỗi khi tải danh sách game</div>';
            }
        }
    }

    setupEventListeners() {
        try {
            const gamesGrid = document.querySelector('.games-grid');
            if (!gamesGrid) {
                console.warn('Games grid element not found for event listeners');
                return;
            }

            gamesGrid.addEventListener('click', (e) => {
                try {
                    const gameCard = e.target.closest('.game-card');
                    if (!gameCard) return;

                    const gameId = gameCard.dataset.game;
                    const game = this.games[gameId];
                    if (game) {
                        // Có thể thêm xử lý trước khi chuyển trang ở đây
                        console.log(`Navigating to ${game.name}...`);
                    }
                } catch (err) {
                    console.error('Error handling game card click:', err);
                }
            });
        } catch (err) {
            console.error('Error setting up event listeners:', err);
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    getGame(gameId) {
        return this.games[gameId];
    }

    getAllGames() {
        return Object.values(this.games);
    }
}

// Have to be exported for entry point