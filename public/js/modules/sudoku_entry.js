import components from '../components/components.js';
import { SudokuGame } from './sudoku.js';

document.addEventListener('DOMContentLoaded', () => {
  components.init();
  new SudokuGame();
});
