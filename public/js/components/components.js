import { getCurrentUser, logoutUser } from '../supabase/auth.js';

export class Components {
  constructor() {
    // Kiểm tra xem đã có instance nào được tạo chưa
    if (Components.instance) {
      return Components.instance;
    }
    Components.instance = this;

    this.isLoggedIn = false;
    this.userName = '';
    this.userRole = '';
    // Configuration
    this.config = {
      socialLinks: [
        { name: 'GitHub', url: 'https://github.com/NguyenTam-Wesley' },
        { name: 'Facebook', url: 'https://facebook.com/w.nctam' },
        { name: 'YouTube', url: 'https://www.youtube.com/@wesley-shouyuett7' }
      ],
      // Định nghĩa các route cơ bản
      routes: {
        home: 'index.html',
        music: '/public/pages/music.html',
        study: '/public/pages/study.html',
        games: '/public/pages/games.html',
        login: '/public/pages/login.html'
      }
    };

    // Lấy đường dẫn hiện tại
    this.currentPath = window.location.pathname;
    this.isInPages = this.currentPath.includes('/pages/');
    this.isInGames = this.currentPath.includes('/games/');
    this.isInValorant = this.currentPath.includes('/valorant/');
    this.isInCrosshair = this.currentPath.includes('/crosshair.html');
    this.isInAdmin = this.currentPath.includes('/admin/');

    // Tạo navLinks dựa trên vị trí hiện tại
    this.config.navLinks = [
      { name: 'Home', url: '/public/index.html' },
      { name: 'Music', url: '/public/pages/music.html' },
      { name: 'Study', url: '/public/pages/study.html' },
      { name: 'Games', url: '/public/pages/games.html' },
      { name: 'Blog', url: '/public/pages/blog.html' },
      { name: 'Novel', url: '/public/pages/novel.html' }
    ];

    // Initialize components
    this.header = null;
    this.footer = null;
    this.initialized = false;
  }

  init() {
    if (this.initialized) return;
    this.initialized = true;

    console.log('✅ init started');

    this.initHeader();
    console.log('✅ header initialized');

    this.initFooter();
    console.log('✅ footer initialized');

    this.setupScrollHandlers();
    console.log('✅ scroll handler attached');
  }

  // Header Methods
  initHeader() {
    this.header = document.createElement('header');
    this.setupHeader();
  }

  setupHeader() {
    this.header.innerHTML = `
      <nav>
        <a href="${this.isInValorant ? '../../../index.html' :
                  this.isInGames ? '../../index.html' : 
                  this.isInAdmin ? '../../index.html' :
                  this.isInPages ? '../index.html' : 
                  'index.html'}" class="nav-logo">
          ntam
        </a>
        
        <div class="nav-links">
          ${this.config.navLinks.map(link => `
            <a href="${link.url}" class="nav-link">${link.name}</a>
          `).join('')}
        </div>

        <div class="nav-controls">
        
          ${this.isLoggedIn ? `
            <div class="user-menu">
              <span class="user-name">${this.userName}</span>
              <div class="user-dropdown">
                <a href="#" class="dropdown-item" id="profileLink">Profile</a>
                ${this.userRole === 'admin' ? `
                  <a href="/pages/admin/admin.html" class="dropdown-item" id="adminLink">Admin</a>
                ` : ''}
                <a href="#" class="dropdown-item" id="logoutLink">Logout</a>
              </div>
            </div>
          ` : `
            <div class="auth-buttons">
              <a href="${this.isInValorant ? '../../login.html' :
                        this.isInGames ? '../login.html' : 
                        this.isInAdmin ? '../login.html' :
                        this.isInPages ? 'login.html' : 
                        'pages/login.html'}" class="auth-button login-button">Login</a>
            </div>
          `}
        </div>
      </nav>
    `;

