export class GamesManager {
    constructor() {
        this.gameCards = document.querySelectorAll('.game-card');
        this.init();
    }

    init() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        this.gameCards.forEach(card => {
            const link = card.querySelector('.game-link');
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const gameType = card.dataset.game;
                this.handleGameClick(gameType);
            });
        });
    }

    handleGameClick(gameType) {
        // Xử lý khi người dùng click vào game
        switch(gameType) {
            case 'valorant':
                window.location.href = '/games/valorant.html';
                break;
            case 'arknights':
                window.location.href = '/games/arknights.html';
                break;
            case 'hsr':
                window.location.href = '/games/hsr.html';
                break;
            default:
                console.log('Game type not found:', gameType);
        }
    }
}

// Initialize the games manager
const gamesManager = new GamesManager(); 