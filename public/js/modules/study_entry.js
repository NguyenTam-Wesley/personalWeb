import components from '../components/components.js';
import { StudyManager } from './study.js';

// Initialize everything when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Initialize components
    components.init();

    // Initialize pet for study page
    components.initPet({
        container: document.body,
        size: 'small',
        theme: 'default',
        position: { x: window.innerWidth - 120, y: 200 }, // Higher for study focus
        autoStart: true,
        showControls: false,
        showDebug: false,
        boundaryMode: 'wrap',
        persistence: true
    });

    // Initialize page specific functionality
    new StudyManager();
});