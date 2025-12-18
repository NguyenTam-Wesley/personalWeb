// Entry point
import components from '../components/components.js';
import { ProfileManager } from './profile_manager.js';

// Initialize components
components.init();
// Initialize page specific functionality
new ProfileManager();
