// 🎯 Profile Page Entry Point
// ✅ Initialize components (header, footer, navigation)
// ✅ Load profile page logic from profile_page.js

import components from '../components/components.js';
import { ProfileManager } from './profile_manager.js';
import { UserProfile } from './user_profile.js';
import { ProfilePage } from './profile_page.js';

// Khởi tạo components và page logic khi DOM ready
document.addEventListener('DOMContentLoaded', () => {
    // Initialize components for consistency
    components.init();

    window.profileManager = new ProfileManager();
    window.userProfile = new UserProfile();
    window.profilePage = new ProfilePage();
});
