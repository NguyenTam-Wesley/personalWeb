import components from '../components/components.js';
import { LineupAdminManager } from './lineup-admin.js';

// Initialize global UI components (theme, header, etc.)
components.init();

// Small pet for fun (same style as crosshair admin)
components.initPet({
  container: document.body,
  size: 'small',
  theme: 'default',
  position: { x: window.innerWidth - 120, y: window.innerHeight - 120 },
  autoStart: true,
  showControls: false,
  showDebug: false,
  boundaryMode: 'wrap',
  persistence: true,
});

// Initialize lineup admin manager and expose globally for inline handlers
const manager = new LineupAdminManager();
window.lineupAdminManager = manager;

