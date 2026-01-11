import { supabase } from "../supabase/supabase.js";
import { User } from "../supabase/user.js";

export class MusicPlayer {
  constructor() {
    console.trace("MusicPlayer constructor called");
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
      error: null,
      currentView: null,
      currentPlaylistId: null,
      currentPlaylistName: null
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
      eraserBtn: document.getElementById("eraserBtn"),
      addToPlaylistBtn: document.getElementById("addToPlaylistBtn")
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
    
    // Setup auth listener trước khi init
    this.user.setupAuthListener();
    
    this.init();

    // Đảm bảo progressBar là input range
    this.elements.progressBar.addEventListener("input", () => {
      this.elements.musicPlayer.currentTime = this.elements.progressBar.value;
    });

    // Add log for play/pause events
    const audio = this.elements.musicPlayer;
    audio.onplay = () => {
      console.log("audio.onplay triggered");
    };
    audio.onpause = () => {
      console.log("audio.onpause triggered");
    };
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

      // ✅ LẤY auth_user_id thay vì dùng id từ state
      const { data: { user } } = await this.supabase.auth.getUser();

      if (!user) {
        this.showNotification("Phiên đăng nhập hết hạn", "warning");
        return;
      }

      console.log("Creating playlist for auth user:", user.id);

      // Kiểm tra playlist đã tồn tại
      const { data: existingPlaylists, error: checkError } = await this.supabase
        .from("playlist")
        .select("id")
        .filter("name", "eq", name)
        .filter("user_id", "eq", user.id); // ✅ Dùng user.id từ auth

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
        user_id: user.id, // ✅ user.id từ auth = users.auth_user_id
        created_at: new Date().toISOString()
      };
      
      console.log("Attempting to create playlist with data:", playlistData);

      const { data, error } = await this.supabase
        .from("playlist")
        .insert([playlistData])
        .select()
        .maybeSingle();

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
    console.log("addSongToPlaylist called with:", { songId, playlistId });
    try {
      // Check for duplicate
      const { data: existing, error } = await this.supabase
        .from("playlist_song")
        .select("*")
        .eq("playlist_id", playlistId)
        .eq("song_id", songId);

      if (error) throw error;

      if (existing && existing.length > 0) {
        this.showNotification("Bài hát đã có trong playlist", "warning");
        return;
      }

      console.log("Inserting into playlist_song:", { playlist_id: playlistId, song_id: songId });
      const { error: insertError } = await this.supabase
        .from("playlist_song")
        .insert([{ playlist_id: playlistId, song_id: songId }]);

      if (insertError) throw insertError;

      this.showNotification("Đã thêm bài hát vào playlist", "success");
      // Nếu đang xem đúng playlist này thì reload lại danh sách bài hát
      if (
        this.state.currentView === "playlistSongs" &&
        this.state.currentPlaylistId === playlistId
      ) {
        this.loadSongsByCategory("playlist", playlistId, this.state.currentPlaylistName);
      }
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
    // KHÔNG lưu vào localStorage nữa vì session được Supabase Auth quản lý
    // Chỉ giữ trong memory
  }

  loadNavigationState() {
    // KHÔNG load từ localStorage nữa
    // Navigation stack sẽ reset mỗi khi reload trang
    this.state.navigationStack = [];
  }

  // Initialize
  async init() {
    try {
      // Luôn setup event listeners trước
      this.setupEventListeners();
      
      // Kiểm tra login status từ Supabase Auth
      await this.user.checkLoginStatus();
      
      // Load navigation state (sẽ là empty array)
      this.loadNavigationState();

      // Load main menu
      await this.loadMainMenu();
    } catch (error) {
      this.handleError(error, "Lỗi khởi tạo ứng dụng");
    }
  }

