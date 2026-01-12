import { registerUser } from "../supabase/auth.js";

export class SignupManager {
  constructor() {
    this.form = document.getElementById("signupForm");
    this.signupBtn = document.getElementById("signupBtn");
    this.signupBtnText = document.getElementById("signupBtnText");
    this.signupBtnSpinner = document.getElementById("signupBtnSpinner");
    this.usernameInput = document.getElementById("username");
    this.passwordInput = document.getElementById("password");
    this.confirmPasswordInput = document.getElementById("confirmPassword");
    this.passwordToggle = document.getElementById("passwordToggle");
    this.confirmPasswordToggle = document.getElementById("confirmPasswordToggle");
    this.usernameError = document.getElementById("username-error");
    this.passwordError = document.getElementById("password-error");
    this.confirmPasswordError = document.getElementById("confirmPassword-error");
    this.passwordRules = document.getElementById("passwordRules");
    this.ruleLength = document.getElementById("rule-length");

    if (
      this.form &&
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
    // Form submit handler
    this.form.addEventListener("submit", (e) => {
      e.preventDefault();
      this.handleSignup();
    });

    // Password toggles
    if (this.passwordToggle) {
      this.passwordToggle.addEventListener("click", () => this.togglePassword("password"));
    }
    if (this.confirmPasswordToggle) {
      this.confirmPasswordToggle.addEventListener("click", () => this.togglePassword("confirmPassword"));
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
        this.confirmPasswordInput.focus();
      }
    });

