import components from '../components/components.js';
import { themeToggle } from '../components/themeToggle.js';
import { EndfieldCombatManager } from './endfield_combat.js';

components.init();
themeToggle.initialize();

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

new EndfieldCombatManager().init();
