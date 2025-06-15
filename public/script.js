import { getCurrentUser, logoutUser } from '../src/supabase/auth.js';

// Hàm cập nhật nút login/logout
async function updateLoginStatus() {
  const loginLink = document.getElementById("loginLink");
  const greeting = document.getElementById("greeting");
  const user = await getCurrentUser();

  if (user) {
    greeting.textContent = `Xin chào, ${user.username}`;
    loginLink.textContent = "Logout";
    loginLink.href = "#";
    loginLink.onclick = (e) => {
      e.preventDefault();
      logoutUser();
      location.reload();
    };
  } else {
    greeting.textContent = "";
    loginLink.textContent = "Login";
    loginLink.href = "/pages/login.html";
    loginLink.onclick = null;
  }
}

// Đảm bảo gọi sau khi DOM đã sẵn sàng
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', updateLoginStatus);
} else {
  updateLoginStatus();
}
