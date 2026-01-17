import { getCurrentUserWithRetry, logoutUser } from '../supabase/auth.js';
import { ROUTES, route } from '../routes/routes.js';
import { themeToggle } from './themeToggle.js';
import { Pet } from './pet.js';

export class Components {
  constructor() {
    if (Components.instance) return Components.instance;
    Components.instance = this;

    this.isLoggedIn = false;
    this.userName = '';
    this.userRole = '';
    this.pet = null;

    this.config = {
      socialLinks: [
        { name: 'GitHub', url: 'https://github.com/NguyenTam-Wesley' },
        { name: 'Facebook', url: 'https://facebook.com/w.nctam' },
        { name: 'YouTube', url: 'https://www.youtube.com/@wesley-shouyuett7' }
      ],

      navLinks: [
        { name: 'Music', url: route('pages.music') },
        { name: 'Study', url: route('pages.study') },
        { name: 'Games', url: route('pages.games') },
        { name: 'Blog', url: route('pages.blog') },
        { name: 'Novel', url: route('pages.novel') },
        { name: 'TV', url: route('pages.tv') }
      ]
    };

    this.header = null;
    this.footer = null;
    this.initialized = false;
  }

  /* ================= INIT ================= */

  init() {
    if (this.initialized) return;
    this.initialized = true;

    console.log('🎯 Components initializing...');

    this.initHeader();
    this.initFooter();
    this.setupScrollHandlers();

    console.log('✅ Components initialized successfully!');
  }

  /* ================= HEADER ================= */

  initHeader() {
    this.header = document.createElement('header');
    this.setupHeader();
    document.body.prepend(this.header);
    this.updateLoginStatus();
    // Note: initThemeToggle is called after updateLoginStatus to ensure it's initialized after any header re-renders
  }



  setupHeader() {
    this.header.innerHTML = `
      <nav>
        <a href="${ROUTES.home}" class="nav-logo">ntam</a>

        <div class="nav-links">
          ${this.config.navLinks.map(link =>
            `<a href="${link.url}" class="nav-link">${link.name}</a>`
          ).join('')}
        </div>

        <div class="nav-controls">
          ${this.renderAuthSection()}
          <button id="themeToggle" class="theme-toggle-btn" title="Toggle Dark Mode">
            <span class="theme-icon">🌙</span>
          </button>
        </div>
      </nav>
    `;

    this.highlightActiveLink();
  }

  renderAuthSection() {
    if (!this.isLoggedIn) {
      return `
        <div class="auth-buttons">
          <a href="${route('pages.login')}" class="auth-button login-button">Login</a>
        </div>
      `;
    }

    return `
      <div class="user-menu">
        <span class="user-name">${this.userName}</span>
        <div class="user-dropdown">
          <a href="${route('pages.profile')}" class="dropdown-item">Profile</a>
          ${this.userRole === 'admin'
            ? `<a href="${route('admin.dashboard')}" class="dropdown-item">Admin</a>`
            : ''
          }
          <a href="#" class="dropdown-item" id="logoutLink">Logout</a>
        </div>
      </div>
    `;
  }

  async updateLoginStatus() {
    let userData = null;
    try {
      // ✅ Sử dụng retry logic để chờ profile được tạo
      userData = await getCurrentUserWithRetry();
    } catch (err) {
      console.error('❌ Lỗi lấy user:', err);
    }

    const prevState = this.isLoggedIn;
    this.isLoggedIn = !!(userData && userData.user);
    this.userName = userData?.profile?.username || userData?.user?.user_metadata?.username || '';
    this.userRole = userData?.profile?.role || 'guest'; // App role, fallback to 'guest' when no profile

    // Log comprehensive user status
    if (this.isLoggedIn) {
      const authRole = userData?.user?.role || 'unknown';
      console.log(`🔐 User status updated: ${this.userName} | Auth Role: ${authRole} | App Role: ${this.userRole}`);
    } else {
      console.log(`🚪 User not logged in (guest mode)`);
    }

    if (prevState !== this.isLoggedIn) {
      this.setupHeader();
      // Re-initialize theme toggle after header re-render
      setTimeout(() => {
        // Destroy existing theme toggle before re-initializing
        if (themeToggle.isReady()) {
          themeToggle.destroy();
        }
        this.initThemeToggle();
      }, 100);
    } else {
      // Initialize theme toggle for the first time
      this.initThemeToggle();
    }

    const logoutLink = document.getElementById('logoutLink');
    if (logoutLink) {
      logoutLink.onclick = async (e) => {
        e.preventDefault();
        await logoutUser();
        window.location.href = ROUTES.home;
      };
    }
  }

