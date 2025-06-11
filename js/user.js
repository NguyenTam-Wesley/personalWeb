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
    const userId = localStorage.getItem('userId');
    console.log("Checking login status for userId:", userId);
    
    if (!userId) {
      this.state.currentUser = null;
      this.state.currentUserRole = "guest";
      return false;
    }

    try {
      const { data: user, error } = await this.supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error || !user) {
        console.error("Error checking user status:", error);
        this.logout();
        return false;
      }

      console.log("User found in database:", user);

      // Cập nhật thông tin user
      this.state.currentUser = {
        id: user.id,
        username: user.username,
        role: user.role
      };
      this.state.currentUserRole = user.role || "user";
      
      console.log("User data stored in state:", this.state.currentUser);
      return true;
    } catch (error) {
      console.error("Error in checkLoginStatus:", error);
      this.logout();
      return false;
    }
  }

  async login(username, password) {
    try {
      // Xóa thông tin user cũ trước khi đăng nhập
      this.state.currentUser = null;
      this.state.currentUserRole = "guest";
      localStorage.removeItem('userId');
      
      console.log("Attempting login for username:", username);
      
      // Tìm user trong bảng users
      const { data: user, error } = await this.supabase
        .from('users')
        .select('*')
        .eq('username', username)
        .eq('password', password)
        .single();

      if (error) {
        console.error("Lỗi khi tìm user:", error);
        throw error;
      }

      if (!user) {
        this.showNotification("Tên đăng nhập hoặc mật khẩu không đúng", "error");
        return false;
      }

      console.log("User found in database:", user);

      // Lưu thông tin user với UUID chính xác
      this.state.currentUser = {
        id: user.id, // uuid từ bảng users
        username: user.username,
        role: user.role
      };
      this.state.currentUserRole = user.role || "user";
      
      // Lưu userId vào localStorage
      localStorage.setItem('userId', user.id);
      
      console.log("User data stored in state:", this.state.currentUser);
      console.log("User ID stored in localStorage:", localStorage.getItem('userId'));
      
      this.showNotification("Đăng nhập thành công!", "success");
      return true;
    } catch (error) {
      console.error("Lỗi đăng nhập:", error);
      this.showNotification("Lỗi đăng nhập", "error");
      return false;
    }
  }

  logout() {
    // Xóa toàn bộ thông tin user
    this.state.currentUser = null;
    this.state.currentUserRole = "guest";
    
    // Xóa toàn bộ dữ liệu liên quan đến user trong localStorage
    localStorage.removeItem('userId');
    localStorage.removeItem('navigationStack');
    
    // Reset các state khác
    this.state.currentPlaylist = [];
    this.state.currentIndex = 0;
    this.state.navigationStack = [];
    
    // Xóa các element liên quan đến user
    if (this.elements.mainMenu) {
      this.elements.mainMenu.innerHTML = '';
    }
    if (this.elements.playlistContainer) {
      this.elements.playlistContainer.innerHTML = '';
    }
    
    this.showNotification("Đã đăng xuất", "info");
    this.loadMainMenu();
  }
} 