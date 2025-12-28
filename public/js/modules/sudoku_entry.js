import components from '../components/components.js';
import { SudokuGame } from './sudoku.js';
import { sudokuScores } from './sudoku_scores.js';

components.init();

document.addEventListener('DOMContentLoaded', () => {
  new SudokuGame(sudokuScores);
});
