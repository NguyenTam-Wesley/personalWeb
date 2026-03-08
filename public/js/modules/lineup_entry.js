import components from '../components/components.js';
import { LineupManager } from './lineup.js';

// Initialize global components (theme, header, pet, etc.)
components.init();

// Optional: pet giống crosshair page
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

// Initialize lineup manager
LineupManager.init();

