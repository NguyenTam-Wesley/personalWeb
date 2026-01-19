import { supabase } from '../supabase/supabase.js';
import { getCurrentUserWithRetry } from '../supabase/auth.js';
import { userProfile } from './user_profile.js';

export class ProfileManager {
  constructor() {
    this.currentUser = null;
    this.init();
  }

  /* ================= INIT ================= */

  async init() {
    const user = await getCurrentUserWithRetry();

    if (!user) {
      this.redirectToLogin();
      return;
    }

    this.currentUser = user;
    await this.loadUserProfile();
    this.setupEventListeners();
  }

  /* ================= LOAD PROFILE ================= */

  async loadUserProfile() {
    try {
      // Load from user_profiles table (has XP, level, coins)
      const { data: userData, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', this.currentUser.user.id)
        .single();

      if (error) {
        console.error('Error loading user profile:', error);
        this.showMessage('Lỗi khi tải thông tin profile', 'error');
        return;
      }

      // Merge with profile data from auth (has username, email, etc.)
      const profileData = {
        ...userData,
        username: this.currentUser.profile?.username || userData.username,
        email: this.currentUser.profile?.email || userData.email
      };

      this.fillProfileForm(profileData);
      this.updateStats(profileData);
    } catch (err) {
      console.error('Unexpected error:', err);
      this.showMessage('Lỗi khi tải thông tin profile', 'error');
    }
  }

  fillProfileForm(userData) {
    const usernameInput = document.getElementById('username');
    const emailInput = document.getElementById('email');
    const fullNameInput = document.getElementById('fullName');
    const bioInput = document.getElementById('bio');
    const avatarPreview = document.getElementById('avatarPreview');

    if (usernameInput) usernameInput.value = userData.username || '';
    if (emailInput) emailInput.value = userData.email || '';
    if (fullNameInput) fullNameInput.value = userData.full_name || '';
    if (bioInput) bioInput.value = userData.bio || '';

    // Update avatar preview
    if (avatarPreview) {
      avatarPreview.src = userData.avatar_url || '/default-avatar.png';
    }

    this.updatePageTitle(userData.username);
  }

  updatePageTitle(username) {
    document.title = username
      ? `Profile - ${username}`
      : 'Profile - NTAM';
  }

  updateStats(userData) {
    // Legacy stats
    const loginCountEl = document.getElementById('loginCount');
    const joinDateEl = document.getElementById('joinDate');
    const userRoleEl = document.getElementById('userRole');

    if (loginCountEl) {
      loginCountEl.textContent = userData.login_count || 0;
    }

    if (joinDateEl) {
      const joinDate = userData.created_at
        ? new Date(userData.created_at)
        : new Date();
      joinDateEl.textContent = joinDate.toLocaleDateString('vi-VN');
    }

    if (userRoleEl) {
      userRoleEl.textContent = userData.role || 'User';
    }

    // Game stats from user_profiles
    const levelBadgeEl = document.getElementById('level-badge');
    const xpFillEl = document.getElementById('xp-fill');
    const xpTextEl = document.getElementById('xp-text');
    const coinsAmountEl = document.getElementById('coins-amount');
    const gemsAmountEl = document.getElementById('gems-amount');

    // Update level
    if (levelBadgeEl) {
      levelBadgeEl.textContent = `Lv. ${userData.level || 1}`;
    }

    // Update XP bar
    const currentXP = userData.xp || 0;
    const levelXPNeeded = userProfile.getXPNeededForLevel(userData.level || 1);
    const progressPercent = levelXPNeeded > 0 ? (currentXP / levelXPNeeded) * 100 : 0;

    if (xpFillEl) {
      xpFillEl.style.width = `${Math.min(progressPercent, 100)}%`;
    }

    if (xpTextEl) {
      xpTextEl.textContent = `${currentXP} / ${levelXPNeeded} XP`;
    }

    // Update currencies
    if (coinsAmountEl) {
      coinsAmountEl.textContent = userData.coins || 0;
    }

    if (gemsAmountEl) {
      gemsAmountEl.textContent = userData.gems || 0;
    }
  }

  /* ================= EVENTS ================= */

  setupEventListeners() {
    const saveBtn = document.getElementById('saveProfileBtn');
    const changePasswordBtn = document.getElementById('changePasswordBtn');
    const avatarInput = document.getElementById('userAvatarInput');

    if (saveBtn) {
      saveBtn.addEventListener('click', () => this.saveProfile());
    }

    if (changePasswordBtn) {
      changePasswordBtn.addEventListener('click', () => this.changePassword());
    }

    if (avatarInput) {
      avatarInput.addEventListener('change', (e) => this.handleAvatarUpload(e));
    }
  }

  /* ================= UPDATE PROFILE ================= */

  async saveProfile() {
    const saveBtn = document.getElementById('saveProfileBtn');
    const originalText = saveBtn?.textContent;

    try {
      if (saveBtn) {
        saveBtn.textContent = 'Đang lưu...';
        saveBtn.disabled = true;
      }

      const email = document.getElementById('email')?.value || null;
      const fullName = document.getElementById('fullName')?.value || null;
      const bio = document.getElementById('bio')?.value || null;

      if (email && !this.isValidEmail(email)) {
        this.showMessage('Email không hợp lệ', 'error');
        return;
      }

      const { error } = await supabase
        .from('users')
        .update({
          email,
          full_name: fullName,
          bio,
          updated_at: new Date().toISOString()
        })
        .eq('id', this.currentUser.user.id);

      if (error) {
        console.error(error);
        this.showMessage('Lỗi khi cập nhật thông tin', 'error');
        return;
      }

      this.showMessage('Cập nhật thông tin thành công!', 'success');
    } catch (err) {
      console.error(err);
      this.showMessage('Lỗi khi cập nhật thông tin', 'error');
    } finally {
      if (saveBtn) {
        saveBtn.textContent = originalText;
        saveBtn.disabled = false;
      }
    }
  }

  /* ================= CHANGE PASSWORD (SUPABASE AUTH) ================= */

  async changePassword() {
    const changeBtn = document.getElementById('changePasswordBtn');
    const originalText = changeBtn?.textContent;

    try {
      if (changeBtn) {
        changeBtn.textContent = 'Đang đổi...';
        changeBtn.disabled = true;
      }

      const newPassword = document.getElementById('newPassword')?.value;
      const confirmPassword = document.getElementById('confirmPassword')?.value;

      if (!newPassword || !confirmPassword) {
        this.showMessage('Vui lòng nhập đầy đủ thông tin', 'error');
        return;
      }

      if (newPassword !== confirmPassword) {
        this.showMessage('Mật khẩu không khớp', 'error');
        return;
      }

      if (newPassword.length < 6) {
        this.showMessage('Mật khẩu phải có ít nhất 6 ký tự', 'error');
        return;
      }

      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) {
        console.error(error);
        this.showMessage('Lỗi khi đổi mật khẩu', 'error');
        return;
      }

      this.showMessage('Đổi mật khẩu thành công!', 'success');

      document.getElementById('newPassword').value = '';
      document.getElementById('confirmPassword').value = '';
    } catch (err) {
      console.error(err);
      this.showMessage('Lỗi khi đổi mật khẩu', 'error');
    } finally {
      if (changeBtn) {
        changeBtn.textContent = originalText;
        changeBtn.disabled = false;
      }
    }
  }

