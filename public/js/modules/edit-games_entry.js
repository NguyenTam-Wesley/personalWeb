import components from '../components/components.js';

// Initialize components
components.init();

// Initialize pet for edit games admin (minimal presence)
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

// Page is mostly static, no additional JavaScript needed
console.log('Edit Games Admin page loaded');