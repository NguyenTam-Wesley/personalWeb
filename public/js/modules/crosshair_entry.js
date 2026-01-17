import components from '../components/components.js';
import { CrosshairManager } from './crosshair.js';

// Initialize components
components.init();

// Initialize pet for crosshair page
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

// Initialize crosshair manager
CrosshairManager.init();
