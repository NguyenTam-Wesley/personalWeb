import { supabase } from "./supabase.js";

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
    .select("id, username, role")
    .eq("username", username)
    .eq("password", password) // So sánh password thuần, khuyên nên mã hóa sau
    .single();

  if (error || !data) throw new Error("Sai thông tin đăng nhập");

  // Lưu userId vào localStorage
  localStorage.setItem("userId", data.id);
  return data;
}

export function logoutUser() {
  localStorage.removeItem("userId");
}

// Lấy user hiện tại (trả về Promise)
export async function getCurrentUser() {
  const userId = localStorage.getItem("userId");
  if (!userId) return null;
  const { data, error } = await supabase
    .from("users")
    .select("id, username, role")
    .eq("id", userId)
    .single();
  if (error || !data) return null;
  return data;
}
