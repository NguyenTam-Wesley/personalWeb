// File: js/music.js

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const supabaseUrl = 'https://calwzopyjitbtahiafzw.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNhbHd6b3B5aml0YnRhaGlhZnp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkxNjgyOTAsImV4cCI6MjA2NDc0NDI5MH0.lFDePS6m0MpNXDcC43dJaqa1pHtCKHNRKoiDbnxTBBc';
const supabase = createClient(supabaseUrl, SUPABASE_ANON_KEY);

const playlistContainer = document.getElementById("playlistContainer");
const musicPlayer = document.getElementById("musicPlayer");
const currentSongTitle = document.getElementById("currentSongTitle");

async function loadPlaylists() {
  const { data, error } = await supabase.from("music_data").select("id, song_name, genre, artist, url");
  if (error) {
    console.error("Lỗi tải nhạc:", error);
    return;
  }

  playlistContainer.innerHTML = "";

  data.forEach((song, index) => {
  const button = document.createElement("button");
  button.textContent = `${song.song_name}`;
  button.className = "song-button";
  button.addEventListener("click", () => {
    currentPlaylist = data;         // Gán playlist hiện tại
    currentIndex = index;           // Gán chỉ số hiện tại
    playSong(index);                // Truyền index
  });
  playlistContainer.appendChild(button);
});

}

function playSong(index) {
  const song = currentPlaylist[index];
  if (!song) return;
  musicPlayer.src = song.url;
  currentSongTitle.textContent = `${song.song_name} - ${song.artist}`;
  musicPlayer.play().catch(e => console.error("Lỗi phát:", e));
}


loadPlaylists();
// Tự động tải danh sách khi trang load
// Xử lý nút, thanh tiến trình
let currentPlaylist = [];
let currentIndex = 0;
let isShuffle = false;
let isRepeat = false;

function updateButtons() {
  document.getElementById("repeatBtn").classList.toggle("active", isRepeat);
  document.getElementById("shuffleBtn").classList.toggle("active", isShuffle);
}

// 3 nút control
function playPrevSong() {
  if (isShuffle) {
    currentIndex = Math.floor(Math.random() * currentPlaylist.length);
  } else {
    currentIndex = (currentIndex - 1 + currentPlaylist.length) % currentPlaylist.length;
  }
  playSong(currentIndex);
}

function playNextSong() {
  if (isShuffle) {
    currentIndex = Math.floor(Math.random() * currentPlaylist.length);
  } else {
    currentIndex = (currentIndex + 1) % currentPlaylist.length;
  }
  playSong(currentIndex);
}

function playAllSongs() {
  if (!currentPlaylist || currentPlaylist.length === 0) return;

  currentIndex = 0;
  playSong(currentIndex);

  musicPlayer.onended = () => {
    if (isRepeat) {
      playSong(currentIndex);
    } else {
      if (isShuffle) {
        currentIndex = Math.floor(Math.random() * currentPlaylist.length);
      } else {
        currentIndex = (currentIndex + 1) % currentPlaylist.length;
      }

      if (currentIndex === 0 && !isRepeat) {
        musicPlayer.onended = null; // dừng lại khi hết
      } else {
        playSong(currentIndex);
      }
    }
  };
}
document.getElementById("prevBtn").addEventListener("click", playPrevSong);
document.getElementById("nextBtn").addEventListener("click", playNextSong);
document.getElementById("playAllBtn").addEventListener("click", playAllSongs);



// Nút páue và réumme
const pauseResumeBtn = document.getElementById("pauseResumeBtn");

pauseResumeBtn.addEventListener("click", () => {
  if (musicPlayer.paused) {
    musicPlayer.play();
    pauseResumeBtn.textContent = "⏸";
  } else {
    musicPlayer.pause();
    pauseResumeBtn.textContent = "▶";
  }
});

// Khi bài hát mới được phát từ đầu thì cập nhật nút
musicPlayer.addEventListener("play", () => {
  pauseResumeBtn.textContent = "⏸";
});
musicPlayer.addEventListener("pause", () => {
  pauseResumeBtn.textContent = "▶";
});

// Nút rêpat
document.getElementById("repeatBtn").addEventListener("click", () => {
  isRepeat = !isRepeat;
  if (isRepeat) isShuffle = false;
  updateButtons();
});

// Nút shuffleshuffle
document.getElementById("shuffleBtn").addEventListener("click", () => {
  isShuffle = !isShuffle;
  if (isShuffle) isRepeat = false;
  updateButtons();
});


// 🌟 Tính năng thanh tiến trình
// Gán phần tử HTML vào biến
const progressBar = document.getElementById("progressBar");
const currentTimeDisplay = document.getElementById("currentTime");
const durationDisplay = document.getElementById("duration");

// Khi bài hát đang phát: cập nhật thanh tiến trình và thời gian
musicPlayer.addEventListener("timeupdate", () => {
  const current = Math.floor(musicPlayer.currentTime);
  const total = Math.floor(musicPlayer.duration) || 0;

  progressBar.max = total;
  progressBar.value = current;

  currentTimeDisplay.textContent = formatTime(current);
  durationDisplay.textContent = formatTime(total);
});

// Cho phép người dùng kéo thanh để tua bài
progressBar.addEventListener("input", () => {
  musicPlayer.currentTime = progressBar.value;
});

// Hàm định dạng thời gian dạng mm:ss
function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}


// Am thanh
const canvas = document.getElementById("volumeCanvas");
const ctx = canvas.getContext("2d");
const eraserBtn = document.getElementById("eraserBtn");
let isDrawing = false;
let erasing = false;

// Sự kiện chuột để vẽ hoặc tẩy
canvas.addEventListener("mousedown", () => isDrawing = true);
canvas.addEventListener("mouseup", () => {
  isDrawing = false;
  updateVolume(); // Cập nhật âm lượng sau khi vẽ
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

  if (erasing) {
    ctx.globalCompositeOperation = "destination-out"; // Xóa nét vẽ
  } else {
    ctx.globalCompositeOperation = "source-over"; // Vẽ bình thường
    ctx.fillStyle = "black";
  }

  ctx.beginPath();
  ctx.arc(x, y, 5, 0, Math.PI * 2);
  ctx.fill();
}


// Tính phần đã tô để set âm lượng
function updateVolume() {
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  let filledPixels = 0;

  for (let i = 0; i < imageData.data.length; i += 4) {
    const alpha = imageData.data[i + 3]; // kênh alpha (độ trong suốt)
    if (alpha > 128) filledPixels++; // đếm những pixel không trong suốt
  }

  const totalPixels = canvas.width * canvas.height;
  const fillPercentage = filledPixels / totalPixels;
  const volume = Math.min(Math.max(fillPercentage, 0), 1);

  musicPlayer.volume = volume;

  console.log(`Âm lượng: ${(volume * 100).toFixed(1)}%`);
}