    document.body.insertBefore(this.header, document.body.firstChild);
    this.updateLoginStatus();
    this.highlightActiveLink();
  }

  async updateLoginStatus() {
    let user;
    try {
      user = await getCurrentUser();
    } catch (err) {
      console.error('Lỗi khi lấy thông tin user:', err);
      user = null;
    }
    const wasLoggedIn = this.isLoggedIn;
    this.isLoggedIn = !!user;
    this.userName = user?.username || '';
    this.userRole = user?.role || '';

    // Chỉ cập nhật lại header nếu trạng thái đăng nhập thay đổi
    if (wasLoggedIn !== this.isLoggedIn) {
      this.updateHeaderContent();
    }

    // Thêm event listeners cho các nút trong dropdown
    if (this.isLoggedIn) {
      const logoutLink = document.getElementById('logoutLink');
      if (logoutLink) {
        logoutLink.onclick = (e) => {
          e.preventDefault();
          logoutUser();
          location.reload();
        };
      }

      const profileLink = document.getElementById('profileLink');
      if (profileLink) {
        profileLink.href = this.isInValorant ? '../../profile.html' :
                          this.isInGames ? '../profile.html' : 
                          this.isInAdmin ? '../profile.html' :
                          this.isInPages ? 'profile.html' : 
                          'pages/profile.html';
      }

      const settingsLink = document.getElementById('settingsLink');
      if (settingsLink) {
        settingsLink.href = this.isInValorant ? '../../settings.html' : 
                           this.isInGames ? '../settings.html' : 
                           this.isInAdmin ? '../settings.html' : 
                           this.isInPages ? 'settings.html' : 
                           'pages/settings.html';
      }
    }
  }

  // Tách riêng phần cập nhật nội dung header
  updateHeaderContent() {
    const navControls = this.header.querySelector('.nav-controls');
    if (navControls) {
      navControls.innerHTML = this.isLoggedIn ? `
        <div class="user-menu">
          <span class="user-name">${this.userName}</span>
          <div class="user-dropdown">
            <a href="#" class="dropdown-item" id="profileLink">Profile</a>
            ${this.userRole === 'admin' ? `
              <a href="/public/pages/admin/admin.html" class="dropdown-item" id="adminLink">Admin</a>
            ` : ''}
            <a href="#" class="dropdown-item" id="logoutLink">Logout</a>
          </div>
        </div>
      ` : `
        <div class="auth-buttons">
          <a href="${this.isInValorant ? '../../login.html' :
                    this.isInGames ? '../login.html' : 
                    this.isInAdmin ? '../login.html' :
                    this.isInPages ? 'login.html' : 
                    'pages/login.html'}" class="auth-button login-button">Login</a>
        </div>
      `;
    }
  }

  highlightActiveLink() {
    const currentPath = window.location.pathname;
    const links = this.header.querySelectorAll('.nav-link');
    
    // Lấy tên file hiện tại từ path
    const currentPage = currentPath.split('/').pop() || 'index.html';
    
    links.forEach(link => {
        const linkHref = link.getAttribute('href');
        const linkPage = linkHref.split('/').pop();
        
        // Chỉ highlight link Games khi ở trang crosshair
        if (this.isInCrosshair) {
            if (linkPage === 'games.html') {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        } else {
            // Logic highlight bình thường cho các trang khác
            if (linkPage === currentPage || 
                (currentPage === '' && linkPage === 'index.html') ||
                (currentPath.endsWith('/') && linkPage === 'index.html')) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
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
    let scrollTimeout = null;

    const handleScroll = () => {
      const currentScroll = window.pageYOffset;
      const scrollingDown = currentScroll > lastScroll;
      const pastThreshold = currentScroll > scrollThreshold;
      const scrollDiff = Math.abs(currentScroll - lastScroll);

      console.log('[Scroll DEBUG]', {
        currentScroll,
        lastScroll,
        scrollingDown,
        pastThreshold,
        scrollDiff
      });

      if (scrollDiff > 5) {
        if (scrollingDown && pastThreshold) {
          console.log('🟥 Cuộn xuống → THÊM hidden');
          this.header?.classList.add('hidden');
          this.footer?.classList.add('hidden');
        } else {
          console.log('🟩 Cuộn lên → GỠ hidden');
          this.header?.classList.remove('hidden');
          this.footer?.classList.remove('hidden');
        }
        lastScroll = currentScroll;
      }
    };

    // Thêm debounce cho scroll event
    window.addEventListener('scroll', () => {
      if (scrollTimeout) {
        window.cancelAnimationFrame(scrollTimeout);
      }
      scrollTimeout = window.requestAnimationFrame(handleScroll);
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
  getRelativePath(targetPath) {
    // Helper function để tạo đường dẫn tương đối chính xác
    const currentDepth = this.currentPath.split('/').filter(Boolean).length;
    const targetDepth = targetPath.split('/').filter(Boolean).length;
    
    // Nếu đang ở admin, đi ra ngoài 2 cấp để về pages
    if (this.isInAdmin) {
      if (targetPath.startsWith('pages/')) {
        return '../' + targetPath;
      } else if (targetPath === 'index.html') {
        return '../../index.html';
      } else {
        return '../' + targetPath;
      }
    }
    
    // Logic cũ cho các trường hợp khác
    if (this.isInValorant) {
      return '../../' + targetPath;
    } else if (this.isInGames) {
      return '../' + targetPath;
    } else if (this.isInPages) {
      return targetPath;
    } else {
      return 'pages/' + targetPath;
    }
  }

  static create() {
    return new Components();
  }
}

// Create and export a singleton instance as default export
const components = new Components();
export default components;
// Tự động khởi tạo khi import module
components.init(); 