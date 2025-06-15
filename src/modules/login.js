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
    this.loginBtn.addEventListener("click", async () => {
      const username = this.usernameInput.value;
      const password = this.passwordInput.value;

      if (!username || !password) {
        alert("Vui lòng nhập đầy đủ username và password");
        return;
      }

      try {
        const user = await loginUser(username, password);
        alert("Đăng nhập thành công, xin chào " + user.username);
        window.location.href = "../index.html";
      } catch (error) {
        alert("Đăng nhập thất bại: " + error.message);
      }
    });
  }
}
