import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const supabaseUrl = "https://calwzopyjitbtahiafzw.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNhbHd6b3B5aml0YnRhaGlhZnp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkxNjgyOTAsImV4cCI6MjA2NDc0NDI5MH0.lFDePS6m0MpNXDcC43dJaqa1pHtCKHNRKoiDbnxTBBc";
const supabase = createClient(supabaseUrl, SUPABASE_ANON_KEY);

document.addEventListener("DOMContentLoaded", () => {
  // DOM Elements
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

  // State
  let navigationStack = [];
  let currentPlaylist = [];
  let currentIndex = 0;
  let isRepeat = false;
  let isShuffle = false;
  let isDrawing = false;
  let erasing = false;

  // === Giao diện chính ===
  async function loadMainMenu() {
    mainMenu.innerHTML = "";
    mainMenu.style.display = "flex";
    playlistContainer.style.display = "none";
    backBtn.style.display = "none";
    controlsContainer.style.display = "none";

    const categories = [
      { emoji: "🎤", label: "Nghệ sĩ", type: "artist" },
      { emoji: "🎧", label: "Thể loại", type: "genre" },
      { emoji: "🌍", label: "Khu vực", type: "region" },
      { emoji: "📂", label: "Playlist người dùng", type: "playlist" }
    ];

    categories.forEach(({ emoji, label, type }) => {
      const btn = document.createElement("button");
      btn.className = "main-category-button";
      btn.textContent = `${emoji} ${label}`;
      btn.addEventListener("click", () => loadCategory(type, `${emoji} ${label}`));
      mainMenu.appendChild(btn);
    });
  }

  async function loadCategory(type, displayTitle) {
    navigationStack.push({ view: "main" }); // đang ở main menu → trước khi vào danh mục
    mainMenu.innerHTML = ""; // clear main menu to show sub-items
    const { data, error } = await supabase.from(type).select("id, name");


    if (error) {
      console.error(`Lỗi tải ${type}:`, error);
      mainMenu.innerHTML = `<p>Lỗi tải ${displayTitle}</p>`;
      return;
    }

    if (!data || data.length === 0) {
      mainMenu.innerHTML = `<p>Không có dữ liệu cho ${displayTitle}</p>`;
      return;
    }

    const heading = document.createElement("h3");
    heading.textContent = `${displayTitle} - Danh sách`;
    mainMenu.appendChild(heading);

    data.forEach((item) => {
      const btn = document.createElement("button");
      btn.className = "category-item";
      btn.textContent = item.name;
      btn.addEventListener("click", () => loadSongsByCategory(type, item.id, item.name));
      mainMenu.appendChild(btn);
    });

    backBtn.style.display = "inline-block";
    backBtn.onclick = () => {
      mainMenu.innerHTML = "";
      loadMainMenu();
    };
  }



  async function loadSongsByCategory(type, id, displayName) {
    navigationStack.push({ view: "category", type, displayName }); // trước khi vào bài hát
    mainMenu.style.display = "none";
    playlistContainer.style.display = "block";
    backBtn.style.display = "inline-block";
    controlsContainer.style.display = "block";
    playlistContainer.innerHTML = `<h3>${displayName} - Danh sách bài hát</h3>`;

    const columnMap = {
      artist: "artist_id",
      genre: "genre_id",
      region: "region_id",
      playlist: "playlist_id",
    };

    const filterColumn = columnMap[type];
    const { data, error } = await supabase
      .from("music_data")
      .select(
        "id, song_name, url, artist:artist(name), genre:genre(name), region:region(name)"
      )
      .eq(filterColumn, id);


    if (error) {
      playlistContainer.innerHTML += `<p>Lỗi tải bài hát.</p>`;
      console.error(error);
      return;
    }

    if (data.length === 0) {
      playlistContainer.innerHTML += `<p>Không có bài hát nào.</p>`;
      return;
    }

    currentPlaylist = data;
    currentIndex = 0;

    data.forEach((song, index) => {
      const btn = document.createElement("button");
      btn.className = "song-button";
      const artistName = song.artist?.name || "Không rõ nghệ sĩ";
      btn.textContent = `${song.song_name} - ${artistName}`;
      btn.addEventListener("click", () => {
        currentIndex = index;
        playSong(currentIndex);
      });
      playlistContainer.appendChild(btn);
    });

  }

  function playSong(index) {
    const song = currentPlaylist[index];
    if (!song) return;
    musicPlayer.src = song.url;
    const artistName = song.artist?.name || "Không rõ nghệ sĩ";
    currentSongTitle.textContent = `${song.song_name} - ${artistName}`;
    musicPlayer.play().catch(console.error);
    pauseResumeBtn.textContent = "⏸";
  }

  // ==== Controls ====
  pauseResumeBtn.addEventListener("click", () => {
    if (musicPlayer.paused) {
      musicPlayer.play();
      pauseResumeBtn.textContent = "⏸";
    } else {
      musicPlayer.pause();
      pauseResumeBtn.textContent = "▶";
    }
  });

  musicPlayer.addEventListener(
    "play",
    () => (pauseResumeBtn.textContent = "⏸")
  );
  musicPlayer.addEventListener(
    "pause",
    () => (pauseResumeBtn.textContent = "▶")
  );

  musicPlayer.addEventListener("ended", () => {
    if (isRepeat) playSong(currentIndex);
    else playNextSong();
  });

  prevBtn.addEventListener("click", playPrevSong);
  nextBtn.addEventListener("click", playNextSong);
  repeatBtn.addEventListener("click", () => {
    isRepeat = !isRepeat;
    isShuffle = false;
    updateButtons();
  });
  shuffleBtn.addEventListener("click", () => {
    isShuffle = !isShuffle;
    isRepeat = false;
    updateButtons();
  });

  function playNextSong() {
    if (currentPlaylist.length === 0) return;
    currentIndex = isShuffle
      ? Math.floor(Math.random() * currentPlaylist.length)
      : (currentIndex + 1) % currentPlaylist.length;
    playSong(currentIndex);
  }

  function playPrevSong() {
    if (currentPlaylist.length === 0) return;
    currentIndex = isShuffle
      ? Math.floor(Math.random() * currentPlaylist.length)
      : (currentIndex - 1 + currentPlaylist.length) % currentPlaylist.length;
    playSong(currentIndex);
  }

  function updateButtons() {
    repeatBtn.classList.toggle("active", isRepeat);
    shuffleBtn.classList.toggle("active", isShuffle);
  }

  // ==== Progress Bar ====
  musicPlayer.addEventListener("timeupdate", () => {
    const current = Math.floor(musicPlayer.currentTime);
    const total = Math.floor(musicPlayer.duration) || 0;

    progressBar.max = total;
    progressBar.value = current;
    currentTimeDisplay.textContent = formatTime(current);
    durationDisplay.textContent = formatTime(total);
  });

  progressBar.addEventListener("input", () => {
    musicPlayer.currentTime = progressBar.value;
  });

  function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  }

  // ==== Back ====
  backBtn.addEventListener("click", () => {
    const lastView = navigationStack.pop();

  if (!lastView) return;

  if (lastView.view === "main") {
    loadMainMenu(); // quay về menu chính
  } else if (lastView.view === "category") {
    loadCategory(lastView.type, lastView.displayTitle); // quay lại danh sách nghệ sĩ/thể loại...
  }
    /*
    musicPlayer.pause();
    musicPlayer.src = "";
    currentSongTitle.textContent = "";
    currentPlaylist = [];
    currentIndex = 0;
    playlistContainer.style.display = "none";
    controlsContainer.style.display = "none";
    backBtn.style.display = "none";
    mainMenu.style.display = "flex";
    */
  });

  // ==== Canvas Volume Draw ====
  canvas.addEventListener("mousedown", () => (isDrawing = true));
  canvas.addEventListener("mouseup", () => {
    isDrawing = false;
    updateVolume();
  });
  canvas.addEventListener("mousemove", draw);
  eraserBtn.addEventListener("click", () => {
    erasing = !erasing;
    eraserBtn.textContent = erasing ? "✏️" : "🧽";
  });

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

  function updateVolume() {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let filledPixels = 0;
    for (let i = 3; i < imageData.length; i += 4) {
      if (imageData[i] > 0) filledPixels++;
    }
    const volume = (filledPixels / (canvas.width * canvas.height)) * 2;
    musicPlayer.volume = Math.min(1, Math.max(0, volume));
  }

  // === Load khi khởi động ===
  loadMainMenu();
});