  // Event listeners setup
  setupEventListeners() {
    console.log("setupEventListeners called");
    // Playback controls
    this.elements.pauseResumeBtn.addEventListener("click", () => {
      console.log("Pause/Resume button clicked");
      this.togglePlayPause();
    });
    this.elements.prevBtn.addEventListener("click", () => this.playPrevSong());
    this.elements.nextBtn.addEventListener("click", () => this.playNextSong());
    this.elements.repeatBtn.addEventListener("click", () => this.toggleRepeat());
    this.elements.shuffleBtn.addEventListener("click", () => this.toggleShuffle());

    // Nút ➕ thêm vào playlist
    if (this.elements.addToPlaylistBtn) {
      this.elements.addToPlaylistBtn.addEventListener("click", () => {
        console.log("Nút ➕ được click");
        this.showAddToPlaylistPopup();
      });
    }

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

  // Main Menu với phân trang
  async loadMainMenu(page = 1, pageSize = 8) {
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
        { emoji: "📂", label: "Playlist", type: "playlist" }
      ];

      // Phân trang
      const totalPages = Math.ceil(categories.length / pageSize);
      const startIdx = (page - 1) * pageSize;
      const endIdx = startIdx + pageSize;
      const pageCategories = categories.slice(startIdx, endIdx);

      const fragment = document.createDocumentFragment();
      pageCategories.forEach(({ emoji, label, type }) => {
        const btn = this.createButton(`${emoji} ${label}`, "main-category-button", () => {
          this.loadCategory(type, `${emoji} ${label}`);
        });
        fragment.appendChild(btn);
      });
      this.elements.mainMenu.appendChild(fragment);

      // Nút phân trang nếu cần
      if (totalPages > 1) {
        const pagination = document.createElement("div");
        pagination.style.display = "flex";
        pagination.style.justifyContent = "center";
        pagination.style.width = "100%";
        pagination.style.gap = "10px";
        pagination.style.marginTop = "10px";

        if (page > 1) {
          const prevBtn = this.createButton("← Trang trước", "main-category-button", () => this.loadMainMenu(page - 1, pageSize));
          pagination.appendChild(prevBtn);
        }
        if (page < totalPages) {
          const nextBtn = this.createButton("Trang sau →", "main-category-button", () => this.loadMainMenu(page + 1, pageSize));
          pagination.appendChild(nextBtn);
        }
        this.elements.mainMenu.appendChild(pagination);
      }

      this.state.navigationStack = [];
      this.saveNavigationState();
    } catch (error) {
      this.handleError(error, "Lỗi tải menu chính");
    } finally {
      this.hideLoading();
    }
  }

  // Category Loading
  async loadCategory(type, displayTitle, page = 1, pageSize = 50) {
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
          const loginPrompt = document.createElement("div");
          loginPrompt.className = "login-prompt";
          loginPrompt.innerHTML = `
            <p>Vui lòng <a href='./login.html' style='color:#007bff;text-decoration:underline;'>đăng nhập</a> để xem playlist của bạn</p>
          `;
          this.elements.mainMenu.appendChild(loginPrompt);
          return;
        }

        // ✅ LẤY auth_user_id
        const { data: { user } } = await this.supabase.auth.getUser();

        if (!user) {
          this.showNotification("Phiên đăng nhập hết hạn", "warning");
          return;
        }

        // Tạo container cho playlist section
        const playlistSection = document.createElement("div");
        playlistSection.className = "playlist-section";

        // Thêm nút tạo playlist mới
        const createPlaylistBtn = this.createButton("➕ Tạo playlist mới", "create-playlist-button", () => {
          this.showCreatePlaylistPopup();
        });
        playlistSection.appendChild(createPlaylistBtn);

        // Thêm container cho danh sách playlist
        const playlistList = document.createElement("div");
        playlistList.className = "playlist-list";

        const { data, error } = await this.supabase
          .from("playlist")
          .select("id, name")
          .eq("user_id", user.id); // ✅ Dùng user.id từ auth

        if (error) throw error;

        if (!data || data.length === 0) {
          const noPlaylistMsg = document.createElement("p");
          noPlaylistMsg.className = "message";
          noPlaylistMsg.textContent = "Bạn chưa có playlist nào.";
          playlistList.appendChild(noPlaylistMsg);
        } else {
          // Phân trang cho playlist
          const totalPages = Math.ceil(data.length / pageSize);
          const startIdx = (page - 1) * pageSize;
          const endIdx = startIdx + pageSize;
          const pageData = data.slice(startIdx, endIdx);

          pageData.forEach(item => {
            const btn = this.createButton(item.name, "category-item", () => {
              this.loadSongsByCategory("playlist", item.id, item.name);
            });
            playlistList.appendChild(btn);
          });

          // Nút phân trang nếu cần
          if (totalPages > 1) {
            const pagination = document.createElement("div");
            pagination.style.display = "flex";
            pagination.style.justifyContent = "center";
            pagination.style.width = "100%";
            pagination.style.gap = "10px";
            pagination.style.marginTop = "10px";

            if (page > 1) {
              const prevBtn = this.createButton("← Trang trước", "main-category-button", () => this.loadCategory(type, displayTitle, page - 1, pageSize));
              pagination.appendChild(prevBtn);
            }
            if (page < totalPages) {
              const nextBtn = this.createButton("Trang sau →", "main-category-button", () => this.loadCategory(type, displayTitle, page + 1, pageSize));
              pagination.appendChild(nextBtn);
            }
            playlistList.appendChild(pagination);
          }
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

      // Phân trang cho category-item
      const totalPages = Math.ceil(data.length / pageSize);
      const startIdx = (page - 1) * pageSize;
      const endIdx = startIdx + pageSize;
      const pageData = data.slice(startIdx, endIdx);

      const fragment = document.createDocumentFragment();
      pageData.forEach(item => {
        const btn = this.createButton(item.name, "category-item", () => {
          this.loadSongsByCategory(type, item.id, item.name);
        });
        fragment.appendChild(btn);
      });
      this.elements.mainMenu.appendChild(fragment);

      // Nút phân trang nếu cần
      if (totalPages > 1) {
        const pagination = document.createElement("div");
        pagination.style.display = "flex";
        pagination.style.justifyContent = "center";
        pagination.style.width = "100%";
        pagination.style.gap = "10px";
        pagination.style.marginTop = "10px";

        if (page > 1) {
          const prevBtn = this.createButton("← Trang trước", "main-category-button", () => this.loadCategory(type, displayTitle, page - 1, pageSize));
          pagination.appendChild(prevBtn);
        }
        if (page < totalPages) {
          const nextBtn = this.createButton("Trang sau →", "main-category-button", () => this.loadCategory(type, displayTitle, page + 1, pageSize));
          pagination.appendChild(nextBtn);
        }
        this.elements.mainMenu.appendChild(pagination);
      }
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

      // Nếu là playlist, lưu lại thông tin vào state
      if (type === "playlist") {
        this.state.currentView = "playlistSongs";
        this.state.currentPlaylistId = id;
        this.state.currentPlaylistName = displayName;
      }

      let data = [];
      let error = null;
      if (type === "playlist") {
        // Lấy danh sách song_id từ playlist_song
        const { data: playlistSongs, error: psError } = await this.supabase
          .from("playlist_song")
          .select("song_id")
          .eq("playlist_id", id);
        if (psError) throw psError;
        const songIds = (playlistSongs || []).map(ps => ps.song_id);
        if (songIds.length > 0) {
          const { data: songs, error: songError } = await this.supabase
            .from("music_data")
            .select("id, song_name, url, artist:artist(name), genre:genre(name), region:region(name)")
            .in("id", songIds);
          if (songError) throw songError;
          data = songs;
        } else {
          data = [];
        }
      } else {
        const columnMap = {
          artist: "artist_id",
          genre: "genre_id",
          region: "region_id"
        };
        const filterColumn = columnMap[type];
        if (!filterColumn) return;
        const { data: songs, error: songError } = await this.supabase
          .from("music_data")
          .select("id, song_name, url, artist:artist(name), genre:genre(name), region:region(name)")
          .eq(filterColumn, id);
        if (songError) throw songError;
        data = songs;
      }

      // Log để xác nhận luôn lấy dữ liệu mới nhất từ Supabase
      console.log(`[Supabase] Fetched songs for ${type} ${id}:`, data);

      if (!data || data.length === 0) {
        this.elements.playlistContainer.innerHTML += this.createMessage("Không có bài hát nào trong mục này.");
        return;
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

        if (["artist", "genre", "region"].includes(type) && this.state.currentUserRole !== "guest") {
          const addBtn = this.createButton("➕", "add-to-playlist-btn", (e) => {
            e.stopPropagation();
            this.showAddToPlaylistPopup(song.id);
          });
          songContainer.appendChild(addBtn);
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

        // ✅ LẤY auth_user_id
        const { data: { user } } = await this.supabase.auth.getUser();

        if (!user) {
          this.showNotification("Phiên đăng nhập hết hạn", "warning");
          return;
        }

        const { error } = await this.supabase.from("music_data").insert([
          {
            song_name: songName,
            url: songUrl,
            playlist_id: playlistId,
            user_id: user.id // ✅ Dùng user.id từ auth
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
    console.log("playSong called", index);
    const song = this.state.currentPlaylist[index];
    if (!song) return;

    this.elements.musicPlayer.src = song.url;
    const artistName = song.artist?.name || "Không rõ nghệ sĩ";
    this.elements.currentSongTitle.textContent = `${song.song_name} - ${artistName}`;

    this.elements.musicPlayer.play().then(() => {
      console.log("play() trong playSong thành công");
    }).catch(error => {
      this.handleError(error, "Không thể phát bài hát này");
    });

    this.elements.pauseResumeBtn.textContent = "⏸";

    // Luôn hiển thị controls khi phát bài hát
    this.elements.controlsContainer.style.display = "block";
    this.state.controlsShownOnce = true;
  }

  togglePlayPause() {
    const audio = this.elements.musicPlayer;
    console.log("Audio paused:", audio.paused, "currentTime:", audio.currentTime, "src:", audio.src);
    if (audio.paused) {
      audio.play().then(() => {
        console.log("Gọi play() thành công");
      }).catch(e => {
        console.error("Lỗi khi play:", e);
      });
      this.elements.pauseResumeBtn.textContent = "⏸";
    } else {
      audio.pause();
      this.elements.pauseResumeBtn.textContent = "▶";
      console.log("Gọi pause()");
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
    // Fill màu động cho progressBar
    const percent = total > 0 ? (current / total) * 100 : 0;
    this.elements.progressBar.style.setProperty('--progress', percent + '%');
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

  // Hiển thị popup custom để chọn thêm vào playlist
  async showAddToPlaylistPopup(songId) {
    console.log("showAddToPlaylistPopup called, currentUser:", this.state.currentUser);
    if (!this.state.currentUser) {
      this.showNotification("Vui lòng đăng nhập để sử dụng tính năng này", "warning");
      return;
    }
    // Xóa popup cũ nếu có
    const oldPopup = document.getElementById("add-to-playlist-popup");
    if (oldPopup) oldPopup.remove();

    // Tạo popup
    const popup = document.createElement("div");
    popup.id = "add-to-playlist-popup";
    popup.className = "custom-popup";
    popup.innerHTML = `
      <div class="popup-content">
        <h3>Thêm bài hát vào playlist</h3>
        <button id="createNewPlaylistBtn">Tạo playlist mới</button>
        <div style="margin: 10px 0;">Hoặc chọn playlist đã có:</div>
        <div id="userPlaylistsList">Đang tải...</div>
        <button id="closePopupBtn" style="margin-top:10px;">Đóng</button>
      </div>
    `;
    document.body.appendChild(popup);

    // Đóng popup
    document.getElementById("closePopupBtn").onclick = () => popup.remove();

    // Xử lý tạo playlist mới
    document.getElementById("createNewPlaylistBtn").onclick = async () => {
      this.showCreatePlaylistPopup(songId ?? this.getCurrentSongId());
      popup.remove();
    };

    // ✅ LẤY auth_user_id
    const { data: { user } } = await this.supabase.auth.getUser();

    if (!user) {
      this.showNotification("Phiên đăng nhập hết hạn", "warning");
      return;
    }

    // Lấy danh sách playlist của user
    const { data: playlists, error } = await this.supabase
      .from("playlist")
      .select("id, name")
      .eq("user_id", user.id); // ✅ Dùng user.id từ auth
    const listDiv = document.getElementById("userPlaylistsList");
    listDiv.innerHTML = "";
    if (error || !playlists || playlists.length === 0) {
      listDiv.innerHTML = "<i>Bạn chưa có playlist nào.</i>";
    } else {
      playlists.forEach(pl => {
        const btn = document.createElement("button");
        btn.textContent = pl.name;
        btn.onclick = async () => {
          await this.addSongToPlaylist(songId ?? this.getCurrentSongId(), pl.id);
          this.showNotification("Đã thêm vào playlist!", "success");
          popup.remove();
        };
        listDiv.appendChild(btn);
      });
    }
  }

  // Lấy id bài hát đang phát
  getCurrentSongId() {
    const song = this.state.currentPlaylist[this.state.currentIndex];
    console.log("getCurrentSongId:", song);
    return song?.id;
  }

  async showCreatePlaylistPopup(songId = null) {
    // Xóa popup cũ nếu có
    const oldPopup = document.getElementById("create-playlist-popup");
    if (oldPopup) oldPopup.remove();

    // Tạo popup
    const popup = document.createElement("div");
    popup.id = "create-playlist-popup";
    popup.className = "custom-popup";
    popup.innerHTML = `
      <div class="popup-content">
        <h3>Tạo playlist mới</h3>
        <input id="newPlaylistName" type="text" placeholder="Nhập tên playlist..." style="width:90%;padding:8px;margin-bottom:12px;border-radius:6px;border:1px solid #00ffff;background:#111;color:#fff;" />
        <div style="text-align:right;">
          <button id="cancelCreatePlaylistBtn">Hủy</button>
          <button id="confirmCreatePlaylistBtn" style="margin-left:8px;">Tạo</button>
        </div>
      </div>
    `;
    document.body.appendChild(popup);

    document.getElementById("cancelCreatePlaylistBtn").onclick = () => popup.remove();
    document.getElementById("confirmCreatePlaylistBtn").onclick = async () => {
      const name = document.getElementById("newPlaylistName").value.trim();
      if (!name) {
        this.showNotification("Vui lòng nhập tên playlist", "warning");
        return;
      }
      const playlist = await this.createPlaylist(name);
      if (playlist && playlist.id) {
        if (songId) {
          await this.addSongToPlaylist(songId, playlist.id);
          this.showNotification("Đã tạo playlist và thêm bài hát thành công!", "success");
        } else {
          this.showNotification("Tạo playlist thành công!", "success");
        }
        popup.remove();
        await this.loadCategory("playlist", "Playlist của bạn");
      }
    };
  }
}

// Have to be exported for entry point