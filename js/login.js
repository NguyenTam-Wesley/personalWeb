// js/login.js
import { loginUser } from "./auth.js";

export function initLogin() {
  const loginBtn = document.getElementById("loginBtn");
  const usernameInput = document.getElementById("username");
  const passwordInput = document.getElementById("password");

  loginBtn.addEventListener("click", async () => {
    const username = usernameInput.value;
    const password = passwordInput.value;

    try {
      const user = await loginUser(username, password);
      alert("Đăng nhập thành công, xin chào " + user.username);
      window.location.href = "/"; // hoặc chuyển hướng khác tùy logic
    } catch (error) {
      alert("Login failed: " + error.message);
    }
  });
}
