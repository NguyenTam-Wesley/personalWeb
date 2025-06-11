import { getCurrentUser, logoutUser } from './auth.js';

export class Header {
  constructor() {
    this.header = document.createElement('header');
    this.setupHeader();
  }

  setupHeader() {
    this.header.innerHTML = `
      <div class="nav-wrapper">
        <nav>
          <ul>
            <li><a href="/">Home</a></li>
            <li><a href="/pages/music.html">Music</a></li>
            <li><a href="/pages/study.html">Study</a></li>
          </ul>
        </nav>
        <div id="greeting"></div>
        <div class="login-btn">
          <a href="/pages/login.html" id="loginLink">Login</a>
        </div>
      </div>
    `;

    // Thêm header vào đầu body
    document.body.insertBefore(this.header, document.body.firstChild);
    
    // Cập nhật trạng thái login
    this.updateLoginStatus();
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

  // Highlight active link dựa trên current path
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
}

// Đảm bảo DOM đã load xong trước khi khởi tạo header
document.addEventListener('DOMContentLoaded', () => {
  const header = new Header();
  header.highlightActiveLink();
}); 