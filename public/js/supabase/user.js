// user.js

export class User {
  constructor(supabase, state, elements, showNotification, loadMainMenu) {
    this.supabase = supabase;
    this.state = state;
    this.elements = elements;
    this.showNotification = showNotification;
    this.loadMainMenu = loadMainMenu;
  }

  async checkLoginStatus() {
    try {
      // Kiểm tra session từ Supabase Auth
      const { data: { session }, error } = await this.supabase.auth.getSession();
      
      if (error || !session) {
        console.log("No active session");
        this.state.currentUser = null;
        this.state.currentUserRole = "guest";
        return false;
      }

      console.log("Active session found:", session.user.id);

      // 🔥 Sử dụng RPC để get/create profile
      const { data: user, error: userError } = await this.supabase
        .rpc('get_or_create_profile');

      if (userError) {
        console.error("RPC get_or_create_profile failed:", userError);
        this.state.currentUser = null;
        this.state.currentUserRole = "guest";
        return false;
      }

      // ✅ RPC đảm bảo luôn trả về profile
      if (!user) {
        console.error('❌ RPC returned null profile - unexpected');
        this.state.currentUser = null;
        this.state.currentUserRole = "guest";
        return false;
      }

      console.log("User found in database:", user);

      // Cập nhật thông tin user
      this.state.currentUser = {
        id: user.id,
        username: user.username,
        email: session.user.email,
        role: user.role
      };
      this.state.currentUserRole = user.role || "user";
      
      console.log("User data stored in state:", this.state.currentUser);
      return true;
    } catch (error) {
      console.error("Error in checkLoginStatus:", error);
      this.state.currentUser = null;
      this.state.currentUserRole = "guest";
      return false;
    }
  }

  async login(email, password) {
    try {
      console.log("Attempting login for email:", email);

      // Đăng nhập qua Supabase Auth
      const { data, error } = await this.supabase.auth.signInWithPassword({
        email: email,
        password: password
      });

      if (error) {
        console.error("Login error:", error);
        this.showNotification("Email hoặc mật khẩu không đúng", "error");
        return false;
      }

      console.log("Auth successful, user ID:", data.user.id);

      // 🔥 Sử dụng RPC để get/create profile
      const { data: user, error: userError } = await this.supabase
        .rpc('get_or_create_profile');

      if (userError) {
        console.error("RPC get_or_create_profile failed:", userError);
        this.showNotification("Lỗi khi tải thông tin người dùng", "error");
        return false;
      }

      // ✅ RPC đảm bảo luôn trả về profile
      if (!user) {
        console.error("❌ RPC returned null profile - unexpected");
        this.showNotification("Lỗi không mong muốn", "error");
        return false;
      }

      console.log("User found in database:", user);

      // Lưu thông tin user
      this.state.currentUser = {
        id: user.id,
        username: user.username,
        email: data.user.email,
        role: user.role
      };
      this.state.currentUserRole = user.role || "user";
      
      console.log("User data stored in state:", this.state.currentUser);
      
      this.showNotification("Đăng nhập thành công!", "success");
      return true;
    } catch (error) {
      console.error("Lỗi đăng nhập:", error);
      this.showNotification("Lỗi đăng nhập", "error");
      return false;
    }
  }

  async logout() {
    try {
      // Đăng xuất khỏi Supabase Auth
      const { error } = await this.supabase.auth.signOut();
      
      if (error) {
        console.error("Logout error:", error);
      }

      // Xóa toàn bộ thông tin user
      this.state.currentUser = null;
      this.state.currentUserRole = "guest";
      
      // Reset các state khác
      this.state.currentPlaylist = [];
      this.state.currentIndex = 0;
      this.state.navigationStack = [];
      
      // Xóa localStorage (nếu có dữ liệu khác cần xóa)
      localStorage.removeItem('navigationStack');
      
      // Xóa các element liên quan đến user
      if (this.elements.mainMenu) {
        this.elements.mainMenu.innerHTML = '';
      }
      if (this.elements.playlistContainer) {
        this.elements.playlistContainer.innerHTML = '';
      }
      
      this.showNotification("Đã đăng xuất", "info");
      this.loadMainMenu();
    } catch (error) {
      console.error("Error during logout:", error);
      // Vẫn reset state ngay cả khi có lỗi
      this.state.currentUser = null;
      this.state.currentUserRole = "guest";
      this.loadMainMenu();
    }
  }

  // Hàm đăng ký mới (nếu cần)
  async register(email, password, username) {
    try {
      console.log("Attempting registration for email:", email);

      // Tạo tài khoản qua Supabase Auth
      const { data, error } = await this.supabase.auth.signUp({
        email: email,
        password: password
      });

      if (error) {
        console.error("Registration error:", error);
        this.showNotification("Lỗi đăng ký: " + error.message, "error");
        return false;
      }

      // Tạo record trong bảng users
      const { error: insertError } = await this.supabase
        .from('users')
        .insert([
          {
            id: data.user.id, // Sử dụng UUID từ auth
            username: username,
            email: email,
            role: 'user'
          }
        ]);

      if (insertError) {
        console.error("Error creating user record:", insertError);
        this.showNotification("Lỗi tạo thông tin người dùng", "error");
        return false;
      }

      this.showNotification("Đăng ký thành công! Vui lòng kiểm tra email để xác nhận.", "success");
      return true;
    } catch (error) {
      console.error("Lỗi đăng ký:", error);
      this.showNotification("Lỗi đăng ký", "error");
      return false;
    }
  }

  // Lắng nghe thay đổi trạng thái auth
  setupAuthListener() {
    this.supabase.auth.onAuthStateChange((event, _session) => {
      console.log("Auth state changed:", event);
      
      if (event === 'SIGNED_IN') {
        this.checkLoginStatus();
      } else if (event === 'SIGNED_OUT') {
        this.state.currentUser = null;
        this.state.currentUserRole = "guest";
        this.loadMainMenu();
      }
    });
  }
}