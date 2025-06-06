// js/login.js
import { loginUser } from "../js/auth.js";

document.addEventListener("DOMContentLoaded", () => {
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
      const user = await loginUser(username, password);
      alert(`Đăng nhập thành công: ${user.username}`);
      window.location.href = "/index.html"; // hoặc route chính
    } catch (err) {
      alert("Lỗi đăng nhập: " + err.message);
    }
  });
});
