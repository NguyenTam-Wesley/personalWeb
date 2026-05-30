import { supabase } from "../supabase/supabase.js";
import { User } from "../supabase/user.js";
import {
  musicIcon,
  setMusicIcon,
  setPlayPauseIcon,
  categoryIconName,
  getNotificationIconMarkup
} from "./music-icons.js";

export class MusicPlayer {
  constructor() {
    console.trace("MusicPlayer constructor called");
    // Sử dụng supabase từ file supabase.js
    this.supabase = supabase;
    
    // State management (UI state - giữ nguyên)
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

    // 🎧 Player State (MỚI - Spotify-level)
    this.player = {
      fullPlaylist: [],      // playlist gốc (artist / album / playlist)
      activePlaylist: [],    // playlist đang phát (search / shuffle)
      queue: [],             // ⭐ HÀNG ĐỢI TOÀN CỤC (Spotify-core)
      originalQueue: [],     // lưu queue gốc để restore khi shuffle OFF
      queueIndex: -1,        // vị trí hiện tại trong queue
      currentSong: null,     // object bài hát đang phát (full info)
      currentTrackId: null,  // ID bài đang phát (for compatibility)
      currentIndex: -1,      // index trong activePlaylist
      playContext: null,     // artist | playlist | search | shuffle
    };

    // Infinite scroll state
    this.infinite = {
      page: 1,
      pageSize: 100,
      loading: false,
      hasMore: true
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
      addToPlaylistBtn: document.getElementById("addToPlaylistBtn"),
      musicList: document.getElementById("musicList"),
      searchInput: document.getElementById("searchInput"),
      filterContainer: document.getElementById("filterContainer"),
      emptyState: document.getElementById("emptyState"),
      loadingState: document.getElementById("loadingState"),
      // Queue Panel Elements
      queuePanel: document.getElementById("queuePanel"),
      queueToggleBtn: document.getElementById("queueToggleBtn"),
      queueList: document.getElementById("queueList"),
      clearQueueBtn: document.getElementById("clearQueueBtn"),
      closeQueueBtn: document.getElementById("closeQueueBtn")
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

    // Initialize button states
    this.updateButtons();
    setPlayPauseIcon(this.elements.pauseResumeBtn, "play");
    setMusicIcon(this.elements.prevBtn, "prev");
    setMusicIcon(this.elements.nextBtn, "next");
    setMusicIcon(this.elements.addToPlaylistBtn, "add");
    setMusicIcon(this.elements.eraserBtn, "pencil");
    setMusicIcon(this.elements.clearQueueBtn, "clear");
    setMusicIcon(this.elements.closeQueueBtn, "close");
    const queueToggleIcon = this.elements.queueToggleBtn.querySelector(".music-queue-toggle-icon");
    if (queueToggleIcon) setMusicIcon(queueToggleIcon, "queue");

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
    if (this.elements.loadingState) {
      this.elements.loadingState.style.display = "flex";
    }
  }

  hideLoading() {
    this.state.isLoading = false;
    if (this.elements.loadingState) {
      this.elements.loadingState.style.display = "none";
    }
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
  initPageIcons() {
    const searchIcon = document.querySelector(".music-search-icon");
    if (searchIcon) searchIcon.innerHTML = musicIcon("search");

    const emptyIcon = document.querySelector("#emptyState .empty-state-icon");
    if (emptyIcon) emptyIcon.innerHTML = musicIcon("empty");

    const queueEmptyIcon = document.querySelector("#queueList .queue-empty-icon");
    if (queueEmptyIcon) queueEmptyIcon.innerHTML = musicIcon("empty");

    const statusIcon = document.querySelector(".music-status-badge-icon");
    if (statusIcon) statusIcon.innerHTML = musicIcon("statusReady");

    const sysIcon = document.querySelector(".music-monitor-sys-icon");
    if (sysIcon) sysIcon.innerHTML = musicIcon("statusOnline");
  }

  async init() {
    try {
      this.initPageIcons();
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
        const currentSongId = this.getCurrentSongId();
        if (currentSongId) {
          this.showAddToPlaylistPopup(currentSongId);
        } else {
          this.showNotification("Chưa có bài hát nào đang phát", "warning");
        }
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
      setMusicIcon(this.elements.eraserBtn, this.state.erasing ? "eraser" : "pencil");
    });

    // Navigation
    this.elements.backBtn.addEventListener("click", () => this.handleBackNavigation());

    // Player events
    this.elements.musicPlayer.addEventListener("ended", () => this.handleSongEnd());
    this.elements.musicPlayer.addEventListener("timeupdate", () => this.updateProgress());

    // Keyboard support - Space = play/pause
    document.addEventListener("keydown", (e) => {
      if (e.code === "Space" && e.target.tagName !== "INPUT" && e.target.tagName !== "TEXTAREA") {
        e.preventDefault();
        this.togglePlayPause();
      }
    });

    // Search input
    const searchInput = document.getElementById("searchInput");
    if (searchInput) {
      searchInput.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
          searchInput.value = "";
          searchInput.blur();
        }
      });
    }

    // Queue Panel Events
    this.elements.queueToggleBtn.addEventListener("click", () => this.toggleQueuePanel());
    this.elements.clearQueueBtn.addEventListener("click", () => this.clearQueue());
    this.elements.closeQueueBtn.addEventListener("click", () => this.hideQueuePanel());

    // Close panel when clicking outside
    document.addEventListener("click", (e) => {
      if (!this.elements.queuePanel.contains(e.target) &&
          !this.elements.queueToggleBtn.contains(e.target) &&
          this.elements.queuePanel.classList.contains("open")) {
        this.hideQueuePanel();
      }
    });
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
    return getNotificationIconMarkup(type);
  }

  buildMenuItem(label, type) {
    const menuItem = document.createElement("div");
    menuItem.className = "menu-item";
    menuItem.innerHTML = `<span class="menu-item-icon">${musicIcon(categoryIconName(type))}</span><span class="menu-item-label">${label}</span>`;
    menuItem.setAttribute("role", "button");
    menuItem.setAttribute("tabindex", "0");
    menuItem.setAttribute("aria-label", label);
    menuItem.addEventListener("click", () => {
      this.loadCategory(type, label);
    });
    menuItem.addEventListener("keypress", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        this.loadCategory(type, label);
      }
    });
    return menuItem;
  }

  // Main Menu với phân trang
  async loadMainMenu(page = 1, pageSize = 8) {
    try {
      this.showLoading();
      this.elements.mainMenu.innerHTML = "";
      this.elements.mainMenu.style.display = "flex";
      this.elements.playlistContainer.style.display = "none";

      // Clear search
      const searchInput = document.getElementById("searchInput");
      if (searchInput) {
        searchInput.value = "";
        searchInput.placeholder = "Tìm kiếm danh mục...";
      }

      // Clear music list
      const musicList = document.getElementById("musicList");
      if (musicList) {
        musicList.innerHTML = "";
      }

      const emptyState = document.getElementById("emptyState");
      if (emptyState) {
        emptyState.style.display = "none";
      }

      if (!this.state.controlsShownOnce) {
        this.elements.controlsContainer.style.display = "none";
      }

      this.elements.backBtn.style.display = "none";

      const categories = [
        { label: "Nghệ sĩ", type: "artist" },
        { label: "Thể loại", type: "genre" },
        { label: "Khu vực", type: "region" },
        { label: "Playlist", type: "playlist" }
      ];

      // Phân trang
      const totalPages = Math.ceil(categories.length / pageSize);
      const startIdx = (page - 1) * pageSize;
      const endIdx = startIdx + pageSize;
      const pageCategories = categories.slice(startIdx, endIdx);

      const fragment = document.createDocumentFragment();
      pageCategories.forEach(({ label, type }) => {
        fragment.appendChild(this.buildMenuItem(label, type));
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

      this.state.navigationStack = [{ view: "main" }];
      this.saveNavigationState();

      // Setup search for main menu categories only when in main view
      if (this.state.currentView !== "category") {
        this.setupMainMenuSearch();
      }
    } catch (error) {
      this.handleError(error, "Lỗi tải menu chính");
    } finally {
      this.hideLoading();
    }
  }

  // Category Loading
  async loadCategory(type, displayTitle, fromBack = false) {
    try {
      this.showLoading();

      this.elements.mainMenu.innerHTML = "";
      this.elements.mainMenu.style.display = "flex";
      this.elements.playlistContainer.style.display = "none";
      this.elements.backBtn.style.display = "inline-block";

      if (!fromBack) {
        this.state.navigationStack.push({ view: "category", type, displayTitle });
        this.saveNavigationState();
      }

      // Reset infinite scroll state
      this.infinite = {
        page: 1,
        pageSize: 100,
        loading: false,
        hasMore: true
      };

      // Special case for playlist
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

        // Thêm container cho danh sách playlist với infinite scroll
        const playlistList = document.createElement("div");
        playlistList.className = "playlist-list category-container"; // Thêm category-container class
        playlistSection.appendChild(playlistList);
        this.elements.mainMenu.appendChild(playlistSection);

        // Load first page
        await this.loadCategoryPage(type);

        // Setup infinite scroll
        this.setupInfiniteScroll(() => this.loadCategoryPage(type));
        return;
      }

      // For other categories (artist, genre, region) - use infinite scroll
      await this.loadCategoryPage(type);

      // Setup infinite scroll
      this.setupInfiniteScroll(() => this.loadCategoryPage(type));

      // Setup search for this category
      this.setupCategorySearch(type);
    } catch (error) {
      this.handleError(error, `Lỗi tải dữ liệu ${displayTitle}`);
    } finally {
      this.hideLoading();
    }
  }

  // Infinite Scroll - Load one page of category items
  async loadCategoryPage(type) {
    if (this.infinite.loading || !this.infinite.hasMore) return;

    this.infinite.loading = true;

    const { page, pageSize } = this.infinite;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = this.supabase
      .from(type)
      .select("id, name")
      .order("name", { ascending: true })
      .range(from, to);

    // Special case for playlist - filter by user_id and order by created_at
    if (type === "playlist") {
      const { data: { user } } = await this.supabase.auth.getUser();
      if (!user) {
        this.infinite.loading = false;
        return;
      }
      query = this.supabase
        .from("playlist")
        .select("id, name")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .range(from, to);
    }

    const { data, error } = await query;

    if (error) {
      this.infinite.loading = false;
      throw error;
    }

    if (!data || data.length < pageSize) {
      this.infinite.hasMore = false;
    }

    const fragment = document.createDocumentFragment();
    data.forEach(item => {
      const btn = this.createButton(
        item.name,
        "category-item",
        () => this.loadSongsByCategory(type, item.id, item.name),
        true
      );
      fragment.appendChild(btn);
    });

    // Find the correct container to append to
    if (type === "playlist") {
      const playlistList = this.elements.mainMenu.querySelector(".playlist-list");
      if (playlistList) {
        playlistList.appendChild(fragment);
      }
    } else {
      this.elements.mainMenu.appendChild(fragment);
    }

    this.infinite.page++;
    this.infinite.loading = false;
  }

  // Setup infinite scroll listener
  setupInfiniteScroll(loadMoreFn) {
    const container = this.elements.mainMenu.querySelector(".category-container") || this.elements.mainMenu;

    const onScroll = () => {
      const nearBottom =
        container.scrollTop + container.clientHeight >=
        container.scrollHeight - 50;

      if (nearBottom) {
        loadMoreFn();
      }
    };

    // Remove existing scroll listener if any
    if (container.onscroll) {
      container.onscroll = null;
    }

    container.onscroll = onScroll;
  }

  // Song Loading - Updated with new UI format
  async loadSongsByCategory(type, id, displayName, fromBack = false) {
    try {
      this.showLoading();
      this.elements.mainMenu.style.display = "none";
      this.elements.playlistContainer.style.display = "block";
      this.elements.backBtn.style.display = "inline-block";

      const musicList = document.getElementById("musicList");
      const emptyState = document.getElementById("emptyState");
      const loadingState = document.getElementById("loadingState");

      if (musicList) musicList.innerHTML = "";
      if (emptyState) emptyState.style.display = "none";
      if (loadingState) loadingState.style.display = "flex";

      this.elements.playlistContainer.textContent = displayName;

      if (!fromBack) {
        this.state.navigationStack.push({ view: "songs", type, id, displayName });
        this.saveNavigationState();
      }

      // Nếu là playlist, lưu lại thông tin vào state
      if (type === "playlist") {
        this.state.currentView = "playlistSongs";
        this.state.currentPlaylistId = id;
        this.state.currentPlaylistName = displayName;
      }

      let data = [];
      if (type === "playlist") {
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

      // UI state (giữ nguyên)
      this.state.currentPlaylist = data;
      this.state.currentIndex = -1;

      // 🎧 Player state (MỚI)
      this.player.fullPlaylist = data;
      this.player.activePlaylist = data;
      this.player.currentTrackId = null;
      this.player.currentIndex = -1;
      this.player.playContext = type;

      if (!data || data.length === 0) {
        if (emptyState) emptyState.style.display = "block";
        if (loadingState) loadingState.style.display = "none";
        return;
      }

      this.renderMusicList(data, type, id);
      this.setupSearchAndFilter(data, type, id);
    } catch (error) {
      this.handleError(error, "Lỗi tải bài hát");
    } finally {
      this.hideLoading();
      const loadingState = document.getElementById("loadingState");
      if (loadingState) loadingState.style.display = "none";
    }
  }

  // Render music list with new UI format
  renderMusicList(songs, type, categoryId) {
    const musicList = document.getElementById("musicList");
    if (!musicList) return;

    musicList.innerHTML = "";
    const fragment = document.createDocumentFragment();

    songs.forEach((song, index) => {
      const item = this.createMusicItem(song, index, type, categoryId);
      fragment.appendChild(item);
    });

    musicList.appendChild(fragment);
    this.elements.controlsContainer.style.display = "block";
    this.state.controlsShownOnce = true;
  }

  // Create music item with new format
  createMusicItem(song, index, type, categoryId) {
    const item = document.createElement("div");
    item.className = "music-item";
    item.setAttribute("data-song-id", song.id);
    item.setAttribute("data-index", index);
    item.setAttribute("tabindex", "0");
    item.setAttribute("role", "button");
    item.setAttribute("aria-label", `Phát ${song.song_name} - ${song.artist?.name || "Unknown"}`);

    // Thumbnail placeholder
    const thumbnail = document.createElement("div");
    thumbnail.className = "music-thumbnail music-thumbnail--icon";
    thumbnail.innerHTML = musicIcon("track");

    // Song info
    const info = document.createElement("div");
    info.className = "music-info";
    
    const name = document.createElement("div");
    name.className = "music-name";
    name.textContent = song.song_name || "Unknown";
    
    const artist = document.createElement("div");
    artist.className = "music-artist";
    artist.textContent = song.artist?.name || song.genre?.name || song.region?.name || "Unknown";
    
    info.appendChild(name);
    info.appendChild(artist);

    // Actions (Add to playlist button)
    const actions = document.createElement("div");
    actions.className = "music-item-actions";
    
    // Add to playlist button (only show if user is logged in and not viewing own playlist)
    if (this.state.currentUserRole !== "guest" && type !== "playlist") {
      const addBtn = document.createElement("button");
      addBtn.className = "add-to-playlist-btn";
      addBtn.setAttribute("aria-label", `Thêm ${song.song_name} vào playlist`);
      setMusicIcon(addBtn, "add");
      addBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.showAddToPlaylistPopup(song.id);
      });
      actions.appendChild(addBtn);
    }

    // Remove from playlist button (only show when viewing user's own playlist)
    if (this.state.currentUserRole !== "guest" && type === "playlist" && this.state.currentPlaylistId) {
      const removeBtn = document.createElement("button");
      removeBtn.className = "remove-from-playlist-btn";
      removeBtn.setAttribute("aria-label", `Xóa ${song.song_name} khỏi playlist`);
      removeBtn.setAttribute("title", "Xóa khỏi playlist");
      setMusicIcon(removeBtn, "remove");
      removeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (confirm(`Xóa "${song.song_name}" khỏi playlist?`)) {
          this.deleteSongFromPlaylist(song.id, this.state.currentPlaylistId, this.state.currentPlaylistName);
        }
      });
      actions.appendChild(removeBtn);
    }

    // 🎧 Queue buttons (Spotify-style)
    // Play Next button
    const playNextBtn = document.createElement("button");
    playNextBtn.className = "queue-btn play-next-btn";
    playNextBtn.setAttribute("aria-label", `Phát ${song.song_name} tiếp theo`);
    playNextBtn.setAttribute("title", "Phát tiếp theo");
    setMusicIcon(playNextBtn, "playNext");
    playNextBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.playNext(song);
    });
    actions.appendChild(playNextBtn);

    // Add to Queue button
    const queueBtn = document.createElement("button");
    queueBtn.className = "queue-btn add-queue-btn";
    queueBtn.setAttribute("aria-label", `Thêm ${song.song_name} vào hàng đợi`);
    queueBtn.setAttribute("title", "Thêm vào hàng đợi");
    setMusicIcon(queueBtn, "queueAdd");
    queueBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.addToQueue(song);
    });
    actions.appendChild(queueBtn);

    // Play overlay
    const overlay = document.createElement("div");
    overlay.className = "music-play-overlay";
    overlay.innerHTML = musicIcon("play");

    item.appendChild(thumbnail);
    item.appendChild(info);
    item.appendChild(actions);
    item.appendChild(overlay);

    // Click handler - 100% clickable
    item.addEventListener("click", (e) => {
      // Don't trigger if clicking on add button
      if (!e.target.closest(".music-item-actions button")) {
        this.playSongById(song.id);
      }
    });

    // Keyboard support
    item.addEventListener("keypress", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        this.playSongById(song.id);
      }
    });

    return item;
  }

  // Setup search for category items
  setupCategorySearch(categoryType) {
    const searchInput = document.getElementById("searchInput");
    if (!searchInput) return;

    // Remove old listeners
    const newSearchInput = searchInput.cloneNode(true);

    // Set appropriate placeholder based on category type
    const placeholders = {
      artist: "Tìm kiếm nghệ sĩ...",
      genre: "Tìm kiếm thể loại...",
      region: "Tìm kiếm khu vực...",
      playlist: "Tìm kiếm playlist..."
    };
    newSearchInput.placeholder = placeholders[categoryType] || "Tìm kiếm...";

    searchInput.parentNode.replaceChild(newSearchInput, searchInput);
    this.elements.searchInput = newSearchInput;

    // Store category type for filtering
    this.currentCategoryType = categoryType;

    let searchTimeout;
    const handleSearch = (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        const query = e.target.value.toLowerCase().trim();
        this.filterCategoryItems(query, categoryType);
      }, 150);
    };

    newSearchInput.addEventListener("input", handleSearch);
  }

  // Filter category items
  async filterCategoryItems(query, categoryType) {
    if (!query) {
      // Reload full category if no search query
      this.resetCategoryView(categoryType);
      return;
    }

    try {
      this.showLoading();

      // Query database for filtered items
      let queryBuilder = this.supabase
        .from(categoryType)
        .select("id, name")
        .order("name", { ascending: true });

      // Add search filter
      queryBuilder = queryBuilder.ilike("name", `%${query}%`);

      // Special case for playlist - filter by user and order by created_at
      if (categoryType === "playlist") {
        const { data: { user } } = await this.supabase.auth.getUser();
        if (!user) {
          this.showNotification("Phiên đăng nhập hết hạn", "warning");
          return;
        }
        queryBuilder = this.supabase
          .from("playlist")
          .select("id, name")
          .eq("user_id", user.id)
          .ilike("name", `%${query}%`)
          .order("created_at", { ascending: false });
      }

      const { data, error } = await queryBuilder;

      if (error) throw error;

      // Clear current items
      const mainMenu = this.elements.mainMenu;
      if (mainMenu) {
        // Remove pagination if exists
        const pagination = mainMenu.querySelector('.pagination');
        if (pagination) pagination.remove();

        // Clear category items but keep the section structure for playlist
        if (categoryType === "playlist") {
          const playlistList = mainMenu.querySelector(".playlist-list");
          if (playlistList) playlistList.innerHTML = "";
        } else {
          mainMenu.innerHTML = "";
        }
      }

      // Render filtered items
      if (data && data.length > 0) {
        const fragment = document.createDocumentFragment();
        data.forEach(item => {
          const btn = this.createButton(
            item.name,
            "category-item",
            () => this.loadSongsByCategory(categoryType, item.id, item.name),
            true
          );
          fragment.appendChild(btn);
        });

        // Append to appropriate container
        if (categoryType === "playlist") {
          const playlistList = this.elements.mainMenu.querySelector(".playlist-list");
          if (playlistList) {
            playlistList.appendChild(fragment);
          }
        } else {
          this.elements.mainMenu.appendChild(fragment);
        }
      } else {
        // Show no results message
        const noResults = document.createElement("div");
        noResults.className = "no-results";
        noResults.textContent = `Không tìm thấy ${this.getCategoryDisplayName(categoryType)} nào`;
        this.elements.mainMenu.appendChild(noResults);
      }

    } catch (error) {
      this.handleError(error, "Lỗi tìm kiếm");
    } finally {
      this.hideLoading();
    }
  }

  // Reset category view to show all items
  resetCategoryView(categoryType) {
    // Reset infinite scroll state
    this.infinite = {
      page: 1,
      pageSize: 100,
      loading: false,
      hasMore: true
    };

    // Clear current content
    if (categoryType === "playlist") {
      const playlistList = this.elements.mainMenu.querySelector(".playlist-list");
      if (playlistList) playlistList.innerHTML = "";
    } else {
      this.elements.mainMenu.innerHTML = "";
    }

    // Reload first page
    this.loadCategoryPage(categoryType);
  }

  // Get display name for category type
  getCategoryDisplayName(categoryType) {
    const names = {
      artist: "nghệ sĩ",
      genre: "thể loại",
      region: "khu vực",
      playlist: "playlist"
    };
    return names[categoryType] || categoryType;
  }

  // Setup search for main menu categories
  setupMainMenuSearch() {
    const searchInput = document.getElementById("searchInput");
    if (!searchInput) return;

    // Remove old listeners
    const newSearchInput = searchInput.cloneNode(true);
    newSearchInput.placeholder = "Tìm kiếm danh mục...";
    searchInput.parentNode.replaceChild(newSearchInput, searchInput);
    this.elements.searchInput = newSearchInput;

    // Store original categories
    this.originalCategories = [
      { label: "Nghệ sĩ", type: "artist" },
      { label: "Thể loại", type: "genre" },
      { label: "Khu vực", type: "region" },
      { label: "Playlist", type: "playlist" }
    ];

    let searchTimeout;
    const handleSearch = (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        const query = e.target.value.toLowerCase().trim();
        this.filterMainMenuCategories(query);
      }, 150);
    };

    newSearchInput.addEventListener("input", handleSearch);
  }

  // Render main menu categories
  renderMainMenuCategories(categories) {
    const mainMenu = this.elements.mainMenu;
    mainMenu.innerHTML = "";

    const fragment = document.createDocumentFragment();
    categories.forEach(({ label, type }) => {
      fragment.appendChild(this.buildMenuItem(label, type));
    });
    mainMenu.appendChild(fragment);
  }

  // Filter main menu categories
  filterMainMenuCategories(query) {
    const mainMenu = this.elements.mainMenu;
    if (!mainMenu) return;

    // Clear current menu
    mainMenu.innerHTML = "";

    if (!query) {
      // Show all categories if no search query
      this.renderMainMenuCategories(this.originalCategories);
      return;
    }

    // Filter categories
    const filteredCategories = this.originalCategories.filter(category =>
      category.label.toLowerCase().includes(query) ||
      category.type.toLowerCase().includes(query)
    );

    if (filteredCategories.length === 0) {
      mainMenu.innerHTML = '<div class="no-results">Không tìm thấy danh mục nào</div>';
      return;
    }

    // Render filtered categories
    this.renderMainMenuCategories(filteredCategories);
  }

  // Setup search and filter
  setupSearchAndFilter(songs, type, categoryId) {
    const searchInput = document.getElementById("searchInput");
    const filterContainer = document.getElementById("filterContainer");

    if (!searchInput) return;

    // Update placeholder for song search
    searchInput.placeholder = "Tìm kiếm bài hát, nghệ sĩ...";

    // Store songs for filtering
    this.currentFilterSongs = songs;
    this.currentFilterType = type;
    this.currentFilterCategoryId = categoryId;

    // Remove old listeners by storing value and replacing
    const currentValue = searchInput.value;
    const newSearchInput = searchInput.cloneNode(true);
    newSearchInput.value = currentValue;
    searchInput.parentNode.replaceChild(newSearchInput, searchInput);

    // Update element reference
    this.elements.searchInput = newSearchInput;

    // Search functionality
    let searchTimeout;
    const handleSearch = (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        const query = e.target.value.toLowerCase().trim();
        if (query) {
          this.filterSongs(query, this.currentFilterSongs || songs, type, categoryId);
        } else {
          // Show all songs if search is empty
          this.renderMusicList(this.currentFilterSongs || songs, type, categoryId);
        }
      }, 150);
    };

    newSearchInput.addEventListener("input", handleSearch);

    // Clear search button (optional)
    if (currentValue) {
      handleSearch({ target: newSearchInput });
    }
  }

  // Filter songs by search query
  filterSongs(query, allSongs, type, categoryId) {
    if (!query) {
      // Clear search - quay về fullPlaylist
      this.player.activePlaylist = this.player.fullPlaylist;
      this.player.playContext = type; // artist | playlist | genre | region
      this.renderMusicList(this.player.activePlaylist, type, categoryId);
      return;
    }

    // Search active - chỉ đổi activePlaylist
    const filtered = allSongs.filter(song => {
      const name = (song.song_name || "").toLowerCase();
      const artist = (song.artist?.name || "").toLowerCase();
      const genre = (song.genre?.name || "").toLowerCase();
      return name.includes(query) || artist.includes(query) || genre.includes(query);
    });

    this.player.activePlaylist = filtered;
    this.player.playContext = "search";

    this.renderMusicList(filtered, type, categoryId);
  }

  // Update playing state
  updatePlayingState() {
    const items = document.querySelectorAll(".music-item");
    items.forEach((item) => {
      const songId = item.getAttribute("data-song-id");
      if (songId == this.player.currentTrackId) {
        item.classList.add("playing");
        item.setAttribute("aria-current", "true");
      } else {
        item.classList.remove("playing");
        item.removeAttribute("aria-current");
      }
    });
  }

  // Helper Methods
  createButton(text, className, onClick, useInnerWrapper = false) {
    if (className === "category-item" && useInnerWrapper) {
      // Tạo structure giống game card cho category-item
      const card = document.createElement("div");
      card.className = className;

      const inner = document.createElement("div");
      inner.className = "category-item-inner";

      const span = document.createElement("span");
      span.textContent = text;

      inner.appendChild(span);
      card.appendChild(inner);

      card.addEventListener("click", onClick);
      return card;
    } else {
      const btn = document.createElement("button");
      btn.textContent = text;
      btn.className = className;
      btn.addEventListener("click", onClick);
      return btn;
    }
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

    this.state.currentIndex = index;
    this.elements.musicPlayer.src = song.url;
    const artistName = song.artist?.name || "Không rõ nghệ sĩ";
    this.elements.currentSongTitle.textContent = `${song.song_name} - ${artistName}`;

    this.elements.musicPlayer.play().then(() => {
      console.log("play() trong playSong thành công");
      this.updatePlayingState();
    }).catch(error => {
      this.handleError(error, "Không thể phát bài hát này");
    });

    setPlayPauseIcon(this.elements.pauseResumeBtn, "pause");
    this.elements.pauseResumeBtn.setAttribute("aria-label", "Tạm dừng");

    // Luôn hiển thị controls khi phát bài hát
    this.elements.controlsContainer.style.display = "block";
    this.state.controlsShownOnce = true;
  }

  // 🎧 ID-based playback (Spotify-level)
  playSongById(songId, fromQueue = false) {
    // Tìm song object từ các nguồn có thể
    let song = null;

    // Ưu tiên tìm trong activePlaylist
    song = this.player.activePlaylist.find(s => s.id === songId);

    // Nếu không thấy, tìm trong fullPlaylist
    if (!song) {
      song = this.player.fullPlaylist.find(s => s.id === songId);
    }

    // Nếu không thấy, tìm trong queue
    if (!song) {
      song = this.player.queue.find(s => s.id === songId);
    }

    if (!song) {
      console.warn("Song not found:", songId);
      return;
    }

    // Update player state
    this.player.currentSong = song;
    this.player.currentTrackId = songId;

    // Sync UI state
    const activeIndex = this.player.activePlaylist.findIndex(s => s.id === songId);
    if (activeIndex !== -1) {
      this.player.currentIndex = activeIndex;
      this.state.currentIndex = activeIndex;
    }

    // Queue navigation logic
    if (!fromQueue) {
      this.player.queueIndex = -1; // Reset queue navigation for manual selection
    }

    this._playFromPlayer(activeIndex !== -1 ? activeIndex : 0);
  }

  // 🧩 Tách logic phát nhạc ra (internal method)
  _playFromPlayer(index) {
    const song = this.player.currentSong;
    if (!song) return;

    this.elements.musicPlayer.src = song.url;
    const artistName = song.artist?.name || "Không rõ nghệ sĩ";
    this.elements.currentSongTitle.textContent = `${song.song_name} - ${artistName}`;

    this.elements.musicPlayer.play().then(() => {
      console.log("_playFromPlayer: play() thành công");
      this.updatePlayingState();
    }).catch(error => {
      this.handleError(error, "Không thể phát bài hát này");
    });

    setPlayPauseIcon(this.elements.pauseResumeBtn, "pause");
    this.elements.pauseResumeBtn.setAttribute("aria-label", "Tạm dừng");

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
        setPlayPauseIcon(this.elements.pauseResumeBtn, "pause");
        this.elements.pauseResumeBtn.setAttribute("aria-label", "Tạm dừng");
      }).catch(e => {
        console.error("Lỗi khi play:", e);
      });
    } else {
      audio.pause();
      setPlayPauseIcon(this.elements.pauseResumeBtn, "play");
      this.elements.pauseResumeBtn.setAttribute("aria-label", "Phát");
      console.log("Gọi pause()");
    }
  }

  playNextSong() {
    // 🔥 1. Ưu tiên queue nếu có items (Spotify-core)
    if (this.player.queue.length > 0) {
      // Nếu chưa có queueIndex (chưa activate queue mode), tìm vị trí currentSong trong queue
      if (this.player.queueIndex === -1 && this.player.currentSong) {
        this.player.queueIndex = this.player.queue.findIndex(s => s.id === this.player.currentSong.id);
        // Nếu không tìm thấy, set về 0
        if (this.player.queueIndex === -1) {
          this.player.queueIndex = 0;
        }
      }

      if (this.state.isShuffle && this.player.playContext === "shuffle-queue") {
        // 🎲 Shuffle mode trong queue → random next
        let randomIndex;
        do {
          randomIndex = Math.floor(Math.random() * this.player.queue.length);
        } while (randomIndex === this.player.queueIndex && this.player.queue.length > 1);

        const nextSong = this.player.queue[randomIndex];
        this.player.queueIndex = randomIndex;
        this.playSongById(nextSong.id, true);
        return;
      } else {
        // Sequential mode trong queue
        if (this.player.queueIndex + 1 < this.player.queue.length) {
          const nextQueueIndex = this.player.queueIndex + 1;
          const nextSong = this.player.queue[nextQueueIndex];
          this.player.queueIndex = nextQueueIndex;
          this.playSongById(nextSong.id, true);
          return;
        }
      }
    }

    // 🔁 2. Hết queue hoặc không có queue → fallback về activePlaylist
    const list = this.player.activePlaylist;
    if (!list.length) return;

    if (this.state.isShuffle) {
      // Shuffle mode trong playlist → random
      let randomIndex;
      do {
        randomIndex = Math.floor(Math.random() * list.length);
      } while (randomIndex === this.player.currentIndex && list.length > 1);

      this.playSongById(list[randomIndex].id, false);
    } else {
      // Sequential mode trong playlist
      let nextIndex = this.player.currentIndex + 1;
      if (nextIndex >= list.length) nextIndex = 0;
      this.playSongById(list[nextIndex].id, false);
    }
  }

  playPrevSong() {
    // 🔥 1. Ưu tiên queue nếu có items (Spotify-core)
    if (this.player.queue.length > 0) {
      // Nếu chưa có queueIndex (chưa activate queue mode), tìm vị trí currentSong trong queue
      if (this.player.queueIndex === -1 && this.player.currentSong) {
        this.player.queueIndex = this.player.queue.findIndex(s => s.id === this.player.currentSong.id);
        // Nếu không tìm thấy, set về cuối queue
        if (this.player.queueIndex === -1) {
          this.player.queueIndex = this.player.queue.length - 1;
        }
      }

      if (this.state.isShuffle && this.player.playContext === "shuffle-queue") {
        // 🎲 Shuffle mode trong queue → random prev
        let randomIndex;
        do {
          randomIndex = Math.floor(Math.random() * this.player.queue.length);
        } while (randomIndex === this.player.queueIndex && this.player.queue.length > 1);

        const prevSong = this.player.queue[randomIndex];
        this.player.queueIndex = randomIndex;
        this.playSongById(prevSong.id, true);
        return;
      } else {
        // Sequential mode trong queue
        if (this.player.queueIndex > 0) {
          const prevQueueIndex = this.player.queueIndex - 1;
          const prevSong = this.player.queue[prevQueueIndex];
          this.player.queueIndex = prevQueueIndex;
          this.playSongById(prevSong.id, true);
          return;
        }
      }
    }

    // 🔁 2. Đầu queue hoặc không có queue → fallback về activePlaylist
    const list = this.player.activePlaylist;
    if (!list.length) return;

    if (this.state.isShuffle) {
      // Shuffle mode trong playlist → random
      let randomIndex;
      do {
        randomIndex = Math.floor(Math.random() * list.length);
      } while (randomIndex === this.player.currentIndex && list.length > 1);

      this.playSongById(list[randomIndex].id, false);
    } else {
      // Sequential mode trong playlist
      let prevIndex = this.player.currentIndex - 1;
      if (prevIndex < 0) prevIndex = list.length - 1;
      this.playSongById(list[prevIndex].id, false);
    }
  }

  toggleRepeat() {
    this.state.isRepeat = !this.state.isRepeat;
    if (this.state.isRepeat) this.state.isShuffle = false;
    this.updateButtons();
  }

  toggleShuffle() {
    this.state.isShuffle = !this.state.isShuffle;
    if (this.state.isShuffle) this.state.isRepeat = false;

    if (this.state.isShuffle) {
      // 🎵 Shuffle ON
      if (this.player.queue.length > 0 && this.player.queueIndex >= 0) {
        // Có queue active → shuffle queue
        this.player.originalQueue = [...this.player.queue]; // lưu bản gốc
        this.player.queue = this.shuffleArray([...this.player.queue]);
        // Reset queueIndex về đầu để bắt đầu từ bài đầu tiên của shuffled queue
        this.player.queueIndex = 0;
        this.player.playContext = "shuffle-queue";
      } else {
        // Không có queue → shuffle activePlaylist như cũ
        this.player.activePlaylist = this.shuffleArray([...this.player.activePlaylist]);
        this.player.playContext = "shuffle";
        // Update current index
        if (this.player.currentTrackId) {
          this.player.currentIndex = this.player.activePlaylist.findIndex(s => s.id === this.player.currentTrackId);
        }
      }
    } else {
      // 🎵 Shuffle OFF
      if (this.player.originalQueue.length > 0) {
        // Có originalQueue → restore queue
        this.player.queue = [...this.player.originalQueue];
        this.player.originalQueue = [];
        // Tìm lại vị trí currentSong trong restored queue
        if (this.player.currentSong) {
          this.player.queueIndex = this.player.queue.findIndex(s => s.id === this.player.currentSong.id);
        }
        this.player.playContext = "queue";
      } else {
        // Không có originalQueue → restore activePlaylist như cũ
        if (this.player.playContext === "search") {
          const currentSearchResults = this.player.activePlaylist;
          this.player.activePlaylist = [...this.player.fullPlaylist].filter(song =>
            currentSearchResults.some(s => s.id === song.id)
          );
        } else {
          this.player.activePlaylist = [...this.player.fullPlaylist];
          this.player.playContext = this.state.currentView || "playlist";
        }
        // Update current index
        if (this.player.currentTrackId) {
          this.player.currentIndex = this.player.activePlaylist.findIndex(s => s.id === this.player.currentTrackId);
        }
      }
    }

    this.updateButtons();
  }

  // Fisher-Yates shuffle algorithm
  shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  // 🎧 QUEUE API - Spotify-level
  playNext(song) {
    // Không cho trùng bài đang phát
    if (song.id === this.player.currentSong?.id) {
      this.showNotification("Bài hát đang phát", "warning");
      return;
    }

    // Xóa trùng trong queue nếu có
    this.player.queue = this.player.queue.filter(s => s.id !== song.id);

    // 🎯 Logic chuẩn Spotify cho Play Next
    if (this.player.queue.length === 0 || this.player.queueIndex === -1) {
      // Chưa có queue active → Tạo queue mới với bài hiện tại + bài mới
      if (this.player.currentSong) {
        this.player.queue = [this.player.currentSong, song];
        this.player.queueIndex = 0; // đang phát bài đầu (currentSong)
      } else {
        // Không có bài hiện tại, chỉ phát bài mới luôn
        this.playSongById(song.id);
        return;
      }
    } else {
      // Đã có queue active → Insert vào vị trí tiếp theo
      const insertPosition = this.player.queueIndex + 1;
      this.player.queue.splice(insertPosition, 0, song);
    }

    this.updateQueueDisplay();
    this.showNotification(`⏭️ Sẽ phát tiếp: ${song.song_name}`, "info");
  }

  addToQueue(song) {
    // Không thêm trùng (đã có trong queue hoặc đang phát)
    const exists =
      this.player.queue.some(s => s.id === song.id) ||
      song.id === this.player.currentSong?.id;

    if (exists) {
      this.showNotification("Bài hát đã có trong hàng đợi", "warning");
      return;
    }

    // 🎯 Chỉ thêm vào cuối queue (append)
    this.player.queue.push(song);
    this.updateQueueDisplay();
    this.showNotification(`➕ Đã thêm vào hàng đợi: ${song.song_name}`, "success");
  }

  removeFromQueue(songId) {
    this.player.queue = this.player.queue.filter(s => s.id !== songId);
    this.updateQueueDisplay();
    this.showNotification("Đã xóa khỏi hàng đợi", "info");
  }

  clearQueue() {
    this.player.queue = [];
    this.player.originalQueue = [];
    this.player.queueIndex = -1;
    this.player.playContext = this.player.playContext === "shuffle-queue" ? "shuffle" : this.player.playContext;
    this.updateQueueDisplay();
    this.showNotification("🧹 Đã xóa hàng đợi", "info");
  }

  // 🎵 Play All - Reset queue với danh sách hiện tại
  playAllSongs(songList = null) {
    const listToPlay = songList || this.player.activePlaylist;
    if (!listToPlay.length) return;

    // 🔄 Reset queue hoàn toàn
    this.player.queue = [...listToPlay];
    this.player.originalQueue = [...listToPlay]; // lưu bản gốc
    this.player.queueIndex = 0;

    // Phát bài đầu tiên
    this.playSongById(listToPlay[0].id, true); // fromQueue = true
    this.updateQueueDisplay();

    this.showNotification(`🎵 Phát tất cả (${listToPlay.length} bài)`, "success");
  }

  // 🎛️ Queue Panel Management
  toggleQueuePanel() {
    if (this.elements.queuePanel.classList.contains("open")) {
      this.hideQueuePanel();
    } else {
      this.showQueuePanel();
    }
  }

  showQueuePanel() {
    this.elements.queuePanel.classList.add("open");
    this.elements.queueToggleBtn.classList.add("panel-open");
    this.updateQueueDisplay();
  }

  hideQueuePanel() {
    this.elements.queuePanel.classList.remove("open");
    this.elements.queueToggleBtn.classList.remove("panel-open");
  }

  updateQueueDisplay() {
    const queueList = this.elements.queueList;
    const queueCount = this.player.queue.length;

    // Update toggle button count
    this.elements.queueToggleBtn.querySelector(".queue-count").textContent = queueCount;

    // Update shuffle indicator
    const isShuffleQueue = this.state.isShuffle && this.player.playContext === "shuffle-queue";
    this.elements.queueToggleBtn.classList.toggle("shuffle-active", isShuffleQueue);

    if (queueCount === 0) {
      queueList.innerHTML = `
        <div class="queue-empty">
          <div class="queue-empty-icon">${musicIcon("empty")}</div>
          <div class="queue-empty-text">Hàng đợi trống</div>
          <div class="queue-empty-hint">Thêm bài hát để tạo hàng đợi</div>
        </div>
      `;
      return;
    }

    const fragment = document.createDocumentFragment();
    this.player.queue.forEach((song, index) => {
      const item = this.createQueueItem(song, index);
      fragment.appendChild(item);
    });

    queueList.innerHTML = "";
    queueList.appendChild(fragment);

    // Setup drag & drop
    this.setupQueueDragDrop();
  }

  createQueueItem(song, index) {
    const item = document.createElement("div");
    item.className = `queue-item ${index === this.player.queueIndex ? 'playing' : ''}`;
    item.setAttribute("data-song-id", song.id);
    item.setAttribute("data-index", index);
    item.setAttribute("draggable", "true");

    item.innerHTML = `
      <div class="queue-item-number">${index + 1}</div>
      <div class="queue-item-info">
        <div class="queue-item-name">${song.song_name}</div>
        <div class="queue-item-artist">${song.artist?.name || "Unknown"}</div>
      </div>
      <div class="queue-item-actions">
        <button class="queue-item-remove" title="Xóa khỏi hàng đợi" data-song-id="${song.id}" aria-label="Xóa khỏi hàng đợi">
          ${musicIcon("close")}
        </button>
      </div>
    `;

    // Remove button event
    const removeBtn = item.querySelector(".queue-item-remove");
    removeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.removeFromQueue(song.id);
      this.updateQueueDisplay();
    });

    // Click to play (từ queue context)
    item.addEventListener("click", () => {
      const queueIndex = this.player.queue.findIndex(s => s.id === song.id);
      if (queueIndex !== -1) {
        this.player.queueIndex = queueIndex;
        this.playSongById(song.id, true); // fromQueue = true
      } else {
        this.playSongById(song.id, false); // fallback
      }
    });

    return item;
  }

  setupQueueDragDrop() {
    const items = this.elements.queueList.querySelectorAll(".queue-item");
    let draggedElement = null;
    let placeholder = null;

    items.forEach((item, index) => {
      // Drag start
      item.addEventListener("dragstart", (e) => {
        draggedElement = item;
        item.classList.add("dragging");

        // Create placeholder
        placeholder = document.createElement("div");
        placeholder.className = "queue-item drag-placeholder";
        placeholder.style.height = item.offsetHeight + "px";
        placeholder.innerHTML = `<div class="queue-drag-hint">${musicIcon("drag")}<span>Kéo thả để sắp xếp</span></div>`;

        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/html", item.outerHTML);
      });

      // Drag end
      item.addEventListener("dragend", () => {
        item.classList.remove("dragging");
        if (placeholder) {
          placeholder.remove();
          placeholder = null;
        }
        draggedElement = null;
        this.updateQueueDisplay(); // Refresh numbers
      });

      // Drag over
      item.addEventListener("dragover", (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";

        if (item !== draggedElement && draggedElement) {
          const rect = item.getBoundingClientRect();
          const midpoint = rect.top + rect.height / 2;

          if (e.clientY < midpoint) {
            // Insert before
            item.parentNode.insertBefore(placeholder || draggedElement, item);
          } else {
            // Insert after
            item.parentNode.insertBefore(placeholder || draggedElement, item.nextSibling);
          }
        }
      });

      // Drop
      item.addEventListener("drop", (e) => {
        e.preventDefault();

        if (draggedElement && draggedElement !== item) {
          const draggedIndex = parseInt(draggedElement.getAttribute("data-index"));
          const targetIndex = parseInt(item.getAttribute("data-index"));

          // Reorder queue array
          const [removed] = this.player.queue.splice(draggedIndex, 1);
          this.player.queue.splice(targetIndex, 0, removed);

          // Update queueIndex if affected
          if (this.player.queueIndex >= targetIndex && this.player.queueIndex < draggedIndex) {
            this.player.queueIndex++;
          } else if (this.player.queueIndex > draggedIndex && this.player.queueIndex <= targetIndex) {
            this.player.queueIndex--;
          }

          this.updateQueueDisplay();
        }
      });
    });
  }

  updateButtons() {
    this.elements.repeatBtn.classList.toggle("active", this.state.isRepeat);
    setMusicIcon(this.elements.repeatBtn, this.state.isRepeat ? "repeatOne" : "repeat");

    this.elements.shuffleBtn.classList.toggle("active", this.state.isShuffle);
    setMusicIcon(this.elements.shuffleBtn, this.state.isShuffle ? "shuffle" : "shuffleOff");
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
      // Repeat current song
      this.playSongById(this.player.currentSong?.id, true); // Keep queue context
    } else {
      this.playNextSong();
    }
  }

  handleBackNavigation() {
    // Bỏ view hiện tại
    this.state.navigationStack.pop();

    const prev = this.state.navigationStack.at(-1);
    if (!prev) return;

    switch (prev.view) {
      case "main":
        this.loadMainMenu();
        break;

      case "category":
        this.loadCategory(prev.type, prev.displayTitle, true);
        break;

      case "songs":
        this.loadSongsByCategory(prev.type, prev.id, prev.displayName, true);
        break;
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

    // Tạo popup với theme support
    const popup = document.createElement("div");
    popup.id = "add-to-playlist-popup";
    popup.className = "custom-popup";
    popup.innerHTML = `
      <div class="popup-content">
        <h3>Thêm bài hát vào playlist</h3>
        <button id="createNewPlaylistBtn" type="button">${musicIcon("add")}<span>Tạo playlist mới</span></button>
        <div style="margin: 16px 0 8px 0; color: var(--music-text-secondary); font-size: 14px;">Hoặc chọn playlist đã có:</div>
        <div id="userPlaylistsList">Đang tải...</div>
        <div class="popup-actions">
          <button id="closePopupBtn" class="btn-secondary">Đóng</button>
        </div>
      </div>
    `;
    document.body.appendChild(popup);

    // Escape to close
    const handleEscape = (e) => {
      if (e.key === "Escape") {
        popup.remove();
        document.removeEventListener("keydown", handleEscape);
        document.removeEventListener("click", handleClickOutside);
      }
    };
    document.addEventListener("keydown", handleEscape);

    // Click outside to close
    const handleClickOutside = (e) => {
      if (e.target === popup) {
        popup.remove();
        document.removeEventListener("keydown", handleEscape);
        popup.removeEventListener("click", handleClickOutside);
      }
    };
    popup.addEventListener("click", handleClickOutside);
    
    // Prevent closing when clicking inside popup content
    const popupContent = popup.querySelector(".popup-content");
    if (popupContent) {
      popupContent.addEventListener("click", (e) => {
        e.stopPropagation();
      });
    }

    // Đóng popup
    document.getElementById("closePopupBtn").onclick = () => {
      popup.remove();
      document.removeEventListener("keydown", handleEscape);
      popup.removeEventListener("click", handleClickOutside);
    };

    // Xử lý tạo playlist mới
    document.getElementById("createNewPlaylistBtn").onclick = async () => {
      popup.remove();
      document.removeEventListener("keydown", handleEscape);
      popup.removeEventListener("click", handleClickOutside);
      this.showCreatePlaylistPopup(songId ?? this.getCurrentSongId());
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
      listDiv.innerHTML = "<div style='text-align: center; color: var(--music-text-secondary); padding: 24px;'>Bạn chưa có playlist nào.</div>";
    } else {
      playlists.forEach(pl => {
        const btn = document.createElement("button");
        btn.textContent = pl.name;
        btn.setAttribute("aria-label", `Thêm vào ${pl.name}`);
        btn.onclick = async () => {
          await this.addSongToPlaylist(songId ?? this.getCurrentSongId(), pl.id);
          this.showNotification("Đã thêm vào playlist!", "success");
          popup.remove();
          document.removeEventListener("keydown", handleEscape);
          popup.removeEventListener("click", handleClickOutside);
        };
        listDiv.appendChild(btn);
      });
    }
  }

  // Lấy id bài hát đang phát
  getCurrentSongId() {
    console.log("getCurrentSongId:", this.player.currentSong?.id);
    return this.player.currentSong?.id;
  }

  async showCreatePlaylistPopup(songId = null) {
    // Xóa popup cũ nếu có
    const oldPopup = document.getElementById("create-playlist-popup");
    if (oldPopup) oldPopup.remove();

    // Tạo popup với theme support
    const popup = document.createElement("div");
    popup.id = "create-playlist-popup";
    popup.className = "custom-popup";
    popup.innerHTML = `
      <div class="popup-content">
        <h3>Tạo playlist mới</h3>
        <input 
          id="newPlaylistName" 
          type="text" 
          placeholder="Nhập tên playlist..." 
          autocomplete="off"
          aria-label="Tên playlist"
        />
        <div class="popup-actions">
          <button id="cancelCreatePlaylistBtn" class="btn-secondary">Hủy</button>
          <button id="confirmCreatePlaylistBtn" class="btn-primary">Tạo</button>
        </div>
      </div>
    `;
    document.body.appendChild(popup);

    // Focus input
    const input = document.getElementById("newPlaylistName");
    setTimeout(() => input.focus(), 100);

    // Enter key to submit
    input.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        document.getElementById("confirmCreatePlaylistBtn").click();
      }
    });

    // Escape to close
    const handleEscape = (e) => {
      if (e.key === "Escape") {
        popup.remove();
        document.removeEventListener("keydown", handleEscape);
        document.removeEventListener("click", handleClickOutside);
      }
    };
    document.addEventListener("keydown", handleEscape);

    // Click outside to close
    const handleClickOutside = (e) => {
      if (e.target === popup) {
        popup.remove();
        document.removeEventListener("keydown", handleEscape);
        popup.removeEventListener("click", handleClickOutside);
      }
    };
    popup.addEventListener("click", handleClickOutside);
    
    // Prevent closing when clicking inside popup content
    const popupContent = popup.querySelector(".popup-content");
    if (popupContent) {
      popupContent.addEventListener("click", (e) => {
        e.stopPropagation();
      });
    }

    document.getElementById("cancelCreatePlaylistBtn").onclick = () => {
      popup.remove();
      document.removeEventListener("keydown", handleEscape);
      document.removeEventListener("click", handleClickOutside);
    };

    document.getElementById("confirmCreatePlaylistBtn").onclick = async () => {
      const name = input.value.trim();
      if (!name) {
        this.showNotification("Vui lòng nhập tên playlist", "warning");
        input.focus();
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
        document.removeEventListener("keydown", handleEscape);
        document.removeEventListener("click", handleClickOutside);
        await this.loadCategory("playlist", "Playlist của bạn");
      }
    };
  }
}

// Have to be exported for entry point