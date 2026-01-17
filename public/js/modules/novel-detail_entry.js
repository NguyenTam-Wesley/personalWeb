import components from '../components/components.js';
import { NovelDetailPage } from './novel-detail.js';

// Initialize components
components.init();

// Initialize pet for novel detail page
components.initPet({
  container: document.body,
  size: 'small',
  theme: 'default',
  position: { x: window.innerWidth - 120, y: 200 },
  autoStart: true,
  showControls: false,
  showDebug: false,
  boundaryMode: 'wrap',
  persistence: true
});

// Initialize page specific functionality
new NovelDetailPage();
