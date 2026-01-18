import components from '../components/components.js';
import { themeToggle } from '../components/themeToggle.js';
import { ArchetypeManager } from './archetype.js';

// Initialize components
components.init();

// Initialize theme toggle
themeToggle.initialize();

// Initialize pet for archetype page
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

// Initialize page specific functionality
new ArchetypeManager().init();