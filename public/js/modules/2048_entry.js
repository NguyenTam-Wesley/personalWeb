import components from '../components/components.js';
import { Game2048 } from "./2048.js";

components.init();

document.addEventListener("DOMContentLoaded", () => {
  // Initialize pet for 2048 game
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

  const game = new Game2048("grid");
  game.init();
});
