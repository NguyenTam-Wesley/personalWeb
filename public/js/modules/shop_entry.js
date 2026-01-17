// 🎯 Shop Page Entry Point
// ✅ Initialize components (header, footer, navigation)
// ✅ Load shop page logic from shop_page.js

import components from '../components/components.js';
import { ShopPage } from './shop_page.js';

// Khởi tạo components và page logic khi DOM ready
document.addEventListener('DOMContentLoaded', () => {
    // Initialize components for consistency
    components.init();

    // Initialize pet for shop page
    components.initPet({
        container: document.body,
        size: 'small',
        theme: 'default',
        position: { x: 100, y: window.innerHeight - 120 }, // Left side for shopping
        autoStart: true,
        showControls: false,
        showDebug: false,
        boundaryMode: 'wrap',
        persistence: true
    });

    window.shopPage = new ShopPage();
});
