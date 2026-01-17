import components from '../components/components.js';
import { MinesweeperGame } from './minesweeper.js';

document.addEventListener('DOMContentLoaded', () => {
    components.init();

    // Initialize pet for minesweeper game
    components.initPet({
        container: document.body,
        size: 'small',
        theme: 'dark',
        position: { x: window.innerWidth - 120, y: window.innerHeight - 120 },
        autoStart: true,
        showControls: false,
        showDebug: false,
        boundaryMode: 'bounce',
        persistence: true
    });

    // Create and expose game instance globally for debugging
    window.minesweeperGame = new MinesweeperGame();
});