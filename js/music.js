import { supabase } from "./supabase.js";
import { User } from "./user.js";

class MusicPlayer {
  constructor() {
    // Sử dụng supabase từ file supabase.js
    this.supabase = supabase;
    
    // State management
    this.state = {
      currentUser: null,
      currentUserRole: "guest",
      currentPlaylist: [],
      currentIndex: 0,
      isRepeat: false,
      isShuffle: false,
      isDrawing: false,
      erasing: false,
      controlsShownOnce: false,
      navigationStack: [],
      isLoading: false,
      error: null
    };

    // DOM Elements
    this.elements = {
      mainMenu: document.getElementById("mainMenu"),
      playlistContainer: document.getElementById("playlistContainer"),
      backBtn: document.getElementById("backBtn"),
      controlsContainer: document.getElementById("controlsContainer"),
      musicPlayer: document.getElementById("musicPlayer"),
      currentSongTitle: document.getElementById("currentSongTitle"),
      pauseResumeBtn: document.getElementById("pauseResumeBtn"),
      prevBtn: document.getElementById("prevBtn"),
      nextBtn: document.getElementById("nextBtn"),
      repeatBtn: document.getElementById("repeatBtn"),
      shuffleBtn: document.getElementById("shuffleBtn"),
      progressBar: document.getElementById("progressBar"),
      currentTimeDisplay: document.getElementById("currentTime"),
      durationDisplay: document.getElementById("duration"),
      canvas: document.getElementById("volumeCanvas"),
      eraserBtn: document.getElementById("eraserBtn")
    };

    // Initialize canvas context
    this.ctx = this.elements.canvas.getContext("2d");
    
    // Bind methods
    this.handleError = this.handleError.bind(this);
    this.showLoading = this.showLoading.bind(this);
    this.hideLoading = this.hideLoading.bind(this);
    this.showNotification = this.showNotification.bind(this);
    
    // Initialize
    this.user = new User(
      this.supabase,
      this.state,
      this.elements,
      this.showNotification.bind(this),
      this.loadMainMenu.bind(this)
    );
    this.init();
  }

  // Error handling
  handleError(error, message = "Đã xảy ra lỗi") {
    console.error(error);
    this.state.error = error;
    this.showNotification(message, "error");
  }

  // Loading state
  showLoading() {
    this.state.isLoading = true;
    // Add loading spinner to DOM
    const spinner = document.createElement("div");
    spinner.className = "loading-spinner";
    spinner.innerHTML = `
      <div class="spinner"></div>
      <div class="spinner-text">Đang tải...</div>
    `;
    document.body.appendChild(spinner);
  }

  hideLoading() {
    this.state.isLoading = false;
    // Remove loading spinner
    const spinner = document.querySelector(".loading-spinner");
    if (spinner) spinner.remove();
  }

