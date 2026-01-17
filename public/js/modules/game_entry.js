import components from '../components/components.js';
import { GamesManager } from './games.js';

// Initialize components
components.init();

// Initialize pet for games page (consistent small size, no controls by default)
components.initPet({
  container: document.body,
  size: 'small',                   // Consistent with home and music pages
  theme: 'dark',
  position: { x: window.innerWidth - 120, y: window.innerHeight - 120 }, // Adjusted for small size
  autoStart: true,
  showControls: false,             // Hide controls by default, user can enable in profile
  showDebug: false,
  boundaryMode: 'bounce',          // Bounce for more dynamic feel
  persistence: true
});

// Initialize page specific functionality
new GamesManager();
