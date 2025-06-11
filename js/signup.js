import { registerUser, getCurrentUser } from "./auth.js";

document.addEventListener("DOMContentLoaded", async () => {
  // Nếu đã đăng nhập thì chuyển hướng luôn
  const user = await getCurrentUser();
  if (user) {
    window.location.href = "/index.html";
    return;
  }

  const btn = document.getElementById("signupBtn");
  if (!btn) {
    alert("Không tìm thấy nút đăng ký!");
    return;
  }

  btn.addEventListener("click", async () => {
    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value.trim();
    const confirm = document.getElementById("confirmPassword")?.value.trim();

    if (!username || !password || (confirm !== undefined && password !== confirm)) {
      alert("Thiếu thông tin hoặc mật khẩu không khớp!");
      return;
    }

    try {
      await registerUser(username, password);
      alert("Đăng ký thành công! Vui lòng đăng nhập.");
      window.location.href = "/pages/login.html";
    } catch (err) {
      alert("Lỗi đăng ký: " + err.message);
    }
  });
});
