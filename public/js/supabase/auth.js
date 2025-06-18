import { supabase } from "./supabase.js";

// Đăng ký người dùng mới
export async function registerUser(username, password) {
  const { data: existing, error: checkError } = await supabase
    .from("users")
    .select("id")
    .eq("username", username);

  if (checkError) throw checkError;
  if (existing.length > 0) throw new Error("Username đã tồn tại.");

  const { data, error } = await supabase
    .from("users")
    .insert([{ username, password }]);

  if (error) throw error;
  return data;
}

// Đăng nhập
export async function loginUser(username, password) {
  const { data, error } = await supabase
    .from("users")
    .select("id, username, role, login_count")
    .eq("username", username)
    .eq("password", password)
    .single();

  if (error || !data) throw new Error("Sai thông tin đăng nhập");

  // Tăng login_count
  try {
    const currentLoginCount = data.login_count || 0;
    const { error: updateError } = await supabase
      .from("users")
      .update({ login_count: currentLoginCount + 1 })
      .eq("id", data.id);
    
    if (updateError) {
      console.warn("Không thể cập nhật login_count:", updateError);
    }
  } catch (updateError) {
    console.warn("Không thể cập nhật login_count:", updateError);
  }

  localStorage.setItem("userId", data.id);
  return data;
}

// Đăng xuất
export function logoutUser() {
  localStorage.removeItem("userId");
}

// Lấy user hiện tại
export async function getCurrentUser() {
  const userId = localStorage.getItem("userId");
  if (!userId) return null;

  const { data, error } = await supabase
    .from("users")
    .select("id, username, role, email, full_name, bio, login_count, created_at, updated_at")
    .eq("id", userId)
    .single();

  if (error || !data) return null;
  return data;
}
