import components from '../components/components.js';
import { ChapterPage } from './chapter.js';

// Initialize components
components.init();

// Initialize pet for chapter reading page
components.initPet({
  container: document.body,
  size: 'small',
  theme: 'default',
  position: { x: window.innerWidth - 120, y: 150 }, // High position for reading focus
  autoStart: true,
  showControls: false,
  showDebug: false,
  boundaryMode: 'wrap',
  persistence: true
});

// Initialize page specific functionality
new ChapterPage();
