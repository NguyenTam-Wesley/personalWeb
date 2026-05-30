import { getCurrentUserWithRetry, logoutUser } from '../supabase/auth.js';
import { ROUTES, route } from '../routes/routes.js';
import { themeToggle } from './themeToggle.js';
import { Pet } from './pet.js';
import { coreIcon } from './core-icons.js';

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


    this.initHeader();
    this.initFooter();
    this.setupScrollHandlers();

  }

  /* ================= HEADER ================= */

  initHeader() {
    this.header = document.createElement('header');
    this.header.className = 'ri-network-header';
    this.setupHeader();
    document.body.prepend(this.header);
    this.updateLoginStatus();
    // Note: initThemeToggle is called after updateLoginStatus to ensure it's initialized after any header re-renders
  }



  getNavDisplayName(name) {
    const labels = {
      Music: 'MUSIC ARCHIVE',
      Study: 'KNOWLEDGE ARCHIVE',
      Games: 'TRAINING SIMULATOR',
      Blog: 'BLOG INDEX',
      Novel: 'NOVEL INDEX',
      TV: 'MEDIA INDEX'
    };
    return labels[name] || String(name).toUpperCase();
  }

  setupHeader() {
    this.header.innerHTML = `
      <nav class="ri-nav" aria-label="Rhodes Island Network">
        <a href="${ROUTES.home}" class="nav-logo ri-net-brand">
          <span class="ri-net-badge" aria-hidden="true">
            <span class="ri-net-id">NET-001</span>
            ${coreIcon('network', 'ri-core-icon ri-net-icon')}
          </span>
          <span class="ri-net-title">
            <span class="ri-net-kicker">RI-NET</span>
            <span class="ri-net-name">RHODES ISLAND NETWORK</span>
          </span>
        </a>

        <div class="ri-net-status" aria-hidden="true">
          <span class="ri-status-pill ri-status-pill--live">
            ${coreIcon('signal', 'ri-core-icon ri-status-icon')}
            <span>ARCHIVE ONLINE</span>
          </span>
        </div>

        <div class="nav-links ri-nav-modules">
          ${this.config.navLinks.map(link =>
            `<a href="${link.url}" class="nav-link">${this.getNavDisplayName(link.name)}</a>`
          ).join('')}
        </div>

        <div class="nav-controls ri-nav-controls">
          ${this.renderAuthSection()}
          <button id="themeToggle" class="theme-toggle-btn" type="button" title="Toggle Dark Mode">
            <span class="theme-icon" aria-hidden="true">🌙</span>
          </button>
        </div>
      </nav>
    `;

    this.highlightActiveLink();
  }

  renderAuthSection() {
    if (!this.isLoggedIn) {
      return `
        <div class="ri-operator-panel">
          <span class="ri-operator-label">ACCESS</span>
          <div class="auth-buttons">
            <a href="${route('pages.login')}" class="auth-button login-button">
              ${coreIcon('access', 'ri-core-icon ri-auth-icon')}
              <span>SIGN IN</span>
            </a>
          </div>
        </div>
      `;
    }

    const accessLevel = String(this.userRole || 'guest').toUpperCase();

    return `
      <div class="ri-operator-panel">
        <span class="ri-operator-meta">
          <span class="ri-operator-label">OPERATOR</span>
          <span class="ri-access-level">${accessLevel}</span>
        </span>
        <div class="user-menu">
          <span class="user-name">${this.userName}</span>
          <div class="user-dropdown">
            <a href="${route('pages.profile')}" class="dropdown-item">Profile</a>
            <a href="${route('pages.profileManager')}" class="dropdown-item">Edit Profile</a>
            ${this.userRole === 'admin'
              ? `<a href="${route('admin.dashboard')}" class="dropdown-item">Admin</a>`
              : ''
            }
            <a href="#" class="dropdown-item" id="logoutLink">Logout</a>
          </div>
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
    this.footer.className = 'ri-system-footer';
    this.footer.innerHTML = `
      <div class="ri-sys-bar">
        <div class="ri-sys-segment ri-sys-build">
          <span class="ri-sys-label">BUILD</span>
          <span class="ri-sys-value">2.7.1</span>
        </div>
        <span class="ri-sys-divider" aria-hidden="true"></span>
        <div class="ri-sys-segment ri-sys-node">
          ${coreIcon('node', 'ri-core-icon ri-sys-icon')}
          <span class="ri-sys-label">NODE</span>
          <span class="ri-sys-value">A-03</span>
        </div>
        <span class="ri-sys-divider" aria-hidden="true"></span>
        <div class="ri-sys-segment ri-sys-status">
          ${coreIcon('signal', 'ri-core-icon ri-sys-icon')}
          <span class="ri-sys-label">SYS</span>
          <span class="ri-sys-value ri-sys-value--live">ONLINE</span>
        </div>
        <span class="ri-sys-divider" aria-hidden="true"></span>
        <div class="ri-sys-segment ri-sys-archive">
          ${coreIcon('archive', 'ri-core-icon ri-sys-icon')}
          <span class="ri-sys-label">ARCHIVE</span>
          <span class="ri-sys-value">ACTIVE</span>
        </div>
        <span class="ri-sys-divider ri-sys-divider--grow" aria-hidden="true"></span>
        <div class="ri-sys-segment ri-sys-net">
          <span class="ri-sys-label">RHODES NET</span>
          <span class="ri-sys-value">SYNCED</span>
        </div>
        <span class="ri-sys-divider" aria-hidden="true"></span>
        <div class="socials ri-sys-segment ri-sys-links">
          ${this.config.socialLinks.map(
            link => `<a href="${link.url}" target="_blank" rel="noopener noreferrer">${link.name}</a>`
          ).join('')}
        </div>
      </div>
    `;
    document.body.appendChild(this.footer);
  }

  /* ================= SCROLL ================= */

  setupScrollHandlers() {
    let lastScroll = 0;
    let ticking = false;

    const updateScrollVisibility = () => {
      const currentScroll = window.pageYOffset;
      const scrollingDown = currentScroll > lastScroll;

      // Only update if significant scroll change (5px threshold)
      if (Math.abs(currentScroll - lastScroll) > 5) {
        if (scrollingDown) {
          this.header?.classList.add('hidden');
          this.footer?.classList.add('hidden');
        } else {
          this.header?.classList.remove('hidden');
          this.footer?.classList.remove('hidden');
        }

        lastScroll = currentScroll;
      }

      ticking = false;
    };

    window.addEventListener('scroll', () => {
      if (!ticking) {
        requestAnimationFrame(updateScrollVisibility);
        ticking = true;
      }
    }, { passive: true });
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
        return null;
      }

      this.pet = new Pet(defaultOptions);

      // Global reference for controls
      window.petComponent = this.pet;

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

    return enabled;
  }
}

/* ============ SINGLETON EXPORT ============ */

const components = new Components();

export default components;
