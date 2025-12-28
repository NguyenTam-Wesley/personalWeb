import components from '../components/components.js';
import { Game2048 } from "./2048.js";

components.init();

document.addEventListener("DOMContentLoaded", () => {
  const game = new Game2048("grid");
  game.init();

  // Thêm event listener cho nút reset
  const resetBtn = document.getElementById('resetBtn');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      game.reset();
    });
  }
});
