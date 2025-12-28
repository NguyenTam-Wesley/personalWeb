export class NovelDetailPage {
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
    try {
      if (!this.novelId) {
        this.showError('Không tìm thấy ID tiểu thuyết');
        return;
      }

      const { supabase } = await import('../supabase/supabase.js');
      
      // Lấy thông tin tiểu thuyết
      const { data: novel, error } = await supabase
        .from('novels')
        .select('id, title, summary, status, author_id')
        .eq('id', this.novelId)
        .single();
      
      if (error || !novel) {
        console.error('Error loading novel:', error);
        this.showError('Không tìm thấy tiểu thuyết hoặc đã xảy ra lỗi.');
        return;
      }

      // Lấy thông tin tác giả
      let authorName = 'Không rõ';
      if (novel.author_id) {
        try {
          const { data: author, error: authorError } = await supabase
            .from('authors')
            .select('name')
            .eq('id', novel.author_id)
            .single();
          
          if (authorError) {
            console.warn('Error loading author:', authorError);
          } else if (author) {
            authorName = author.name;
          }
        } catch (err) {
          console.warn('Error loading author:', err);
        }
      }

      this.titleEl.textContent = novel.title || 'Không có tiêu đề';
      const statusText = novel.status === 'ongoing' ? 'Đang ra' : novel.status === 'completed' ? 'Hoàn thành' : 'Tạm dừng';
      this.metaEl.innerHTML = `Tác giả: <b>${this.escapeHtml(authorName)}</b> | Trạng thái: <b>${statusText}</b> <button id="favorite-btn">Yêu thích</button>`;
      this.summaryEl.textContent = novel.summary || '';

      // Lấy danh sách quyển
      try {
        const { data: volumes, error: volumesError } = await supabase
          .from('volumes')
          .select('id, title')
          .eq('novel_id', this.novelId)
          .order('order', { ascending: true });
        
        if (volumesError) {
          console.error('Error loading volumes:', volumesError);
          this.renderVolumes([], supabase);
        } else {
          this.renderVolumes(volumes || [], supabase);
        }
      } catch (err) {
        console.error('Error loading volumes:', err);
        this.renderVolumes([], supabase);
      }
    } catch (err) {
      console.error('Unexpected error in loadNovelDetail:', err);
      this.showError('Đã xảy ra lỗi không mong muốn. Vui lòng thử lại sau.');
    }
  }

  showError(message) {
    if (this.titleEl) {
      this.titleEl.textContent = 'Lỗi';
    }
    if (this.metaEl) {
      this.metaEl.innerHTML = `<p style="color: red;">❌ ${message}</p>`;
    }
    if (this.summaryEl) {
      this.summaryEl.textContent = '';
    }
    if (this.volumeListEl) {
      this.volumeListEl.innerHTML = '';
    }
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  renderVolumes(volumes, supabase) {
    try {
      if (!this.volumeListEl) {
        console.error('volumeListEl not found');
        return;
      }

      this.volumeListEl.innerHTML = '<h3>Danh sách quyển</h3>' + (volumes?.length
        ? `<div class="volumes-list">${volumes.map(v => `<div class="volume-item" data-volume-id="${v.id}">${this.escapeHtml(v.title)}<div class="chapter-list" style="display:none;"></div></div>`).join('')}</div>`
        : '<div>Chưa có quyển nào</div>');
      
      if (volumes?.length) {
        const volumeEls = this.volumeListEl.querySelectorAll('.volume-item');
        volumeEls.forEach(el => {
          el.addEventListener('click', async (e) => {
            try {
              e.stopPropagation();
              const chapterListEl = el.querySelector('.chapter-list');
              if (!chapterListEl) return;

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
                c.parentElement?.classList.remove('open');
              });

              chapterListEl.style.display = 'block';
              el.classList.add('open');
              chapterListEl.innerHTML = '<div>Đang tải chương...</div>';

              const volumeId = el.dataset.volumeId;
              if (!volumeId) {
                chapterListEl.innerHTML = '<div style="color: red;">❌ Lỗi: Không tìm thấy ID quyển</div>';
                return;
              }

              const { data: chapters, error } = await supabase
                .from('chapters')
                .select('id, title')
                .eq('volume_id', volumeId)
                .order('order', { ascending: true });

              if (error) {
                console.error('Error loading chapters:', error);
                chapterListEl.innerHTML = '<div style="color: red;">❌ Lỗi khi tải danh sách chương</div>';
                return;
              }

              chapterListEl.innerHTML = chapters?.length
                ? chapters.map(c => `<div><a href="chapter.html?id=${c.id}">${this.escapeHtml(c.title)}</a></div>`).join('')
                : '<div>Chưa có chương nào</div>';
            } catch (err) {
              console.error('Error loading chapters:', err);
              const chapterListEl = el.querySelector('.chapter-list');
              if (chapterListEl) {
                chapterListEl.innerHTML = '<div style="color: red;">❌ Đã xảy ra lỗi khi tải chương</div>';
              }
            }
          });
        });
      }
    } catch (err) {
      console.error('Error in renderVolumes:', err);
      if (this.volumeListEl) {
        this.volumeListEl.innerHTML = '<div style="color: red;">❌ Lỗi khi hiển thị danh sách quyển</div>';
      }
    }
  }
}