import { supabase } from "./supabase.js";

export function initSignup() {
  const signupBtn = document.getElementById("signupBtn");
  const usernameInput = document.getElementById("username");
  const passwordInput = document.getElementById("password");
  const confirmPasswordInput = document.getElementById("confirmPassword");

  signupBtn.addEventListener("click", async () => {
    const username = usernameInput.value;
    const password = passwordInput.value;
    const confirmPassword = confirmPasswordInput.value;

    if (password !== confirmPassword) {
      alert("Passwords do not match!");
      return;
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email: username,
        password: password,
      });

      if (error) throw error;

      alert("Sign up successful! Please check your email for verification.");
      window.location.href = "/pages/login.html";
    } catch (error) {
      alert("Sign up failed: " + error.message);
    }
  });
}