    this.confirmPasswordInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        this.handleSignup();
      }
    });

    // Realtime validation
    this.usernameInput.addEventListener("input", () => {
      this.clearError("username");
      this.validateUsername();
    });

    this.passwordInput.addEventListener("input", () => {
      this.clearError("password");
      this.validatePasswordRealtime();
      this.validateConfirmPassword();
    });

    this.confirmPasswordInput.addEventListener("input", () => {
      this.clearError("confirmPassword");
      this.validateConfirmPassword();
    });
  }

  togglePassword(field) {
    const input = field === "password" ? this.passwordInput : this.confirmPasswordInput;
    const toggle = field === "password" ? this.passwordToggle : this.confirmPasswordToggle;
    
    const type = input.getAttribute("type") === "password" ? "text" : "password";
    input.setAttribute("type", type);
    
    if (toggle) {
      toggle.textContent = type === "password" ? "👁️" : "🙈";
      toggle.setAttribute("aria-label", type === "password" ? "Hiển thị mật khẩu" : "Ẩn mật khẩu");
    }
  }

  validateUsername() {
    const username = this.usernameInput.value.trim();
    
    if (username.length > 0 && username.length < 3) {
      this.showError("username", "Tên đăng nhập phải có ít nhất 3 ký tự");
      return false;
    }
    
    const usernameRegex = /^[a-zA-Z0-9_]+$/;
    if (username.length > 0 && !usernameRegex.test(username)) {
      this.showError("username", "Chỉ được chứa chữ cái, số và dấu gạch dưới");
      return false;
    }
    
    return true;
  }

  validatePasswordRealtime() {
    const password = this.passwordInput.value;
    const isValid = password.length >= 6;
    
    // Update password rule indicator
    if (this.ruleLength) {
      if (password.length > 0) {
        if (isValid) {
          this.ruleLength.classList.add("valid");
          this.ruleLength.classList.remove("invalid");
          this.ruleLength.querySelector(".password-rule-icon").textContent = "✓";
        } else {
          this.ruleLength.classList.add("invalid");
          this.ruleLength.classList.remove("valid");
          this.ruleLength.querySelector(".password-rule-icon").textContent = "○";
        }
      } else {
        this.ruleLength.classList.remove("valid", "invalid");
        this.ruleLength.querySelector(".password-rule-icon").textContent = "○";
      }
    }
    
    // Update input state
    if (password.length > 0) {
      if (isValid) {
        this.passwordInput.classList.add("success");
        this.passwordInput.classList.remove("error");
      } else {
        this.passwordInput.classList.add("error");
        this.passwordInput.classList.remove("success");
      }
    } else {
      this.passwordInput.classList.remove("error", "success");
    }
    
    return isValid;
  }

  validateConfirmPassword() {
    const password = this.passwordInput.value;
    const confirmPassword = this.confirmPasswordInput.value;
    
    if (confirmPassword.length === 0) {
      this.confirmPasswordInput.classList.remove("error", "success");
      return true;
    }
    
    const isValid = password === confirmPassword;
    
    if (isValid) {
      this.confirmPasswordInput.classList.add("success");
      this.confirmPasswordInput.classList.remove("error");
    } else {
      this.confirmPasswordInput.classList.add("error");
      this.confirmPasswordInput.classList.remove("success");
    }
    
    return isValid;
  }

  showError(field, message) {
    let errorElement, inputElement;
    
    switch (field) {
      case "username":
        errorElement = this.usernameError;
        inputElement = this.usernameInput;
        break;
      case "password":
        errorElement = this.passwordError;
        inputElement = this.passwordInput;
        break;
      case "confirmPassword":
        errorElement = this.confirmPasswordError;
        inputElement = this.confirmPasswordInput;
        break;
    }
    
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
    let errorElement, inputElement;
    
    switch (field) {
      case "username":
        errorElement = this.usernameError;
        inputElement = this.usernameInput;
        break;
      case "password":
        errorElement = this.passwordError;
        inputElement = this.passwordInput;
        break;
      case "confirmPassword":
        errorElement = this.confirmPasswordError;
        inputElement = this.confirmPasswordInput;
        break;
    }
    
    if (errorElement) {
      errorElement.textContent = "";
    }
    
    if (inputElement && field !== "password" && field !== "confirmPassword") {
      inputElement.classList.remove("error", "success");
    }
  }

  setLoading(isLoading) {
    if (this.signupBtn) {
      this.signupBtn.disabled = isLoading;
    }
    
    if (this.signupBtnText) {
      this.signupBtnText.textContent = isLoading ? "Đang tạo tài khoản..." : "Tạo tài khoản";
    }
    
    if (this.signupBtnSpinner) {
      this.signupBtnSpinner.style.display = isLoading ? "inline-block" : "none";
    }
  }

  async handleSignup() {
    // Clear previous errors
    this.clearError("username");
    this.clearError("password");
    this.clearError("confirmPassword");

    const username = this.usernameInput.value.trim();
    const password = this.passwordInput.value;
    const confirmPassword = this.confirmPasswordInput.value;

    // Validation
    let hasError = false;

    if (!username) {
      this.showError("username", "Vui lòng nhập tên đăng nhập");
      hasError = true;
    } else if (!this.validateUsername()) {
      hasError = true;
    }

    if (!password) {
      this.showError("password", "Vui lòng nhập mật khẩu");
      hasError = true;
    } else if (password.length < 6) {
      this.showError("password", "Mật khẩu phải có ít nhất 6 ký tự");
      hasError = true;
    }

    if (!confirmPassword) {
      this.showError("confirmPassword", "Vui lòng xác nhận mật khẩu");
      hasError = true;
    } else if (password !== confirmPassword) {
      this.showError("confirmPassword", "Mật khẩu không khớp");
      hasError = true;
    }

    if (hasError) {
      // Focus first error field
      if (!username || !this.validateUsername()) {
        this.usernameInput.focus();
      } else if (!password || password.length < 6) {
        this.passwordInput.focus();
      } else {
        this.confirmPasswordInput.focus();
      }
      return;
    }

    // Set loading state
    this.setLoading(true);

    try {
      const result = await registerUser(username, password);

      if (result?.user) {
        console.log('🎉 Registration completed with profile:', result.profile);
        // Success - redirect immediately
        window.location.href = "login.html";
      }

    } catch (error) {
      console.error('Signup error:', error);
      
      // Handle specific errors
      let errorMessage = "Đăng ký thất bại. Vui lòng thử lại.";
      let errorField = "username";
      
      if (error.message?.includes("User already registered") || 
          error.message?.includes("already registered") ||
          error.message?.includes("already exists")) {
        errorMessage = "Tên đăng nhập này đã được sử dụng";
        errorField = "username";
      } else if (error.message?.includes("Password should be at least 6 characters")) {
        errorMessage = "Mật khẩu phải có ít nhất 6 ký tự";
        errorField = "password";
      } else if (error.message?.includes("Unable to validate email address")) {
        errorMessage = "Lỗi xác thực. Vui lòng thử lại";
        errorField = "username";
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      // Show error without clearing passwords
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
