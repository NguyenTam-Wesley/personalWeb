export class GamesManager {
    constructor() {
        this.games = {
            '2048': {
                id: '2048',
                name: '2048',
                subtitle: 'Number Puzzle Game',
                image: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjMwMCIgdmlld0JveD0iMCAwIDMwMCAzMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIzMDAiIGhlaWdodD0iMzAwIiByeD0iMjAiIGZpbGw9IiMwMGZGRkYiLz4KPHRleHQgeD0iMTUwIiB5PSIxNDAiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSI0MCIgZmlsbD0id2hpdGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj4yMDQ4PC90ZXh0Pgo8dGV4dCB4PSIxNTAiIHk9IjE4MCIgZm9udC1mYW1pbHk9IkFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjE2IiBmaWxsPSJ3aGl0ZSIgdGV4dC1hbmNob3I9Im1pZGRsZSI+U3RyYXRlZ3kgUG96emxlPC90ZXh0Pgo8L3N2Zz4K',
                detailUrl: './games/2048/2048.html',
                description: '2048 là một game ghép số vui nhộn, kết hợp các ô có cùng số để tạo ra ô có giá trị cao hơn.'
            },
            sudoku: {
                id: 'sudoku',
                name: 'Sudoku',
                subtitle: 'Logic Number Puzzle',
                image: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjMwMCIgdmlld0JveD0iMCAwIDMwMCAzMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIzMDAiIGhlaWdodD0iMzAwIiByeD0iMjAiIGZpbGw9IiNGRjZCMkIiLz4KPHRleHQgeD0iMTUwIiB5PSIxNDAiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSI0MCIgZmlsbD0iIzMzMzMzMyIgdGV4dC1hbmNob3I9Im1pZGRsZSI+U3Vkb2t1PC90ZXh0Pgo8dGV4dCB4PSIxNTAiIHk9IjE4MCIgZm9udC1mYW1pbHk9IkFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjE2IiBmaWxsPSIjNjY2IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5Mb2dpYyBQdXp6bGU8L3RleHQ+Cjwvc3ZnPgo=',
                detailUrl: './games/sudoku/sudoku.html',
                description: 'Sudoku là một trò chơi logic điền số vui nhộn, điền các số từ 1-9 vào lưới 9x9 theo quy tắc.'
            },
            valorant: {
                id: 'valorant',
                name: 'Valorant',
                subtitle: 'Tactical Shooter 5v5',
                image: 'https://cdn.glitch.global/d1dee37d-172b-4e0c-969a-6ea2f7f1b378/valorant_bg.png?v=1746445533452',
                detailUrl: './games/valorant.html',
                description: 'Valorant là một game bắn súng chiến thuật 5v5 được phát triển bởi Riot Games.'
            },
            arknights: {
                id: 'arknights',
                name: 'Arknights',
                subtitle: 'Tower Defense Strategy RPG',
                image: 'https://cdn.glitch.global/7f69b45e-2121-41b3-ab25-3a1b9061b040/arknight_theme.jpg?v=1749924526037',
                detailUrl: './games/arknights.html',
                description: 'Arknights là một game tower defense kết hợp với RPG, được phát triển bởi Hypergryph.'
            },
            hsr: {
                id: 'hsr',
                name: 'Honkai: Star Rail',
                subtitle: 'Space Fantasy RPG',
                image: 'https://cdn.glitch.global/7f69b45e-2121-41b3-ab25-3a1b9061b040/hsr_card.png?v=1749924888888',
                detailUrl: './games/hsr.html',
                description: 'Honkai: Star Rail là một game nhập vai phiêu lưu không gian được phát triển bởi HoYoverse.'
            },
            ww: {
                id: 'ww',
                name: 'Wuthering Waves',
                subtitle: 'Open World Action RPG',
                image: 'https://cdn.glitch.global/7f69b45e-2121-41b3-ab25-3a1b9061b040/wuthering-waves.jpg?v=1750260140246',
                detailUrl: './games/ww.html',
                description: 'Wuthering Waves là một game nhập vai hành động thế giới mở được phát triển bởi KURO Game.'
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