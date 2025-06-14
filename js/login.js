// js/login.js
import { supabase } from "./supabase.js";

export function initLogin() {
  const loginBtn = document.getElementById("loginBtn");
  const usernameInput = document.getElementById("username");
  const passwordInput = document.getElementById("password");

  loginBtn.addEventListener("click", async () => {
    const username = usernameInput.value;
    const password = passwordInput.value;

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: username,
        password: password,
      });

      if (error) throw error;

      // Redirect to home page after successful login
      window.location.href = "/";
    } catch (error) {
      alert("Login failed: " + error.message);
    }
  });
}
