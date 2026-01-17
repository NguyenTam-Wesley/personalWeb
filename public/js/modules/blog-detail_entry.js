import components from '../components/components.js';
import { BlogDetailManager } from './blog-detail.js';

// Initialize components
components.init();

// Initialize pet for blog detail page
components.initPet({
  container: document.body,
  size: 'small',
  theme: 'default',
  position: { x: window.innerWidth - 120, y: 200 }, // Higher position for reading
  autoStart: true,
  showControls: false,
  showDebug: false,
  boundaryMode: 'wrap',
  persistence: true
});

// Initialize page specific functionality
new BlogDetailManager();