export class NovelDetailPage {
  constructor() {
    this.urlParams = new URLSearchParams(window.location.search);
    this.novelId = this.urlParams.get('id');
    this.titleEl = document.getElementById('novel-title');
    this.metaEl = document.getElementById('novel-meta');
    this.summaryEl = document.getElementById('novel-summary');
    this.volumeListEl = document.getElementById('volume-list');
    this.chapterListEl = document.getElementById('chapter-list');
    this.genreOverlayEl = document.getElementById('genre-overlay');

    // Chapter list flow state
    this.chapterFlowState = {
      currentChapter: null,
      recentlyRead: new Set(),
      readingProgress: 0,
      isUserIntent: false,
      dwellTimer: null
    };

    this.initChapterListFlow();
    this.loadNovelDetail();
  }

  initChapterListFlow() {
    // Create continue reading hint
    this.continueReadingHint = document.createElement('div');
    this.continueReadingHint.className = 'continue-reading-hint';
    this.continueReadingHint.textContent = 'Đọc tiếp';
    this.continueReadingHint.addEventListener('click', () => this.commitToChapter());
    document.body.appendChild(this.continueReadingHint);

    // Create commit overlay
    this.commitOverlay = document.createElement('div');
    this.commitOverlay.className = 'commit-overlay';
    document.body.appendChild(this.commitOverlay);

    // Mouse movement tracking for intent detection
    let mouseMoveCount = 0;
    let lastMouseMove = Date.now();

    document.addEventListener('mousemove', (e) => {
      mouseMoveCount++;
      lastMouseMove = Date.now();

      // Reset counter after 1 second of inactivity
      setTimeout(() => mouseMoveCount--, 1000);

      // Show hint if user seems intent on reading
      if (mouseMoveCount > 3 && this.chapterFlowState.currentChapter) {
        this.showContinueReadingHint();
      }
    });

    // Hide hint when mouse stops
    let hintHideTimer;
    document.addEventListener('mousemove', () => {
      clearTimeout(hintHideTimer);
      hintHideTimer = setTimeout(() => this.hideContinueReadingHint(), 2000);
    });
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

      // Update genre atmosphere overlay
      this.updateGenreOverlay(novel.genre || 'all');

      // Lấy danh sách quyển và render chapter list flow
      try {
        const { data: volumes, error: volumesError } = await supabase
          .from('volumes')
          .select('id, title')
          .eq('novel_id', this.novelId)
          .order('order', { ascending: true });

        if (volumesError) {
          console.error('Error loading volumes:', volumesError);
          this.renderVolumes([], supabase);
          this.showChapterListError('Lỗi khi tải danh sách quyển');
        } else {
          this.renderVolumes(volumes || [], supabase);
          this.renderChapterListFlow();
        }
      } catch (err) {
        console.error('Error loading volumes:', err);
        this.renderVolumes([], supabase);
        this.showChapterListError('Đã xảy ra lỗi khi tải quyển');
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

  // New chapter list flow methods
  async renderChapterListFlow() {
    try {
      if (!this.chapterListEl) {
        console.error('chapterListEl not found');
        return;
      }

      this.chapterListEl.innerHTML = `
        <div class="chapter-list-header">
          <h2 class="chapter-list-title">Hành trình đọc</h2>
          <div class="reader-position-indicator" id="reader-position">Đang tải vị trí...</div>
        </div>
        <div class="chapter-loading">Đang tải hành trình...</div>
      `;

      const { supabase } = await import('../supabase/supabase.js');

      // Load all chapters across all volumes
      let allChapters = [];
      let chapterIndex = 1;

      try {
        const { data: volumes, error: volumesError } = await supabase
          .from('volumes')
          .select('id, title')
          .eq('novel_id', this.novelId)
          .order('order', { ascending: true });

        if (volumesError) {
          console.error('Error loading volumes:', volumesError);
          this.showChapterListError('Lỗi khi tải danh sách quyển');
          return;
        }

        for (const volume of volumes || []) {
          const { data: chapters, error: chaptersError } = await supabase
            .from('chapters')
            .select('id, title, order')
            .eq('volume_id', volume.id)
            .order('order', { ascending: true });

          if (chaptersError) {
            console.error('Error loading chapters for volume:', volume.id, chaptersError);
            continue;
          }

          const volumeChapters = (chapters || []).map(chapter => ({
            ...chapter,
            volumeTitle: volume.title,
            globalIndex: chapterIndex++
          }));

          allChapters.push(...volumeChapters);
        }
      } catch (err) {
        console.error('Error loading chapters:', err);
        this.showChapterListError('Đã xảy ra lỗi khi tải chương');
        return;
      }

      if (allChapters.length === 0) {
        this.chapterListEl.innerHTML = `
          <div class="chapter-list-header">
            <h2 class="chapter-list-title">Hành trình đọc</h2>
            <div class="reader-position-indicator">Chưa có chương nào</div>
          </div>
          <div class="chapter-error">Tiểu thuyết này chưa có chương nào.</div>
        `;
        return;
      }

      // Load reading progress from localStorage
      this.loadReadingProgress();

      // Render chapters with flow states
      this.renderChaptersWithFlow(allChapters);

      // Update reader position indicator
      this.updateReaderPosition(allChapters);

      // Set up chapter interaction handlers
      this.setupChapterInteractions();

    } catch (err) {
      console.error('Error in renderChapterListFlow:', err);
      this.showChapterListError('Đã xảy ra lỗi không mong muốn');
    }
  }

  renderChaptersWithFlow(chapters) {
    const progressContainer = document.createElement('div');
    progressContainer.className = 'chapter-progress-container';

    const chapterItems = chapters.map((chapter, index) => {
      const chapterState = this.getChapterState(chapter.id);
      const isCurrentChapter = chapter.id === this.chapterFlowState.currentChapter;

      return `
        <div class="chapter-item ${chapterState}" data-chapter-id="${chapter.id}" data-chapter-index="${index}">
          <div class="chapter-title">${this.escapeHtml(chapter.title)}</div>
          <div class="chapter-meta">
            <span class="chapter-number">Chương ${chapter.globalIndex}</span>
            <span class="chapter-duration">~5 phút</span>
          </div>
        </div>
      `;
    }).join('');

    progressContainer.innerHTML = chapterItems;
    this.chapterListEl.appendChild(progressContainer);
  }

  getChapterState(chapterId) {
    if (chapterId === this.chapterFlowState.currentChapter) {
      return 'reading';
    }
    if (this.chapterFlowState.recentlyRead.has(chapterId)) {
      return 'read';
    }
    return 'unread';
  }

  updateReaderPosition(chapters) {
    const positionEl = document.getElementById('reader-position');
    if (!positionEl) return;

    const currentIndex = chapters.findIndex(c => c.id === this.chapterFlowState.currentChapter);
    const progressPercent = chapters.length > 0 ? ((currentIndex + 1) / chapters.length * 100).toFixed(1) : 0;

    if (currentIndex >= 0) {
      positionEl.textContent = `Bạn đang ở chương ${chapters[currentIndex].globalIndex} • ${progressPercent}% hoàn thành`;
    } else {
      positionEl.textContent = `Chưa bắt đầu đọc • 0% hoàn thành`;
    }
  }

  setupChapterInteractions() {
    const chapterItems = this.chapterListEl.querySelectorAll('.chapter-item');

    chapterItems.forEach(item => {
      const chapterId = item.dataset.chapterId;

      // Hover focus
      item.addEventListener('mouseenter', () => {
        this.handleChapterHover(item, chapterId, true);
      });

      item.addEventListener('mouseleave', () => {
        this.handleChapterHover(item, chapterId, false);
      });

      // Click to commit
      item.addEventListener('click', () => {
        this.commitToChapter(chapterId);
      });
    });
  }

  handleChapterHover(item, chapterId, isHover) {
    if (isHover) {
      // Start dwell timer for deeper focus
      clearTimeout(this.chapterFlowState.dwellTimer);
      this.chapterFlowState.dwellTimer = setTimeout(() => {
        this.showChapterDwellFocus(item, chapterId);
      }, 1200);

      // Show basic hover effects
      item.classList.add('hover-focus');
    } else {
      // Clear dwell timer
      clearTimeout(this.chapterFlowState.dwellTimer);

      // Remove hover effects
      item.classList.remove('hover-focus', 'dwell-focus');

      // Remove summary if exists
      const summary = item.querySelector('.chapter-summary');
      if (summary) {
        summary.remove();
      }
    }
  }

  showChapterDwellFocus(item, chapterId) {
    item.classList.add('dwell-focus');

    // Add summary and mood tags (placeholder data - in real app this would come from chapter metadata)
    const summaryHtml = `
      <div class="chapter-summary">
        <p>Một chương đầy cảm xúc với những khoảnh khắc quan trọng trong hành trình của nhân vật...</p>
        <div class="chapter-mood-tags">
          <span class="mood-tag">Cao trào</span>
          <span class="mood-tag">Cảm xúc</span>
        </div>
      </div>
    `;

    item.insertAdjacentHTML('beforeend', summaryHtml);
  }

  showContinueReadingHint() {
    if (this.continueReadingHint && this.chapterFlowState.currentChapter) {
      this.continueReadingHint.classList.add('visible');
    }
  }

  hideContinueReadingHint() {
    if (this.continueReadingHint) {
      this.continueReadingHint.classList.remove('visible');
    }
  }

  async commitToChapter(chapterId = null) {
    const targetChapterId = chapterId || this.chapterFlowState.currentChapter;
    if (!targetChapterId) return;

    // Find the chapter item
    const chapterItem = this.chapterListEl.querySelector(`[data-chapter-id="${targetChapterId}"]`);
    if (!chapterItem) return;

    // Start commit transition
    chapterItem.classList.add('committing');
    this.commitOverlay.classList.add('active');

    // Hide continue reading hint
    this.hideContinueReadingHint();

    // Navigate after transition
    setTimeout(() => {
      window.location.href = `chapter.html?id=${targetChapterId}`;
    }, 500);
  }

  loadReadingProgress() {
    try {
      const progress = localStorage.getItem(`novel_${this.novelId}_progress`);
      if (progress) {
        const data = JSON.parse(progress);
        this.chapterFlowState.currentChapter = data.currentChapter;
        this.chapterFlowState.recentlyRead = new Set(data.recentlyRead || []);
        this.chapterFlowState.readingProgress = data.progress || 0;
      }
    } catch (err) {
      console.warn('Error loading reading progress:', err);
    }
  }

  saveReadingProgress() {
    try {
      const data = {
        currentChapter: this.chapterFlowState.currentChapter,
        recentlyRead: Array.from(this.chapterFlowState.recentlyRead),
        progress: this.chapterFlowState.readingProgress,
        lastUpdated: Date.now()
      };
      localStorage.setItem(`novel_${this.novelId}_progress`, JSON.stringify(data));
    } catch (err) {
      console.warn('Error saving reading progress:', err);
    }
  }

  showChapterListError(message) {
    this.chapterListEl.innerHTML = `
      <div class="chapter-error">
        ❌ ${message}
      </div>
    `;
  }

  updateGenreOverlay(genre) {
    if (this.genreOverlayEl) {
      // Remove all genre classes
      this.genreOverlayEl.className = 'genre-atmosphere-overlay';

      // Add specific genre class if it exists
      if (genre && genre !== 'all') {
        this.genreOverlayEl.classList.add(genre);
      }
    }
  }
}