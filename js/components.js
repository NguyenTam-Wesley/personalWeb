import { getCurrentUser, logoutUser } from './auth.js';

class Components {
  constructor() {
    // Configuration
    this.config = {
      socialLinks: [
        { name: 'GitHub', url: 'https://github.com/NguyenTam-Wesley' },
        { name: 'Facebook', url: 'https://facebook.com/w.nctam' },
        { name: 'YouTube', url: 'https://www.youtube.com/@wesley-shouyuett7' }
      ],
      navLinks: [
        { name: 'Home', url: '/' },
        { name: 'Music', url: '/pages/music.html' },
        { name: 'Study', url: '/pages/study.html' },
        { name: 'Games', url: '/pages/games.html' }
      ]
    };

    // Initialize components
    this.header = null;
    this.footer = null;
    this.init();
  }

  init() {
    this.initHeader();
    this.initFooter();
    this.setupScrollHandlers();
  }

  // Header Methods
  initHeader() {
    this.header = document.createElement('header');
    this.setupHeader();
  }

  setupHeader() {
    this.header.innerHTML = `
      <div class="nav-wrapper">
        <nav>
          <ul>
            ${this.config.navLinks.map(link => `
              <li><a href="${link.url}">${link.name}</a></li>
            `).join('')}
          </ul>
        </nav>
        <div id="greeting"></div>
        <div class="login-btn">
          <a href="/pages/login.html" id="loginLink">Login</a>
        </div>
      </div>
    `;

    document.body.insertBefore(this.header, document.body.firstChild);
    this.updateLoginStatus();
    this.highlightActiveLink();
  }

  async updateLoginStatus() {
    const loginLink = document.getElementById("loginLink");
    const greeting = document.getElementById("greeting");
    const user = await getCurrentUser();

    if (user) {
      greeting.textContent = `Xin chào, ${user.username}`;
      loginLink.textContent = "Logout";
      loginLink.href = "#";
      loginLink.onclick = (e) => {
        e.preventDefault();
        logoutUser();
        location.reload();
      };
    } else {
      greeting.textContent = "";
      loginLink.textContent = "Login";
      loginLink.href = "/pages/login.html";
      loginLink.onclick = null;
    }
  }

  highlightActiveLink() {
    const currentPath = window.location.pathname;
    const links = this.header.querySelectorAll('nav a');
    
    links.forEach(link => {
      if (link.getAttribute('href') === currentPath) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });
  }

  // Footer Methods
  initFooter() {
    this.footer = document.createElement('footer');
    this.setupFooter();
  }

  setupFooter() {
    this.footer.innerHTML = `
      <div class="socials">
        ${this.config.socialLinks.map(link => `
          <a href="${link.url}" target="_blank">${link.name}</a>
        `).join('')}
      </div>
      <p>&copy;ntam</p>
    `;

    document.body.appendChild(this.footer);
  }

  // Scroll Handlers
  setupScrollHandlers() {
    let lastScroll = 0;
    const scrollThreshold = 50;

    window.addEventListener('scroll', () => {
      const currentScroll = window.pageYOffset;

      // Hide header when scrolling down, show when scrolling up
      if (currentScroll > lastScroll && currentScroll > scrollThreshold) {
        this.header.classList.add('hide');
      } else {
        this.header.classList.remove('hide');
      }

      // Hide footer when scrolling down, show when scrolling up
      if (currentScroll > lastScroll && currentScroll > scrollThreshold) {
        this.footer.classList.add('hide');
      } else {
        this.footer.classList.remove('hide');
      }

      lastScroll = currentScroll;
    });
  }

  // Public Methods
  getHeader() {
    return this.header;
  }

  getFooter() {
    return this.footer;
  }

  // Utility Methods
  static create() {
    return new Components();
  }
}

// Export singleton instance
export const components = Components.create(); 