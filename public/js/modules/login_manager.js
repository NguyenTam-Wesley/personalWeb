import { loginUser } from "../supabase/auth.js";

export class LoginManager {
  constructor() {
    this.loginBtn = document.getElementById("loginBtn");
    this.usernameInput = document.getElementById("username");
    this.passwordInput = document.getElementById("password");

    if (this.loginBtn && this.usernameInput && this.passwordInput) {
      this.init();
    } else {
      console.error("Không tìm thấy các elements cần thiết cho login form");
    }
  }

  init() {
    this.loginBtn.addEventListener("click", () => this.handleLogin());
  }

  async handleLogin() {
    try {
      if (!this.usernameInput || !this.passwordInput) {
        console.error('Login input fields not found');
        return;
      }

      const username = this.usernameInput.value.trim();
      const password = this.passwordInput.value;

      if (!username || !password) {
        alert("Vui lòng nhập đầy đủ username và password");
        return;
      }

      // Disable button during login
      let originalText = 'Login';
      if (this.loginBtn) {
        this.loginBtn.disabled = true;
        originalText = this.loginBtn.textContent;
        this.loginBtn.textContent = 'Đang đăng nhập...';
      }

      try {
        const user = await loginUser(username, password);
        alert("Đăng nhập thành công, xin chào " + user.username);
        window.location.href = "../index.html";
      } catch (error) {
        console.error('Login error:', error);
        alert("Đăng nhập thất bại: " + (error.message || "Đã xảy ra lỗi không mong muốn"));
      } finally {
        // Re-enable button
        if (this.loginBtn) {
          this.loginBtn.disabled = false;
          this.loginBtn.textContent = originalText;
        }
      }
    } catch (err) {
      console.error('Unexpected error in handleLogin:', err);
      alert("Đã xảy ra lỗi không mong muốn. Vui lòng thử lại sau.");
    }
  }
}

// Have to be exported for entry point