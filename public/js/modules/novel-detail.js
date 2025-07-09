class NovelDetailPage {
  constructor() {
    this.urlParams = new URLSearchParams(window.location.search);
    this.novelId = this.urlParams.get('id');
    this.titleEl = document.getElementById('novel-title');
    this.metaEl = document.getElementById('novel-meta');
    this.summaryEl = document.getElementById('novel-summary');
    this.volumeListEl = document.getElementById('volume-list');
    this.loadNovelDetail();
  }

  async loadNovelDetail() {
    const { supabase } = await import('../supabase/supabase.js');
    // Lấy thông tin tiểu thuyết
    const { data: novel, error } = await supabase
      .from('novels')
      .select('id, title, summary, status, author_id')
      .eq('id', this.novelId)
      .single();
    if (error || !novel) {
      this.titleEl.textContent = 'Không tìm thấy tiểu thuyết';
      return;
    }
    // Lấy thông tin tác giả
    let authorName = 'Không rõ';
    if (novel.author_id) {
      const { data: author } = await supabase
        .from('authors')
        .select('name')
        .eq('id', novel.author_id)
        .single();
      if (author) authorName = author.name;
    }
    this.titleEl.textContent = novel.title;
    this.metaEl.innerHTML = `Tác giả: <b>${authorName}</b> | Trạng thái: <b>${novel.status === 'ongoing' ? 'Đang ra' : novel.status === 'completed' ? 'Hoàn thành' : 'Tạm dừng'}</b> <button id="favorite-btn">Yêu thích</button>`;
    this.summaryEl.textContent = novel.summary || '';
    // Lấy danh sách quyển
    const { data: volumes } = await supabase
      .from('volumes')
      .select('id, title')
      .eq('novel_id', this.novelId)
      .order('order', { ascending: true });
    this.renderVolumes(volumes, supabase);
  }

  renderVolumes(volumes, supabase) {
    this.volumeListEl.innerHTML = '<h3>Danh sách quyển</h3>' + (volumes?.length
      ? `<div class="volumes-list">${volumes.map(v => `<div class="volume-item" data-volume-id="${v.id}">${v.title}<div class="chapter-list" style="display:none;"></div></div>`).join('')}</div>`
      : '<div>Chưa có quyển nào</div>');
    if (volumes?.length) {
      const volumeEls = this.volumeListEl.querySelectorAll('.volume-item');
      volumeEls.forEach(el => {
        el.addEventListener('click', async (e) => {
          e.stopPropagation();
          const chapterListEl = el.querySelector('.chapter-list');
          if (chapterListEl.style.display === 'block') {
            chapterListEl.style.display = 'none';
            chapterListEl.innerHTML = '';
            el.classList.remove('open');
            return;
          }
          // Ẩn tất cả danh sách chương khác (nếu muốn chỉ mở 1 quyển)
          this.volumeListEl.querySelectorAll('.chapter-list').forEach(c => {
            c.style.display = 'none';
            c.innerHTML = '';
            c.parentElement.classList.remove('open');
          });
          chapterListEl.style.display = 'block';
          el.classList.add('open');
          chapterListEl.innerHTML = '<div>Đang tải chương...</div>';
          const { data: chapters } = await supabase
            .from('chapters')
            .select('id, title')
            .eq('volume_id', el.dataset.volumeId)
            .order('order', { ascending: true });
          chapterListEl.innerHTML = chapters?.length
            ? chapters.map(c => `<div><a href="chapter.html?id=${c.id}">${c.title}</a></div>`).join('')
            : '<div>Chưa có chương nào</div>';
        });
      });
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new NovelDetailPage();
}); 