import { registerUser } from "../supabase/auth.js";

export class SignupManager {
  constructor() {
    this.signupBtn = document.getElementById("signupBtn");
    this.usernameInput = document.getElementById("username");
    this.passwordInput = document.getElementById("password");
    this.confirmPasswordInput = document.getElementById("confirmPassword");

    if (
      this.signupBtn &&
      this.usernameInput &&
      this.passwordInput &&
      this.confirmPasswordInput
    ) {
      this.init();
    } else {
      console.error("Không tìm thấy các elements cần thiết cho signup form");
    }
  }

  init() {
    this.signupBtn.addEventListener("click", () => this.handleSignup());
  }

  async handleSignup() {
    try {
      if (!this.usernameInput || !this.passwordInput || !this.confirmPasswordInput) {
        console.error('Signup input fields not found');
        return;
      }

      const username = this.usernameInput.value.trim();
      const password = this.passwordInput.value;
      const confirmPassword = this.confirmPasswordInput.value;

      if (!username || !password || !confirmPassword) {
        alert("Vui lòng nhập đầy đủ thông tin");
        return;
      }

      if (username.length < 3) {
        alert("Username phải có ít nhất 3 ký tự");
        return;
      }

      if (password.length < 6) {
        alert("Mật khẩu phải có ít nhất 6 ký tự");
        return;
      }

      if (password !== confirmPassword) {
        alert("Mật khẩu không khớp!");
        return;
      }

      // Disable button during signup
      let originalText = 'Sign Up';
      if (this.signupBtn) {
        this.signupBtn.disabled = true;
        originalText = this.signupBtn.textContent;
        this.signupBtn.textContent = 'Đang đăng ký...';
      }

      try {
        await registerUser(username, password);
        alert("Đăng ký thành công! Vui lòng đăng nhập để tiếp tục.");
        window.location.href = "../pages/login.html";
      } catch (error) {
        console.error('Signup error:', error);
        alert(error.message || "Đăng ký thất bại. Vui lòng thử lại.");
      } finally {
        // Re-enable button
        if (this.signupBtn) {
          this.signupBtn.disabled = false;
          this.signupBtn.textContent = originalText;
        }
      }
    } catch (err) {
      console.error('Unexpected error in handleSignup:', err);
      alert("Đã xảy ra lỗi không mong muốn. Vui lòng thử lại sau.");
    }
  }
}

// Have to be exported for entry point