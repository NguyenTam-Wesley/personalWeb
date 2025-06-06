import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const supabaseUrl = "https://calwzopyjitbtahiafzw.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNhbHd6b3B5aml0YnRhaGlhZnp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkxNjgyOTAsImV4cCI6MjA2NDc0NDI5MH0.lFDePS6m0MpNXDcC43dJaqa1pHtCKHNRKoiDbnxTBBc";

export const supabase = createClient(supabaseUrl, supabaseKey);

// Đăng ký user mới
export async function registerUser(username, password) {
  // Kiểm tra username đã tồn tại chưa
  const { data: existing, error: checkError } = await supabase
    .from("users")
    .select("username")
    .eq("username", username);

  if (checkError) throw checkError;
  if (existing.length > 0) throw new Error("Username đã tồn tại");

  const { data, error } = await supabase.from("users").insert([
    { username, password } // Có thể mã hóa password ở đây nếu muốn
  ]);

  if (error) throw error;
  return data;
}

// Đăng nhập user
export async function loginUser(username, password) {
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("username", username)
    .eq("password", password) // So sánh password thuần, khuyên nên mã hóa sau
    .single();

  if (error || !data) throw new Error("Sai thông tin đăng nhập");

  // Lưu trạng thái đăng nhập vào localStorage
  localStorage.setItem("loggedInUser", JSON.stringify(data));
  return data;
}

export function logoutUser() {
  localStorage.removeItem("loggedInUser");
}

export function getCurrentUser() {
  const user = localStorage.getItem("loggedInUser");
  return user ? JSON.parse(user) : null;
}
