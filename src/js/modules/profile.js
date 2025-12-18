import { supabase } from '../supabase/supabase.js';
import { getCurrentUser, logoutUser } from '../supabase/auth.js';
import components from '../components/components.js';
export class ProfileManager {
  constructor() {
    this.currentUser = null;
    this.init();
  }

  async init() {
    // Kiểm tra đăng nhập
    const user = await getCurrentUser();
    if (!user) {
      this.redirectToLogin();
      return;
    }

    this.currentUser = user;
    this.loadUserProfile();
    this.setupEventListeners();
  }

  async loadUserProfile() {
    try {
      // Lấy thông tin chi tiết của user từ database
      const { data: userData, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', this.currentUser.id)
        .single();

      if (error) {
        console.error('Error loading user profile:', error);
        this.showMessage('Lỗi khi tải thông tin profile', 'error');
        return;
      }

      // Điền thông tin vào form
      this.fillProfileForm(userData);
      this.updateStats(userData);

    } catch (error) {
      console.error('Error in loadUserProfile:', error);
      this.showMessage('Lỗi khi tải thông tin profile', 'error');
    }
  }

  fillProfileForm(userData) {
    const usernameInput = document.getElementById('username');
    const emailInput = document.getElementById('email');
    const fullNameInput = document.getElementById('fullName');
    const bioInput = document.getElementById('bio');

    if (usernameInput) usernameInput.value = userData.username || '';
    if (emailInput) emailInput.value = userData.email || '';
    if (fullNameInput) fullNameInput.value = userData.full_name || '';
    if (bioInput) bioInput.value = userData.bio || '';

    // Cập nhật page title với username
    this.updatePageTitle(userData.username);
  }

  updatePageTitle(username) {
    if (username) {
      document.title = `Profile - ${username}`;
    } else {
      document.title = 'Profile - NTAM';
    }
  }

  updateStats(userData) {
    const loginCountElement = document.getElementById('loginCount');
    const joinDateElement = document.getElementById('joinDate');
    const userRoleElement = document.getElementById('userRole');

    if (loginCountElement) {
      loginCountElement.textContent = userData.login_count || 0;
    }

    if (joinDateElement) {
      const joinDate = userData.created_at ? new Date(userData.created_at) : new Date();
      joinDateElement.textContent = joinDate.toLocaleDateString('vi-VN');
    }

    if (userRoleElement) {
      userRoleElement.textContent = userData.role || 'User';
    }
  }

  setupEventListeners() {
    const saveProfileBtn = document.getElementById('saveProfileBtn');
    const changePasswordBtn = document.getElementById('changePasswordBtn');

    if (saveProfileBtn) {
      saveProfileBtn.addEventListener('click', () => this.saveProfile());
    }

    if (changePasswordBtn) {
      changePasswordBtn.addEventListener('click', () => this.changePassword());
    }
  }

  async saveProfile() {
    const saveBtn = document.getElementById('saveProfileBtn');
    const originalText = saveBtn.textContent;
    
    try {
      // Hiển thị trạng thái loading
      saveBtn.textContent = 'Đang lưu...';
      saveBtn.disabled = true;

      const email = document.getElementById('email').value;
      const fullName = document.getElementById('fullName').value;
      const bio = document.getElementById('bio').value;

      // Validate email
      if (email && !this.isValidEmail(email)) {
        this.showMessage('Email không hợp lệ', 'error');
        return;
      }

      // Cập nhật thông tin user
      const { error } = await supabase
        .from('users')
        .update({
          email: email || null,
          full_name: fullName || null,
          bio: bio || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', this.currentUser.id);

      if (error) {
        console.error('Error updating profile:', error);
        this.showMessage('Lỗi khi cập nhật thông tin', 'error');
        return;
      }

      this.showMessage('Cập nhật thông tin thành công!', 'success');

    } catch (error) {
      console.error('Error in saveProfile:', error);
      this.showMessage('Lỗi khi cập nhật thông tin', 'error');
    } finally {
      // Khôi phục trạng thái button
      saveBtn.textContent = originalText;
      saveBtn.disabled = false;
    }
  }

  async changePassword() {
    const changeBtn = document.getElementById('changePasswordBtn');
    const originalText = changeBtn.textContent;
    
    try {
      // Hiển thị trạng thái loading
      changeBtn.textContent = 'Đang đổi...';
      changeBtn.disabled = true;

      const currentPassword = document.getElementById('currentPassword').value;
      const newPassword = document.getElementById('newPassword').value;
      const confirmPassword = document.getElementById('confirmPassword').value;

      // Validate input
      if (!currentPassword || !newPassword || !confirmPassword) {
        this.showMessage('Vui lòng điền đầy đủ thông tin', 'error');
        return;
      }

      if (newPassword !== confirmPassword) {
        this.showMessage('Mật khẩu mới không khớp', 'error');
        return;
      }

      if (newPassword.length < 6) {
        this.showMessage('Mật khẩu mới phải có ít nhất 6 ký tự', 'error');
        return;
      }

      // Kiểm tra mật khẩu hiện tại
      const { data: currentUser, error: checkError } = await supabase
        .from('users')
        .select('password')
        .eq('id', this.currentUser.id)
        .eq('password', currentPassword)
        .single();

      if (checkError || !currentUser) {
        this.showMessage('Mật khẩu hiện tại không đúng', 'error');
        return;
      }

      // Cập nhật mật khẩu mới
      const { error } = await supabase
        .from('users')
        .update({
          password: newPassword,
          updated_at: new Date().toISOString()
        })
        .eq('id', this.currentUser.id);

      if (error) {
        console.error('Error changing password:', error);
        this.showMessage('Lỗi khi đổi mật khẩu', 'error');
        return;
      }

      this.showMessage('Đổi mật khẩu thành công!', 'success');
      
      // Xóa các trường password
      document.getElementById('currentPassword').value = '';
      document.getElementById('newPassword').value = '';
      document.getElementById('confirmPassword').value = '';

    } catch (error) {
      console.error('Error in changePassword:', error);
      this.showMessage('Lỗi khi đổi mật khẩu', 'error');
    } finally {
      // Khôi phục trạng thái button
      changeBtn.textContent = originalText;
      changeBtn.disabled = false;
    }
  }

  showMessage(message, type = 'info') {
    // Tạo element message nếu chưa có
    let messageElement = document.querySelector('.message');
    if (!messageElement) {
      messageElement = document.createElement('div');
      messageElement.className = 'message';
      document.querySelector('.profile-container').insertBefore(
        messageElement, 
        document.querySelector('.profile-content')
      );
    }

    // Cập nhật nội dung và style
    messageElement.textContent = message;
    messageElement.className = `message ${type} show`;

    // Tự động ẩn sau 5 giây
    setTimeout(() => {
      messageElement.classList.remove('show');
    }, 5000);
  }

  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  redirectToLogin() {
    // Chuyển hướng về trang login
    const currentPath = window.location.pathname;
    const isInPages = currentPath.includes('/pages/');
    const loginPath = isInPages ? 'login.html' : 'pages/login.html';
    
    window.location.href = loginPath;
  }
} 
components.init();
new ProfileManager();