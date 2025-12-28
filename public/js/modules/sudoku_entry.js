// Entry point với Auth State Management
import components from '../components/components.js';
import { supabase, onAuthReady } from '../supabase/supabase.js';
import { SudokuGame } from './sudoku.js';

components.init();

let game = null;

document.addEventListener('DOMContentLoaded', () => {
  // Đợi auth ready rồi mới tạo game
  onAuthReady(user => {
    if (!game) {
      // Tạo game với user state
      game = new SudokuGame({
        supabase,
        user,
        difficulty: 'medium'
      });
      game.init();
    } else {
      // Update user state nếu game đã tạo
      game.updateUser(user);
    }
  });
});
