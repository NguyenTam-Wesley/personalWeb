import components from '../components/components.js';
import { Game2048 } from "./2048.js";

components.init();

document.addEventListener("DOMContentLoaded", () => {
  const game = new Game2048("grid");
  game.init();
});
