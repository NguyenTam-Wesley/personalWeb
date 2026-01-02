import { getCurrentUserWithRetry, logoutUser, logUserStatus } from './js/supabase/auth.js';

// Hàm cập nhật nút login/logout
async function updateLoginStatus() {
  const loginLink = document.getElementById("loginLink");
  const greeting = document.getElementById("greeting");

  try {
    // ✅ Sử dụng retry logic để chờ profile được tạo
    const user = await getCurrentUserWithRetry();

    if (user && user.profile) {
      // Profile đã sẵn sàng
      logUserStatus(user, '[Script]');
      greeting.textContent = `Xin chào, ${user.profile.username}`;
      loginLink.textContent = "Logout";
      loginLink.href = "#";
      loginLink.onclick = (e) => {
        e.preventDefault();
        logoutUser();
        location.reload();
      };
    } else if (user && user.user) {
      // Có user nhưng profile đang được tạo
      greeting.textContent = "Đang tải thông tin...";
      loginLink.textContent = "Logout";
      loginLink.href = "#";
      loginLink.onclick = (e) => {
        e.preventDefault();
        logoutUser();
        location.reload();
      };
    } else {
      // Chưa đăng nhập
      greeting.textContent = "";
      loginLink.textContent = "Login";
      loginLink.href = "/pages/login.html";
      loginLink.onclick = null;
    }
  } catch (error) {
    console.error('❌ Lỗi tải thông tin user:', error);
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
