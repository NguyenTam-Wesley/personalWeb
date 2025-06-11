// js/login.js
import { loginUser, getCurrentUser } from "./auth.js";

document.addEventListener("DOMContentLoaded", () => {
  // Nếu đã đăng nhập thì chuyển hướng luôn
  if (getCurrentUser()) {
    window.location.href = "/index.html";
    return;
  }

  const btn = document.getElementById("loginBtn");
  if (!btn) {
    alert("Không tìm thấy nút login!");
    return;
  }

  btn.addEventListener("click", async () => {
    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value.trim();

    if (!username || !password) {
      alert("Thiếu thông tin đăng nhập!");
      return;
    }

    try {
      await loginUser(username, password);
      alert("Đăng nhập thành công!");
      window.location.href = "/index.html";
    } catch (err) {
      alert("Lỗi đăng nhập: " + err.message);
    }
  });
});
