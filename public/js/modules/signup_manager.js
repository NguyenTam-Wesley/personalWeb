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
      const username = this.usernameInput.value.trim();
      const password = this.passwordInput.value;
      const confirmPassword = this.confirmPasswordInput.value;

      if (!username || !password || !confirmPassword) {
        alert("Vui lòng nhập đầy đủ thông tin");
        return;
      }

      if (password !== confirmPassword) {
        alert("Mật khẩu không khớp!");
        return;
      }

      await registerUser(username, password);

      alert("Đăng ký thành công! Vui lòng đăng nhập để tiếp tục.");
      window.location.href = "../pages/login.html";
    } catch (error) {
      alert(error.message || "Đăng ký thất bại");
    }
  }
}
