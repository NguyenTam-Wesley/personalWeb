import components from '../components/components.js';
import { ArknightsOperatorAdminManager } from './arknights-op-admin.js';

// Initialize components
components.init();

// Initialize pet for arknights operator admin (minimal presence)
components.initPet({
  container: document.body,
  size: 'small',
  theme: 'default',
  position: { x: window.innerWidth - 120, y: window.innerHeight - 120 },
  autoStart: true,
  showControls: false,
  showDebug: false,
  boundaryMode: 'wrap',
  persistence: true
});

// Initialize page specific functionality
new ArknightsOperatorAdminManager();