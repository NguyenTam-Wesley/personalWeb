// 🎯 Profile Page Entry Point
// ✅ Initialize components (header, footer, navigation)
// ✅ Load profile page logic from profile_page.js

import components from '../components/components.js';
import { ProfileManager } from './profile_manager.js';
import { UserProfile } from './user_profile.js';
import { ProfilePage } from './profile_page.js';
import { achievements } from './achievements.js';

// Initialize components immediately (like other entry points)
components.init();

// Initialize page specific functionality
window.profileManager = new ProfileManager();
window.userProfile = new UserProfile();
window.profilePage = new ProfilePage();

// Clear stale achievements cache khi load profile page
achievements.clearUserCache();