  // Notification system
  showNotification(message, type = "info") {
    const notification = document.createElement("div");
    notification.className = `notification ${type}`;
    notification.innerHTML = `
      <div class="notification-content">
        <span class="notification-icon">${this.getNotificationIcon(type)}</span>
        <span class="notification-message">${message}</span>
      </div>
      <button class="notification-close">×</button>
    `;
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.remove();
    }, 3000);
  }

  // Playlist management
  async createPlaylist(name) {
    if (!this.state.currentUser) {
      this.showNotification("Vui lòng đăng nhập để tạo playlist", "warning");
      return;
    }

    try {
      this.showLoading();
      
      console.log("Creating playlist for user:", this.state.currentUser);
      console.log("User ID from state:", this.state.currentUser.id);
      console.log("User ID from localStorage:", localStorage.getItem('userId'));

      // Kiểm tra playlist đã tồn tại
      const { data: existingPlaylists, error: checkError } = await this.supabase
        .from("playlist")
        .select("id")
        .filter("name", "eq", name)
        .filter("user_id", "eq", this.state.currentUser.id);

      if (checkError) {
        console.error("Lỗi khi kiểm tra playlist:", checkError);
        throw checkError;
      }

      if (existingPlaylists && existingPlaylists.length > 0) {
        this.showNotification("Bạn đã có playlist với tên này", "warning");
        return;
      }

      // Tạo playlist mới
      const playlistData = {
        name: name,
        user_id: this.state.currentUser.id, // uuid từ bảng users
        created_at: new Date().toISOString()
      };
      
      console.log("Attempting to create playlist with data:", playlistData);

      const { data, error } = await this.supabase
        .from("playlist")
        .insert([playlistData])
        .select()
        .single();

      if (error) {
        console.error("Lỗi khi tạo playlist:", error);
        if (error.code === '23503') { // Foreign key violation
          console.error("Foreign key violation details:", error.details);
          this.showNotification("Lỗi: Không tìm thấy thông tin người dùng", "error");
        } else {
          throw error;
        }
        return;
      }

      this.showNotification("Tạo playlist thành công!", "success");
      await this.loadCategory("playlist", "Playlist của bạn");
      return data;
    } catch (error) {
      console.error("Chi tiết lỗi:", error);
      this.handleError(error, "Không thể tạo playlist");
    } finally {
      this.hideLoading();
    }
  }

  // Song management
  async addSongToPlaylist(songId, playlistId) {
    try {
      // Check for duplicate
      const { data: existing } = await this.supabase
        .from("playlist_song")
        .select()
        .match({ playlist_id: playlistId, song_id: songId })
        .single();

      if (existing) {
        this.showNotification("Bài hát đã có trong playlist", "warning");
        return;
      }

      const { error } = await this.supabase
        .from("playlist_song")
        .insert([{ playlist_id: playlistId, song_id: songId }]);

      if (error) throw error;

      this.showNotification("Đã thêm bài hát vào playlist", "success");
    } catch (error) {
      this.handleError(error, "Không thể thêm bài hát vào playlist");
    }
  }

  // Volume control
  updateVolume() {
    const imageData = this.ctx.getImageData(0, 0, this.elements.canvas.width, this.elements.canvas.height).data;
    let filledPixels = 0;
    
    for (let i = 3; i < imageData.length; i += 4) {
      if (imageData[i] > 0) filledPixels++;
    }
    
    const fillPercent = filledPixels / (this.elements.canvas.width * this.elements.canvas.height);
    const volume = Math.min(Math.max(fillPercent, 0), 1);
    
    // Set default volume if canvas is empty
    this.elements.musicPlayer.volume = filledPixels === 0 ? 0.5 : volume;
  }

  // Navigation
  saveNavigationState() {
    localStorage.setItem("navigationStack", JSON.stringify(this.state.navigationStack));
  }

  loadNavigationState() {
    const saved = localStorage.getItem("navigationStack");
    if (saved) {
      this.state.navigationStack = JSON.parse(saved);
    }
  }

  // Initialize
  async init() {
    try {
      await this.user.checkLoginStatus();
      this.loadNavigationState();
      this.setupEventListeners();
      await this.loadMainMenu();
    } catch (error) {
      this.handleError(error, "Lỗi khởi tạo ứng dụng");
    }
  }

  // Event listeners setup
  setupEventListeners() {
    // Playback controls
    this.elements.pauseResumeBtn.addEventListener("click", () => this.togglePlayPause());
    this.elements.prevBtn.addEventListener("click", () => this.playPrevSong());
    this.elements.nextBtn.addEventListener("click", () => this.playNextSong());
    this.elements.repeatBtn.addEventListener("click", () => this.toggleRepeat());
    this.elements.shuffleBtn.addEventListener("click", () => this.toggleShuffle());

    // Progress bar
    this.elements.progressBar.addEventListener("input", () => {
      this.elements.musicPlayer.currentTime = this.elements.progressBar.value;
    });

    // Volume control
    this.elements.canvas.addEventListener("mousedown", () => this.state.isDrawing = true);
    this.elements.canvas.addEventListener("mouseup", () => {
      this.state.isDrawing = false;
      this.updateVolume();
    });
    this.elements.canvas.addEventListener("mouseleave", () => {
      if (this.state.isDrawing) {
        this.state.isDrawing = false;
        this.updateVolume();
      }
    });
    this.elements.canvas.addEventListener("mousemove", (e) => this.draw(e));

    // Eraser
    this.elements.eraserBtn.addEventListener("click", () => {
      this.state.erasing = !this.state.erasing;
      this.elements.eraserBtn.textContent = this.state.erasing ? "🧽" : "✏️";
    });

    // Navigation
    this.elements.backBtn.addEventListener("click", () => this.handleBackNavigation());

    // Player events
    this.elements.musicPlayer.addEventListener("ended", () => this.handleSongEnd());
    this.elements.musicPlayer.addEventListener("timeupdate", () => this.updateProgress());
  }

  // UI Components
  createLoadingSpinner() {
    const spinner = document.createElement("div");
    spinner.className = "loading-spinner";
    spinner.innerHTML = `
      <div class="spinner"></div>
      <div class="spinner-text">Đang tải...</div>
    `;
    return spinner;
  }

  createNotification(message, type) {
    const notification = document.createElement("div");
    notification.className = `notification ${type}`;
    notification.innerHTML = `
      <div class="notification-content">
        <span class="notification-icon">${this.getNotificationIcon(type)}</span>
        <span class="notification-message">${message}</span>
      </div>
      <button class="notification-close">×</button>
    `;
    return notification;
  }

  getNotificationIcon(type) {
    const icons = {
      success: "✅",
      error: "❌",
      warning: "⚠️",
      info: "ℹ️"
    };
    return icons[type] || icons.info;
  }

  // Main Menu
  async loadMainMenu() {
    try {
      this.showLoading();
      this.elements.mainMenu.innerHTML = "";
      this.elements.mainMenu.style.display = "flex";
      this.elements.playlistContainer.style.display = "none";

      if (!this.state.controlsShownOnce) {
        this.elements.controlsContainer.style.display = "none";
      }

      this.elements.backBtn.style.display = "none";

      const categories = [
        { emoji: "🎤", label: "Nghệ sĩ", type: "artist" },
        { emoji: "🎧", label: "Thể loại", type: "genre" },
        { emoji: "🌍", label: "Khu vực", type: "region" },
        { emoji: "📂", label: "Playlist người dùng", type: "playlist" }
      ];

      const fragment = document.createDocumentFragment();
      categories.forEach(({ emoji, label, type }) => {
        const btn = this.createButton(`${emoji} ${label}`, "main-category-button", () => {
          this.loadCategory(type, `${emoji} ${label}`);
        });
        fragment.appendChild(btn);
      });
      this.elements.mainMenu.appendChild(fragment);

      this.state.navigationStack = [];
      this.saveNavigationState();
    } catch (error) {
      this.handleError(error, "Lỗi tải menu chính");
    } finally {
      this.hideLoading();
    }
  }

  // Category Loading
  async loadCategory(type, displayTitle) {
    try {
      this.showLoading();
      this.elements.mainMenu.innerHTML = "";
      this.elements.mainMenu.style.display = "flex";
      this.elements.playlistContainer.style.display = "none";
      this.elements.backBtn.style.display = "inline-block";

      this.state.navigationStack.push({ view: "main" });
      this.saveNavigationState();

      if (type === "playlist") {
        // Kiểm tra đăng nhập
        if (!this.state.currentUser) {
          const loginForm = document.createElement("div");
          loginForm.className = "login-prompt";
          loginForm.innerHTML = `
            <p>Vui lòng đăng nhập để xem playlist của bạn</p>
            <div class="login-form">
              <input type="text" id="username" placeholder="Tên đăng nhập">
              <input type="password" id="password" placeholder="Mật khẩu">
              <button id="loginButton">Đăng nhập</button>
            </div>
          `;
          this.elements.mainMenu.appendChild(loginForm);

          // Thêm event listener cho nút đăng nhập
          document.getElementById('loginButton').addEventListener('click', async () => {
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            
            if (!username || !password) {
              this.showNotification("Vui lòng nhập đầy đủ thông tin", "warning");
              return;
            }

            const success = await this.user.login(username, password);
            if (success) {
              this.loadCategory("playlist", "Playlist của bạn");
            }
          });
          return;
        }

        // Tạo container cho playlist section
        const playlistSection = document.createElement("div");
        playlistSection.className = "playlist-section";

        // Thêm nút tạo playlist mới
        const createPlaylistBtn = this.createButton("➕ Tạo playlist mới", "create-playlist-button", () => {
          const playlistName = prompt("Nhập tên playlist:");
          if (playlistName?.trim()) {
            this.createPlaylist(playlistName.trim());
          }
        });
        playlistSection.appendChild(createPlaylistBtn);

        // Thêm container cho danh sách playlist
        const playlistList = document.createElement("div");
        playlistList.className = "playlist-list";

        const { data, error } = await this.supabase
          .from("playlist")
          .select("id, name")
          .eq("user_id", this.state.currentUser.id);

        if (error) throw error;

        if (!data || data.length === 0) {
          const noPlaylistMsg = document.createElement("p");
          noPlaylistMsg.className = "message";
          noPlaylistMsg.textContent = "Bạn chưa có playlist nào.";
          playlistList.appendChild(noPlaylistMsg);
        } else {
          data.forEach(item => {
            const btn = this.createButton(item.name, "category-item", () => {
              this.loadSongsByCategory("playlist", item.id, item.name);
            });
            playlistList.appendChild(btn);
          });
        }

        playlistSection.appendChild(playlistList);
        this.elements.mainMenu.appendChild(playlistSection);
        return;
      }

      const { data, error } = await this.supabase.from(type).select("id, name");
      if (error) throw error;

      if (!data || data.length === 0) {
        this.elements.mainMenu.innerHTML = this.createMessage(`Không có dữ liệu cho ${displayTitle}.`);
        return;
      }

      const fragment = document.createDocumentFragment();
      data.forEach(item => {
        const btn = this.createButton(item.name, "category-item", () => {
          this.loadSongsByCategory(type, item.id, item.name);
        });
        fragment.appendChild(btn);
      });
      this.elements.mainMenu.appendChild(fragment);
    } catch (error) {
      this.handleError(error, `Lỗi tải dữ liệu ${displayTitle}`);
    } finally {
      this.hideLoading();
    }
  }

  // Song Loading
  async loadSongsByCategory(type, id, displayName) {
    try {
      this.showLoading();
      this.elements.mainMenu.style.display = "none";
      this.elements.playlistContainer.style.display = "block";
      this.elements.backBtn.style.display = "inline-block";

      this.elements.playlistContainer.innerHTML = `<h3>${displayName} - Danh sách bài hát</h3>`;

      this.state.navigationStack.push({ view: "category", type, displayTitle: displayName });
      this.saveNavigationState();

      const columnMap = {
        artist: "artist_id",
        genre: "genre_id",
        region: "region_id",
        playlist: "playlist_id"
      };
      const filterColumn = columnMap[type];

      const { data, error } = await this.supabase
        .from("music_data")
        .select("id, song_name, url, artist:artist(name), genre:genre(name), region:region(name)")
        .eq(filterColumn, id);

      if (error) throw error;

      if (!data || data.length === 0) {
        this.elements.playlistContainer.innerHTML += this.createMessage("Không có bài hát nào trong mục này.");
        return;
      }

      if (type === "playlist" && this.state.currentUserRole !== "guest") {
        const addBtn = this.createButton("➕ Thêm bài hát vào playlist này", "add-song-button", () => {
          this.showAddSongDialog(id, displayName);
        });
        this.elements.playlistContainer.appendChild(addBtn);
      }

      this.state.currentPlaylist = data;
      this.state.currentIndex = 0;

      const fragment = document.createDocumentFragment();
      data.forEach((song, index) => {
        const songContainer = document.createElement("div");
        songContainer.className = "song-container";

        const btn = this.createButton(song.song_name, "song-button", () => {
          this.state.currentIndex = index;
          this.playSong(index);
        });

        if (type === "playlist" && this.state.currentUserRole !== "guest") {
          const deleteBtn = this.createButton("❌", "delete-song-button", async (e) => {
            e.stopPropagation();
            await this.deleteSongFromPlaylist(song.id, id, displayName);
          });
          songContainer.appendChild(deleteBtn);
        }

        songContainer.appendChild(btn);
        fragment.appendChild(songContainer);
      });
      this.elements.playlistContainer.appendChild(fragment);
    } catch (error) {
      this.handleError(error, "Lỗi tải bài hát");
    } finally {
      this.hideLoading();
    }
  }

  // Helper Methods
  createButton(text, className, onClick) {
    const btn = document.createElement("button");
    btn.textContent = text;
    btn.className = className;
    btn.addEventListener("click", onClick);
    return btn;
  }

  createMessage(text) {
    return `<p class="message">${text}</p>`;
  }

  // Dialog Methods
  async showAddSongDialog(playlistId, displayName) {
    const songName = prompt("Tên bài hát:");
    const songUrl = prompt("URL bài hát:");

    if (songName && songUrl) {
      try {
        this.showLoading();
        const { error } = await this.supabase.from("music_data").insert([
          {
            song_name: songName,
            url: songUrl,
            playlist_id: playlistId,
            user_id: this.state.currentUser.id
          }
        ]);

        if (error) throw error;

        this.showNotification("Đã thêm bài hát!", "success");
        await this.loadSongsByCategory("playlist", playlistId, displayName);
      } catch (error) {
        this.handleError(error, "Không thể thêm bài hát");
      } finally {
        this.hideLoading();
      }
    }
  }

  async deleteSongFromPlaylist(songId, playlistId, displayName) {
    const confirmDelete = confirm("Xóa bài hát này khỏi playlist?");
    if (!confirmDelete) return;

    try {
      this.showLoading();
      const { error } = await this.supabase
        .from("playlist_song")
        .delete()
        .match({
          playlist_id: playlistId,
          song_id: songId
        });

      if (error) throw error;

      this.showNotification("Đã xóa bài hát khỏi playlist", "success");
      await this.loadSongsByCategory("playlist", playlistId, displayName);
    } catch (error) {
      this.handleError(error, "Không thể xóa bài hát");
    } finally {
      this.hideLoading();
    }
  }

  // Playback Methods
  playSong(index) {
    const song = this.state.currentPlaylist[index];
    if (!song) return;

    this.elements.musicPlayer.src = song.url;
    const artistName = song.artist?.name || "Không rõ nghệ sĩ";
    this.elements.currentSongTitle.textContent = `${song.song_name} - ${artistName}`;

    this.elements.musicPlayer.play().catch(error => {
      this.handleError(error, "Không thể phát bài hát này");
    });

    this.elements.pauseResumeBtn.textContent = "⏸";

    if (!this.state.controlsShownOnce) {
      this.elements.controlsContainer.style.display = "block";
      this.state.controlsShownOnce = true;
    }
  }

  togglePlayPause() {
    if (this.elements.musicPlayer.paused) {
      this.elements.musicPlayer.play();
      this.elements.pauseResumeBtn.textContent = "⏸";
    } else {
      this.elements.musicPlayer.pause();
      this.elements.pauseResumeBtn.textContent = "▶";
    }
  }

  playNextSong() {
    if (this.state.currentPlaylist.length === 0) return;
    if (this.state.isShuffle) {
      this.state.currentIndex = Math.floor(Math.random() * this.state.currentPlaylist.length);
    } else {
      this.state.currentIndex = (this.state.currentIndex + 1) % this.state.currentPlaylist.length;
    }
    this.playSong(this.state.currentIndex);
  }

  playPrevSong() {
    if (this.state.currentPlaylist.length === 0) return;
    if (this.state.isShuffle) {
      this.state.currentIndex = Math.floor(Math.random() * this.state.currentPlaylist.length);
    } else {
      this.state.currentIndex = (this.state.currentIndex - 1 + this.state.currentPlaylist.length) % this.state.currentPlaylist.length;
    }
    this.playSong(this.state.currentIndex);
  }

  toggleRepeat() {
    this.state.isRepeat = !this.state.isRepeat;
    if (this.state.isRepeat) this.state.isShuffle = false;
    this.updateButtons();
  }

  toggleShuffle() {
    this.state.isShuffle = !this.state.isShuffle;
    if (this.state.isShuffle) this.state.isRepeat = false;
    this.updateButtons();
  }

  updateButtons() {
    this.elements.repeatBtn.classList.toggle("active", this.state.isRepeat);
    this.elements.shuffleBtn.classList.toggle("active", this.state.isShuffle);
  }

  updateProgress() {
    const current = Math.floor(this.elements.musicPlayer.currentTime);
    const total = Math.floor(this.elements.musicPlayer.duration) || 0;

    this.elements.progressBar.max = total;
    this.elements.progressBar.value = current;

    this.elements.currentTimeDisplay.textContent = this.formatTime(current);
    this.elements.durationDisplay.textContent = this.formatTime(total);
  }

  formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  }

  handleSongEnd() {
    if (this.state.isRepeat) {
      this.playSong(this.state.currentIndex);
    } else {
      this.playNextSong();
    }
  }

  handleBackNavigation() {
    const lastView = this.state.navigationStack.pop();
    if (!lastView) return;

    if (lastView.view === "main") {
      this.loadMainMenu();
    } else if (lastView.view === "category") {
      this.loadCategory(lastView.type, lastView.displayTitle);
    }
    this.saveNavigationState();
  }

  draw(e) {
    if (!this.state.isDrawing) return;

    const rect = this.elements.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    this.ctx.globalCompositeOperation = this.state.erasing ? "destination-out" : "source-over";
    this.ctx.fillStyle = "black";
    this.ctx.beginPath();
    this.ctx.arc(x, y, 5, 0, 2 * Math.PI);
    this.ctx.fill();
  }
}

// Initialize the application
document.addEventListener("DOMContentLoaded", () => {
  const app = new MusicPlayer();
});
