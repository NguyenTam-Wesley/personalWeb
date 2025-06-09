import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const supabaseUrl = "https://calwzopyjitbtahiafzw.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNhbHd6b3B5aml0YnRhaGlhZnp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkxNjgyOTAsImV4cCI6MjA2NDc0NDI5MH0.lFDePS6m0MpNXDcC43dJaqa1pHtCKHNRKoiDbnxTBBc";

const supabase = createClient(supabaseUrl, SUPABASE_ANON_KEY);

document.addEventListener("DOMContentLoaded", () => {
  // DOM elements
  const mainMenu = document.getElementById("mainMenu");
  const playlistContainer = document.getElementById("playlistContainer");
  const backBtn = document.getElementById("backBtn");
  const controlsContainer = document.getElementById("controlsContainer");
  const musicPlayer = document.getElementById("musicPlayer");
  const currentSongTitle = document.getElementById("currentSongTitle");
  const pauseResumeBtn = document.getElementById("pauseResumeBtn");
  const prevBtn = document.getElementById("prevBtn");
  const nextBtn = document.getElementById("nextBtn");
  const repeatBtn = document.getElementById("repeatBtn");
  const shuffleBtn = document.getElementById("shuffleBtn");
  const progressBar = document.getElementById("progressBar");
  const currentTimeDisplay = document.getElementById("currentTime");
  const durationDisplay = document.getElementById("duration");
  const canvas = document.getElementById("volumeCanvas");
  const ctx = canvas.getContext("2d");
  const eraserBtn = document.getElementById("eraserBtn");

  // State variables
  let navigationStack = [];
  let currentPlaylist = [];
  let currentIndex = 0;
  let isRepeat = false;
  let isShuffle = false;
  let isDrawing = false;
  let erasing = false;
  let controlsShownOnce = false;

  // Hàm tải menu chính (4 loại category)
  async function loadMainMenu() {
    mainMenu.innerHTML = "";
    mainMenu.style.display = "flex";
    playlistContainer.style.display = "none";

    // Chỉ ẩn controls lần đầu tiên vào menu chính
    if (!controlsShownOnce) {
      controlsContainer.style.display = "none";
    }

    backBtn.style.display = "none";

    // Danh sách category
    const categories = [
      { emoji: "🎤", label: "Nghệ sĩ", type: "artist" },
      { emoji: "🎧", label: "Thể loại", type: "genre" },
      { emoji: "🌍", label: "Khu vực", type: "region" },
      { emoji: "📂", label: "Playlist người dùng", type: "playlist" },
    ];

    categories.forEach(({ emoji, label, type }) => {
      const btn = document.createElement("button");
      btn.className = "main-category-button";
      btn.textContent = `${emoji} ${label}`;
      btn.addEventListener("click", () => loadCategory(type, `${emoji} ${label}`));
      mainMenu.appendChild(btn);
    });

    navigationStack = []; // Reset stack khi vào menu chính
  }

  // Hàm load danh sách category từ Supabase theo loại (artist, genre, region, playlist)
  async function loadCategory(type, displayTitle) {
    mainMenu.innerHTML = "";
    mainMenu.style.display = "flex";
    playlistContainer.style.display = "none";
    backBtn.style.display = "inline-block";

    // Đẩy view hiện tại vào navigation stack để quay lại
    navigationStack.push({ view: "main" });

    const { data, error } = await supabase.from(type).select("id, name");

    if (error) {
      mainMenu.innerHTML = `<p>Lỗi tải dữ liệu ${displayTitle}. Vui lòng thử lại.</p>`;
      console.error(error);
      return;
    }

    if (!data || data.length === 0) {
      mainMenu.innerHTML = `<p>Không có dữ liệu cho ${displayTitle}.</p>`;
      return;
    }

    

    data.forEach((item) => {
      const btn = document.createElement("button");
      btn.className = "category-item";
      btn.textContent = item.name;
      btn.addEventListener("click", () => loadSongsByCategory(type, item.id, item.name));
      mainMenu.appendChild(btn);
    });
  }

  // Hàm load bài hát theo category (artist_id, genre_id, region_id, playlist_id)
  async function loadSongsByCategory(type, id, displayName) {
    mainMenu.style.display = "none";
    playlistContainer.style.display = "block";
    backBtn.style.display = "inline-block";

    playlistContainer.innerHTML = `<h3>${displayName} - Danh sách bài hát</h3>`;

    // Đẩy view hiện tại vào navigation stack để quay lại
    navigationStack.push({ view: "category", type, displayTitle: displayName });

    // Map để xác định cột lọc trong bảng music_data
    const columnMap = {
      artist: "artist_id",
      genre: "genre_id",
      region: "region_id",
      playlist: "playlist_id",
    };
    const filterColumn = columnMap[type];

    // Truy vấn bài hát với liên kết các bảng artist, genre, region
    const { data, error } = await supabase
      .from("music_data")
      .select("id, song_name, url, artist:artist(name), genre:genre(name), region:region(name)")
      .eq(filterColumn, id);

    if (error) {
      playlistContainer.innerHTML += `<p>Lỗi tải bài hát. Vui lòng thử lại.</p>`;
      console.error(error);
      return;
    }

    if (!data || data.length === 0) {
      playlistContainer.innerHTML += `<p>Không có bài hát nào trong mục này.</p>`;
      return;
    }

    currentPlaylist = data;
    currentIndex = 0;

    data.forEach((song, index) => {
      const btn = document.createElement("button");
      btn.className = "song-button";
      btn.textContent = `${song.song_name}`;
      btn.addEventListener("click", () => {
        currentIndex = index;
        playSong(currentIndex);
      });
      playlistContainer.appendChild(btn);
    });
  }

  // Hàm play bài hát theo index trong currentPlaylist
  function playSong(index) {
    const song = currentPlaylist[index];
    if (!song) return;

    musicPlayer.src = song.url;
    const artistName = song.artist?.name || "Không rõ nghệ sĩ";
    currentSongTitle.textContent = `${song.song_name} - ${artistName}`;

    musicPlayer.play().catch((e) => {
      console.error("Lỗi phát nhạc:", e);
      alert("Không thể phát bài hát này.");
    });

    pauseResumeBtn.textContent = "⏸";

    // Hiện controls khi play lần đầu
    if (!controlsShownOnce) {
      controlsContainer.style.display = "block";
      controlsShownOnce = true;
    }
  }

  // Nút tạm dừng / phát lại
  pauseResumeBtn.addEventListener("click", () => {
    if (musicPlayer.paused) {
      musicPlayer.play();
      pauseResumeBtn.textContent = "⏸";
    } else {
      musicPlayer.pause();
      pauseResumeBtn.textContent = "▶";
    }
  });

  // Khi bài hát kết thúc
  musicPlayer.addEventListener("ended", () => {
    if (isRepeat) {
      playSong(currentIndex);
    } else {
      playNextSong();
    }
  });

  // Nút prev / next
  prevBtn.addEventListener("click", playPrevSong);
  nextBtn.addEventListener("click", playNextSong);

  // Nút bật/tắt repeat & shuffle
  repeatBtn.addEventListener("click", () => {
    isRepeat = !isRepeat;
    if (isRepeat) isShuffle = false; // Chỉ bật 1 trong 2
    updateButtons();
  });

  shuffleBtn.addEventListener("click", () => {
    isShuffle = !isShuffle;
    if (isShuffle) isRepeat = false; // Chỉ bật 1 trong 2
    updateButtons();
  });

  // Chuyển bài kế tiếp
  function playNextSong() {
    if (currentPlaylist.length === 0) return;
    if (isShuffle) {
      currentIndex = Math.floor(Math.random() * currentPlaylist.length);
    } else {
      currentIndex = (currentIndex + 1) % currentPlaylist.length;
    }
    playSong(currentIndex);
  }

  // Chuyển bài trước
  function playPrevSong() {
    if (currentPlaylist.length === 0) return;
    if (isShuffle) {
      currentIndex = Math.floor(Math.random() * currentPlaylist.length);
    } else {
      currentIndex = (currentIndex - 1 + currentPlaylist.length) % currentPlaylist.length;
    }
    playSong(currentIndex);
  }

  // Cập nhật trạng thái nút repeat và shuffle
  function updateButtons() {
    repeatBtn.classList.toggle("active", isRepeat);
    shuffleBtn.classList.toggle("active", isShuffle);
  }

  // Cập nhật thanh tiến trình và thời gian
  musicPlayer.addEventListener("timeupdate", () => {
    const current = Math.floor(musicPlayer.currentTime);
    const total = Math.floor(musicPlayer.duration) || 0;

    progressBar.max = total;
    progressBar.value = current;

    currentTimeDisplay.textContent = formatTime(current);
    durationDisplay.textContent = formatTime(total);
  });

  // Khi người dùng kéo thanh tiến trình
  progressBar.addEventListener("input", () => {
    musicPlayer.currentTime = progressBar.value;
  });

  // Định dạng thời gian mm:ss
  function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  }

  // Nút back quay lại màn hình trước đó
  backBtn.addEventListener("click", () => {
    const lastView = navigationStack.pop();
    if (!lastView) return;

    if (lastView.view === "main") {
      loadMainMenu();
    } else if (lastView.view === "category") {
      loadCategory(lastView.type, lastView.displayTitle);
    }
  });

  // Vẽ lên canvas volume
  canvas.addEventListener("mousedown", () => (isDrawing = true));
  canvas.addEventListener("mouseup", () => {
    isDrawing = false;
    updateVolume();
  });
  canvas.addEventListener("mouseleave", () => {
    if (isDrawing) {
      isDrawing = false;
      updateVolume();
    }
  });
  canvas.addEventListener("mousemove", draw);

  // Nút tẩy hoặc vẽ trên canvas
  eraserBtn.addEventListener("click", () => {
    erasing = !erasing;
    eraserBtn.textContent = erasing ? "✏️" : "🧽";
  });

  // Hàm vẽ lên canvas
  function draw(e) {
    if (!isDrawing) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.globalCompositeOperation = erasing ? "destination-out" : "source-over";
    ctx.fillStyle = "black";
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, 2 * Math.PI);
    ctx.fill();
  }

  // Cập nhật âm lượng nhạc dựa trên lượng nét vẽ trên canvas
  function updateVolume() {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let filledPixels = 0;
    // Kiểm tra kênh alpha (chỉ số 3,7,11,...)
    for (let i = 3; i < imageData.length; i += 4) {
      if (imageData[i] > 0) filledPixels++;
    }
    // Tính phần trăm vùng được tô (đơn giản)
    const fillPercent = filledPixels / (canvas.width * canvas.height);
    // Đặt volume từ 0 đến 1
    musicPlayer.volume = Math.min(Math.max(fillPercent * 2, 0), 1);
  }

  // Load menu chính ban đầu
  loadMainMenu();
});
