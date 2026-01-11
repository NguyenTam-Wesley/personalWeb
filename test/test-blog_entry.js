// test-blog_entry.js
import components from '../public/js/components/components.js';
import { BlogTestManager } from './test-blog.js';

// Initialize components
console.log('🧪 Initializing components for Test Blog...');
components.init();

// Initialize page specific functionality
console.log('🧪 Initializing BlogTestManager...');
new BlogTestManager();

console.log('✅ Test Blog system initialized successfully!');