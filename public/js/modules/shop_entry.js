// 🎯 Shop Page Entry Point
// ✅ Initialize components (header, footer, navigation)
// ✅ Load shop page logic from shop_page.js

import components from '../components/components.js';
import { ShopPage } from './shop_page.js';

// Khởi tạo components và page logic khi DOM ready
document.addEventListener('DOMContentLoaded', () => {
    // Initialize components for consistency
    components.init();

    window.shopPage = new ShopPage();
});
