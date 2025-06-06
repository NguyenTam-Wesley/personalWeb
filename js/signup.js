import { registerUser } from "../js/auth.js";

document.getElementById("signupBtn").addEventListener("click", async () => {
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value.trim();

  if (!username || !password) {
    alert("Vui lòng nhập đầy đủ username và password.");
    return;
  }

  try {
    await registerUser(username, password);
    alert("Đăng ký thành công! Chuyển đến trang login.");
    window.location.href = "/pages/login.html";
  } catch (error) {
    alert("Lỗi đăng ký: " + error.message);
  }
});
