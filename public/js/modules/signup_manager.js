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

      // Validation
      if (!username || !password || !confirmPassword) {
        alert("Vui lòng nhập đầy đủ thông tin");
        return;
      }

      if (username.length < 3) {
        alert("Username phải có ít nhất 3 ký tự");
        return;
      }

      // Kiểm tra username chỉ chứa chữ cái, số và dấu gạch dưới
      const usernameRegex = /^[a-zA-Z0-9_]+$/;
      if (!usernameRegex.test(username)) {
        alert("Username chỉ được chứa chữ cái, số và dấu gạch dưới");
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
        // Gọi hàm registerUser với username và password
        const result = await registerUser(username, password);

        if (result?.user) {
          console.log('🎉 Registration completed with profile:', result.profile);
          alert("Đăng ký thành công! Profile đã được tạo. Vui lòng đăng nhập để tiếp tục.");
          window.location.href = "../pages/login.html";
        }

      } catch (error) {
        console.error('Signup error:', error);
        
        // Xử lý các loại lỗi cụ thể
        let errorMessage = "Đăng ký thất bại. Vui lòng thử lại.";
        
        if (error.message?.includes("User already registered")) {
          errorMessage = "Username này đã được đăng ký. Vui lòng chọn username khác.";
        } else if (error.message?.includes("Password should be at least 6 characters")) {
          errorMessage = "Mật khẩu phải có ít nhất 6 ký tự.";
        } else if (error.message?.includes("Unable to validate email address")) {
          errorMessage = "Lỗi xác thực. Vui lòng thử lại.";
        } else if (error.message) {
          errorMessage = error.message;
        }
        
        alert(errorMessage);
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