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

// Initialize pet for profile page (clean, no controls - settings in Pets tab)
components.initPet({
  container: document.body,
  size: 'small',
  theme: 'default',
  position: { x: window.innerWidth - 120, y: window.innerHeight - 120 },
  autoStart: true,
  showControls: false,       // Hide controls - use Pets tab settings instead
  showDebug: false,
  boundaryMode: 'wrap',
  persistence: true
});

// Initialize page specific functionality
window.profileManager = new ProfileManager();
window.userProfile = new UserProfile();
window.profilePage = new ProfilePage();

// Clear stale achievements cache khi load profile page
achievements.clearUserCache();

// Pet Settings Functionality
function initPetSettings() {
    // Load current preferences
    const prefs = components.getPetPreferences();

    // Update UI elements
    const enabledCheckbox = document.getElementById('pet-enabled');
    const sizeSelect = document.getElementById('pet-size');
    const themeSelect = document.getElementById('pet-theme');
    const statusElement = document.getElementById('pet-status');
    const pageElement = document.getElementById('current-page');

    if (enabledCheckbox) enabledCheckbox.checked = prefs.enabled;
    if (sizeSelect) sizeSelect.value = prefs.size;
    if (themeSelect) themeSelect.value = prefs.theme;

    // Update status
    if (statusElement) {
        statusElement.textContent = window.petComponent ? 'Active' : 'Inactive';
        statusElement.style.color = window.petComponent ? '#2ec4b6' : '#e94560';
    }

    if (pageElement) {
        const pageName = window.location.pathname.split('/').pop().replace('.html', '');
        pageElement.textContent = pageName || 'home';
    }
}

// Global functions for pet settings
window.togglePetEnabled = function() {
    const enabled = document.getElementById('pet-enabled').checked;
    components.togglePet(enabled);
    initPetSettings(); // Refresh UI
};

window.updatePetSize = function() {
    const size = document.getElementById('pet-size').value;
    const prefs = components.getPetPreferences();
    prefs.size = size;
    components.savePetPreferences(prefs);

    // Apply to current pet if exists
    if (window.petComponent) {
        window.petComponent.setSize(size);
    }
};

window.updatePetTheme = function() {
    const theme = document.getElementById('pet-theme').value;
    const prefs = components.getPetPreferences();
    prefs.theme = theme;
    components.savePetPreferences(prefs);

    // Apply to current pet if exists
    if (window.petComponent) {
        window.petComponent.setTheme(theme);
    }
};

// Note: showControls is page-specific and not saved as user preference
// Users can only control: enabled, size, theme globally

window.resetPetPosition = function() {
    if (window.petComponent) {
        const pageName = window.location.pathname.split('/').pop().replace('.html', '') || 'index';
        const pageConfig = components.initPet ? {} : { 'index': {}, 'games': {}, 'music': {} }[pageName];

        const defaultPos = pageConfig?.position || { x: window.innerWidth - 150, y: window.innerHeight - 150 };
        window.petComponent.position = { ...defaultPos };
        window.petComponent.updatePosition();
        window.petComponent.saveState();
        console.log('📍 Pet position reset');
    }
};

window.testPet = function() {
    if (window.petComponent) {
        window.petComponent.randomState();
        window.petComponent.moveToRandomPosition();
        console.log('🎮 Pet test activated');
    } else {
        console.log('🐾 No pet active to test');
    }
};

// Initialize pet settings when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        // Clean up old preferences that might contain showControls
        try {
            const oldPrefs = localStorage.getItem('ntam_pet_preferences');
            if (oldPrefs) {
                const prefs = JSON.parse(oldPrefs);
                // Remove page-specific settings from user preferences
                delete prefs.showControls;
                delete prefs.showDebug;
                localStorage.setItem('ntam_pet_preferences', JSON.stringify(prefs));
            }
        } catch (error) {
            console.warn('Failed to clean up old pet preferences:', error);
        }

        initPetSettings(); // Initialize UI
    }, 100); // Small delay to ensure components are loaded
});