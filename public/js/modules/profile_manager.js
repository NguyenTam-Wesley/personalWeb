import { supabase } from '../supabase/supabase.js';
import { getCurrentUser } from '../supabase/auth.js';
import { userProfile } from './user_profile.js';

export class ProfileManager {
  constructor() {
    this.currentUser = null;
    this.init();
  }

  /* ================= INIT ================= */

  async init() {
    const user = await getCurrentUser();

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
        .eq('id', this.currentUser.id)
        .single();

      if (error) {
        console.error('Error loading user profile:', error);
        this.showMessage('Lỗi khi tải thông tin profile', 'error');
        return;
      }

      // Also get username from users table
      const { data: userInfo } = await supabase
        .from('users')
        .select('username')
        .eq('id', this.currentUser.id)
        .single();

      // Merge data
      const profileData = {
        ...userData,
        username: userInfo?.username || userData.username
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

    if (usernameInput) usernameInput.value = userData.username || '';
    if (emailInput) emailInput.value = userData.email || '';
    if (fullNameInput) fullNameInput.value = userData.full_name || '';
    if (bioInput) bioInput.value = userData.bio || '';

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

    if (saveBtn) {
      saveBtn.addEventListener('click', () => this.saveProfile());
    }

    if (changePasswordBtn) {
      changePasswordBtn.addEventListener('click', () => this.changePassword());
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
        .eq('id', this.currentUser.id);

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