  /* ================= AVATAR UPLOAD ================= */

  async handleAvatarUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      this.showMessage("Chỉ được upload ảnh!", "error");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      this.showMessage("Ảnh không được quá 5MB!", "error");
      return;
    }

    try {
      this.showMessage("Đang upload avatar...", "info");
      const avatarUrl = await this.uploadUserAvatar(file);

      // Update preview immediately
      const avatarPreview = document.getElementById('avatarPreview');
      if (avatarPreview) {
        avatarPreview.src = avatarUrl;
      }

      this.showMessage("Upload avatar thành công!", "success");

      // Reload profile to reflect changes
      await this.loadUserProfile();
    } catch (err) {
      console.error("Avatar upload error:", err);
      this.showMessage("Lỗi khi upload avatar!", "error");
    }
  }

  async uploadUserAvatar(file) {
    if (!this.currentUser) {
      throw new Error("Chưa đăng nhập");
    }

    const fileExt = file.name.split('.').pop().toLowerCase();
    const filePath = `${this.currentUser.user.id}.${fileExt}`;

    // 1️⃣ Upload ảnh
    const { error: uploadError } = await supabase.storage
      .from('user-avatar')
      .upload(filePath, file, {
        upsert: true,
        contentType: file.type
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      throw new Error("Không thể upload ảnh: " + uploadError.message);
    }

    // 2️⃣ Lấy public URL
    const { data } = supabase.storage
      .from('user-avatar')
      .getPublicUrl(filePath);

    const avatarUrl = data.publicUrl;

    if (!avatarUrl) {
      throw new Error("Không thể lấy URL của ảnh");
    }

    // 3️⃣ Update profile
    const { error: updateError } = await supabase
      .from('user_profiles')
      .update({ avatar_url: avatarUrl })
      .eq('id', this.currentUser.user.id);

    if (updateError) {
      console.error("Profile update error:", updateError);
      throw new Error("Không thể cập nhật profile: " + updateError.message);
    }

    return avatarUrl;
  }

  /* ================= HELPERS ================= */

  showMessage(message, type = 'info') {
    let messageEl = document.querySelector('.message');

    if (!messageEl) {
      messageEl = document.createElement('div');
      messageEl.className = 'message';
      document
        .querySelector('.profile-container')
        ?.insertBefore(messageEl, document.querySelector('.profile-content'));
    }

    messageEl.textContent = message;
    messageEl.className = `message ${type} show`;

    setTimeout(() => {
      messageEl.classList.remove('show');
    }, 5000);
  }

  isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  redirectToLogin() {
    const path = window.location.pathname;
    const loginPath = path.includes('/pages/')
      ? 'login.html'
      : 'pages/login.html';

    window.location.href = loginPath;
  }
}

// Have to be exported for entry point