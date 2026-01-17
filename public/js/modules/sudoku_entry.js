import components from '../components/components.js';
import { SudokuGame } from './sudoku.js';

document.addEventListener('DOMContentLoaded', () => {
  components.init();

  // Initialize pet for sudoku game
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

  new SudokuGame();
});
