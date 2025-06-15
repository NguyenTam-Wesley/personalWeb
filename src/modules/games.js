export class GamesManager {
    constructor() {
        this.games = {
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
            }
        };
    }

    init() {
        this.renderGames();
        this.setupEventListeners();
    }

    renderGames() {
        const gamesGrid = document.querySelector('.games-grid');
        if (!gamesGrid) return;

        gamesGrid.innerHTML = Object.values(this.games).map(game => `
            <div class="game-card" data-game="${game.id}">
                <img src="${game.image}" alt="${game.name}">
                <div class="game-info">
                    <h2>${game.name}</h2>
                    <a href="${game.detailUrl}" class="game-link">Khám phá</a>
                </div>
            </div>
        `).join('');
    }

    setupEventListeners() {
        const gamesGrid = document.querySelector('.games-grid');
        if (!gamesGrid) return;

        gamesGrid.addEventListener('click', (e) => {
            const gameCard = e.target.closest('.game-card');
            if (!gameCard) return;

            const gameId = gameCard.dataset.game;
            const game = this.games[gameId];
            if (game) {
                // Có thể thêm xử lý trước khi chuyển trang ở đây
                console.log(`Navigating to ${game.name}...`);
            }
        });
    }

    getGame(gameId) {
        return this.games[gameId];
    }

    getAllGames() {
        return Object.values(this.games);
    }
}

// Initialize the games manager
const gamesManager = new GamesManager(); 