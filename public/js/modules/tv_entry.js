import components from '../components/components.js';
import { TVShow } from './tv.js';

// Initialize components
components.init();

// Initialize pet for TV page
components.initPet({
  container: document.body,
  size: 'small',
  theme: 'dark', // Dark theme for TV viewing
  position: { x: window.innerWidth - 120, y: window.innerHeight - 120 },
  autoStart: true,
  showControls: false,
  showDebug: false,
  boundaryMode: 'wrap',
  persistence: true
});

// Initialize page specific functionality
new TVShow();