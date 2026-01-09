import components from '../components/components.js';
import { MinesweeperGame } from './minesweeper.js';

document.addEventListener('DOMContentLoaded', () => {
    components.init();
    new MinesweeperGame();
});