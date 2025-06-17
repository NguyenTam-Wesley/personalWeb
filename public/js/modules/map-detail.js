// JS cho trang map Valorant
// Có thể mở rộng để xử lý logic động cho từng map

document.addEventListener('DOMContentLoaded', () => {
  // Ví dụ: Hiệu ứng fade-in cho ảnh map
  const mapImg = document.querySelector('.map-image');
  if (mapImg) {
    mapImg.style.opacity = 0;
    mapImg.style.transition = 'opacity 1s';
    setTimeout(() => {
      mapImg.style.opacity = 1;
    }, 200);
  }

  // Có thể thêm các logic khác cho từng map ở đây
}); 