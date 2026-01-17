import components from "../components/components.js";
import { MusicPlayer } from './music.js';

// Initialize components
components.init();

// Initialize pet for music page (left side positioning)
components.initPet({
  container: document.body,
  size: 'small',
  theme: 'default',
  position: { x: 100, y: window.innerHeight - 120 },
  autoStart: true,
  showControls: false,
  showDebug: false,
  boundaryMode: 'wrap',
  persistence: true
});

// Initialize page specific functionality
new MusicPlayer();