import components from '../components/components.js';
import { BlogManager } from './blog.js';
import { themeToggle } from '../components/themeToggle.js';

// Initialize components
components.init();

// Initialize theme toggle
themeToggle.initialize();

// Initialize page specific functionality
new BlogManager();