import components from '../components/components.js';
import { GameDetailManager } from './game-detail.js';

// Initialize components
components.init();

// Initialize pet for game detail pages
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

// Initialize page specific functionality
new GameDetailManager();