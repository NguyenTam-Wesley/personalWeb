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
    
    // ✅ Thêm: Cho phép Enter để login
    this.passwordInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        this.handleLogin();
      }
    });
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
        // ✅ Nhận object {user, session, profile} từ loginUser
        const { user, _session, profile } = await loginUser(username, password);

        // ✅ Hiển thị username từ profile (hoặc fallback sang metadata)
        // Profile có thể chưa được tạo ngay lập tức, nhưng user đã có
        const displayName = profile?.username || user?.user_metadata?.username || username;
        
        alert(`Đăng nhập thành công! Xin chào ${displayName}`);
        
        // Redirect về trang chủ
        window.location.href = "../index.html";
        
      } catch (error) {
        console.error('Login error:', error);
        
        // ✅ Xử lý các loại lỗi cụ thể
        let errorMessage = "Đăng nhập thất bại. Vui lòng thử lại.";
        
        if (error.message?.includes("Invalid login credentials")) {
          errorMessage = "Sai username hoặc password!";
        } else if (error.message?.includes("Email not confirmed")) {
          errorMessage = "Vui lòng xác thực email trước khi đăng nhập.";
        } else if (error.message?.includes("Too many requests")) {
          errorMessage = "Quá nhiều lần thử. Vui lòng đợi vài phút.";
        } else if (error.message) {
          errorMessage = error.message;
        }
        
        alert(errorMessage);
        
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