  highlightActiveLink() {
    const currentPath = window.location.pathname;
    const links = this.header.querySelectorAll('.nav-link');

    links.forEach(link => {
      const linkPath = new URL(link.href).pathname;
      link.classList.toggle('active', linkPath === currentPath);
    });
  }

  initThemeToggle() {
    // Initialize theme toggle after header is added to DOM
    themeToggle.initialize("#themeToggle");
  }

  /* ================= FOOTER ================= */

  initFooter() {
    this.footer = document.createElement('footer');
    this.footer.innerHTML = `
      <div class="socials">
        ${this.config.socialLinks.map(
          link => `<a href="${link.url}" target="_blank">${link.name}</a>`
        ).join('')}
      </div>
      <p>&copy; ntam</p>
    `;
    document.body.appendChild(this.footer);
  }

  /* ================= SCROLL ================= */

  setupScrollHandlers() {
    let lastScroll = 0;

    window.addEventListener('scroll', () => {
      const currentScroll = window.pageYOffset;
      const scrollingDown = currentScroll > lastScroll;

      if (Math.abs(currentScroll - lastScroll) > 5) {
        this.header?.classList.toggle('hidden', scrollingDown);
        this.footer?.classList.toggle('hidden', scrollingDown);
        lastScroll = currentScroll;
      }
    });
  }

  /* ================= GETTERS ================= */

  getHeader() {
    return this.header;
  }

  getFooter() {
    return this.footer;
  }

  /* ================= PET ================= */

  initPet(options = {}) {
    if (this.pet) {
      console.log('🐾 Pet component already initialized');
      return this.pet;
    }

    try {
      // Get user preferences
      const userPrefs = this.getPetPreferences();

      // Default options based on user preferences or page context
      const defaultOptions = {
        container: document.body,
        size: userPrefs.size,                    // From user prefs
        theme: userPrefs.theme,                  // From user prefs
        position: { x: window.innerWidth - 150, y: window.innerHeight - 150 },
        autoStart: userPrefs.enabled,            // From user prefs
        showControls: false,                     // Page-specific, not from user prefs
        showDebug: false,                        // Page-specific, not from user prefs
        boundaryMode: 'wrap',
        persistence: true,
        ...options                               // Page-specific options override all
      };

      // Only initialize if enabled
      if (!defaultOptions.autoStart) {
        console.log('🐾 Pet disabled by user preferences');
        return null;
      }

      this.pet = new Pet(defaultOptions);

      // Global reference for controls
      window.petComponent = this.pet;

      console.log('🐾 Pet component initialized in Components system');
      return this.pet;

    } catch (error) {
      console.error('❌ Failed to initialize pet component:', error);
      return null;
    }
  }

  // Pet preferences management
  getPetPreferences() {
    try {
      const prefs = localStorage.getItem('ntam_pet_preferences');
      return prefs ? JSON.parse(prefs) : {
        enabled: true,
        size: 'medium',
        theme: 'default'
        // Note: showControls and showDebug are page-specific, not user preferences
      };
    } catch (error) {
      console.warn('Failed to load pet preferences:', error);
      return { enabled: true, size: 'medium', theme: 'default' };
    }
  }

  savePetPreferences(prefs) {
    try {
      localStorage.setItem('ntam_pet_preferences', JSON.stringify(prefs));
      console.log('💾 Pet preferences saved');
    } catch (error) {
      console.error('Failed to save pet preferences:', error);
    }
  }

  togglePet(enabled = null) {
    const currentPrefs = this.getPetPreferences();

    if (enabled === null) {
      enabled = !currentPrefs.enabled;
    }

    const newPrefs = { ...currentPrefs, enabled };
    this.savePetPreferences(newPrefs);

    if (enabled && !this.pet) {
      // Enable pet
      this.initPet();
    } else if (!enabled && this.pet) {
      // Disable pet
      this.pet.destroy();
      this.pet = null;
    }

    console.log(`🐾 Pet ${enabled ? 'enabled' : 'disabled'}`);
    return enabled;
  }
}

/* ============ SINGLETON EXPORT ============ */

const components = new Components();

export default components;
