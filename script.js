import { getCurrentUser, logoutUser } from './js/auth.js';

// Hàm cập nhật nút login/logout
function updateLoginStatus() {
  const loginLink = document.getElementById("loginLink");
  const greeting = document.getElementById("greeting");
  const user = getCurrentUser();

  if (user) {
    greeting.textContent = `Xin chào, ${user.username}`;
    loginLink.textContent = "Logout";
    loginLink.href = "#";
    loginLink.addEventListener("click", (e) => {
      e.preventDefault();
      logoutUser();
      location.reload();
    });
  } else {
    greeting.textContent = "";
    loginLink.textContent = "Login";
    loginLink.href = "/pages/login.html";
    loginLink.removeEventListener("click", () => {}); // Xóa event logout
  }
}


updateLoginStatus();
