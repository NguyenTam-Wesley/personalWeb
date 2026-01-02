import components from '../components/components.js';
import { SudokuGame } from './sudoku.js';
import { sudokuScores } from './sudoku_scores.js';

document.addEventListener('DOMContentLoaded', () => {
  components.init();
  new SudokuGame(sudokuScores);
});
