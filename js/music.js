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



document.getElementById("repeatBtn").addEventListener("click", toggleRepeat);


