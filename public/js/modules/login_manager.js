import { loginUser } from "../supabase/auth.js";

export class LoginManager {
  constructor() {
    this.form = document.getElementById("loginForm");
    this.loginBtn = document.getElementById("loginBtn");
    this.loginBtnText = document.getElementById("loginBtnText");
    this.loginBtnSpinner = document.getElementById("loginBtnSpinner");
    this.usernameInput = document.getElementById("username");
    this.passwordInput = document.getElementById("password");
    this.passwordToggle = document.getElementById("passwordToggle");
    this.usernameError = document.getElementById("username-error");
    this.passwordError = document.getElementById("password-error");

    if (this.form && this.loginBtn && this.usernameInput && this.passwordInput) {
      this.init();
    } else {
      console.error("Không tìm thấy các elements cần thiết cho login form");
    }
  }

  init() {
    // Form submit handler
    this.form.addEventListener("submit", (e) => {
      e.preventDefault();
      this.handleLogin();
    });

    // Password toggle
    if (this.passwordToggle) {
      this.passwordToggle.addEventListener("click", () => this.togglePassword());
    }

    // Auto-focus next field
    this.usernameInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        this.passwordInput.focus();
      }
    });

    this.passwordInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        this.handleLogin();
      }
    });

    // Clear errors on input
    this.usernameInput.addEventListener("input", () => this.clearError("username"));
    this.passwordInput.addEventListener("input", () => this.clearError("password"));
  }

  togglePassword() {
    const type = this.passwordInput.getAttribute("type") === "password" ? "text" : "password";
    this.passwordInput.setAttribute("type", type);
    this.passwordToggle.textContent = type === "password" ? "👁️" : "🙈";
    this.passwordToggle.setAttribute("aria-label", type === "password" ? "Hiển thị mật khẩu" : "Ẩn mật khẩu");
  }

  showError(field, message) {
    const errorElement = field === "username" ? this.usernameError : this.passwordError;
    const inputElement = field === "username" ? this.usernameInput : this.passwordInput;
    
    if (errorElement) {
      errorElement.textContent = message;
      errorElement.setAttribute("role", "alert");
    }
    
    if (inputElement) {
      inputElement.classList.add("error");
      inputElement.classList.remove("success");
    }
  }

  clearError(field) {
    const errorElement = field === "username" ? this.usernameError : this.passwordError;
    const inputElement = field === "username" ? this.usernameInput : this.passwordInput;
    
    if (errorElement) {
      errorElement.textContent = "";
    }
    
    if (inputElement) {
      inputElement.classList.remove("error", "success");
    }
  }

  setLoading(isLoading) {
    if (this.loginBtn) {
      this.loginBtn.disabled = isLoading;
    }
    
    if (this.loginBtnText) {
      this.loginBtnText.textContent = isLoading ? "Đang đăng nhập..." : "Đăng nhập";
    }
    
    if (this.loginBtnSpinner) {
      this.loginBtnSpinner.style.display = isLoading ? "inline-block" : "none";
    }
  }

  async handleLogin() {
    // Clear previous errors
    this.clearError("username");
    this.clearError("password");

    const username = this.usernameInput.value.trim();
    const password = this.passwordInput.value;

    // Validation
    let hasError = false;

    if (!username) {
      this.showError("username", "Vui lòng nhập tên đăng nhập");
      hasError = true;
    }

    if (!password) {
      this.showError("password", "Vui lòng nhập mật khẩu");
      hasError = true;
    }

    if (hasError) {
      // Focus first error field
      if (!username) {
        this.usernameInput.focus();
      } else if (!password) {
        this.passwordInput.focus();
      }
      return;
    }

    // Set loading state
    this.setLoading(true);

    try {
      const { user, _session, profile } = await loginUser(username, password);
      const displayName = profile?.username || user?.user_metadata?.username || username;
      
      // Success - redirect immediately
      window.location.href = "../index.html";
      
    } catch (error) {
      console.error('Login error:', error);
      
      // Handle specific errors
      let errorMessage = "Đăng nhập thất bại. Vui lòng thử lại.";
      let errorField = "password"; // Default to password field
      
      if (error.message?.includes("Invalid login credentials")) {
        errorMessage = "Sai tên đăng nhập hoặc mật khẩu";
        errorField = "password";
      } else if (error.message?.includes("Email not confirmed")) {
        errorMessage = "Vui lòng xác thực email trước khi đăng nhập";
        errorField = "username";
      } else if (error.message?.includes("Too many requests")) {
        errorMessage = "Quá nhiều lần thử. Vui lòng đợi vài phút";
        errorField = "password";
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      // Show error without clearing password
      this.showError(errorField, errorMessage);
      
      // Focus on error field
      if (errorField === "username") {
        this.usernameInput.focus();
      } else {
        this.passwordInput.focus();
      }
      
    } finally {
      this.setLoading(false);
    }
  }
}
