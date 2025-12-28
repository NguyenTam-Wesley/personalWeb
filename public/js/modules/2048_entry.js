import { Game2048 } from "./2048.js";

document.addEventListener("DOMContentLoaded", () => {
  const game = new Game2048("grid");
  game.init();
});
