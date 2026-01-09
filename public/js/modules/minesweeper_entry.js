import components from '../components/components.js';
import { MinesweeperGame } from './minesweeper.js';

document.addEventListener('DOMContentLoaded', () => {
    components.init();
    // Create and expose game instance globally for debugging
    window.minesweeperGame = new MinesweeperGame();
});