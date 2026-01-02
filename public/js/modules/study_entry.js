import components from '../components/components.js';
import { StudyManager } from './study.js';

// Initialize everything when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Initialize components
    components.init();
    // Initialize page specific functionality
    new StudyManager();
});