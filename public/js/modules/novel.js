export class NovelListPage {
  constructor() {
    this.listContainer = document.getElementById('novel-list');
    this.previewPanel = document.getElementById('novel-preview-panel');
    this.atmosphereOverlay = document.querySelector('.genre-atmosphere-overlay');

    if (!this.listContainer) {
      console.error('Không tìm thấy element #novel-list');
      return;
    }

    this.currentGenre = 'all';
    this.scrollObserver = null;
    this.hoverTimers = new Map();
    this.memoryData = this.loadReadingMemory();
    this.bookmarkedNovels = this.loadBookmarkedNovels();

    this.init();
    this.loadNovels();
  }

  init() {
    this.initScrollAwareness();
    this.initGenreAtmosphere();
    this.initHoverFocus();
    this.initPreviewPanel();
    this.initGentleExit();
  }

  // === SCROLL AWARENESS ===
  initScrollAwareness() {
    this.scrollObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('scroll-aware');
            this.scrollObserver.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
      }
    );
  }

  // === GENRE ATMOSPHERE ===
  initGenreAtmosphere() {
    const genreButtons = document.querySelectorAll('.genre-filter-btn');
    genreButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const genre = btn.dataset.genre;
        this.setGenreAtmosphere(genre);
        this.filterNovelsByGenre(genre);
      });
    });
  }

  setGenreAtmosphere(genre) {
    // Remove all genre classes
    this.atmosphereOverlay.className = 'genre-atmosphere-overlay';

    // Remove active class from all buttons
    document.querySelectorAll('.genre-filter-btn').forEach(btn => {
      btn.classList.remove('active', 'fantasy', 'sci-fi', 'romance', 'mystery', 'slice-of-life');
    });

    if (genre !== 'all') {
      this.atmosphereOverlay.classList.add(genre);
      document.querySelector(`[data-genre="${genre}"]`).classList.add('active', genre);
    } else {
      document.querySelector(`[data-genre="all"]`).classList.add('active');
    }

    this.currentGenre = genre;
  }

  filterNovelsByGenre(genre) {
    const cards = document.querySelectorAll('.novel-card');
    cards.forEach(card => {
      const cardGenre = card.dataset.genre;
      if (genre === 'all' || cardGenre === genre) {
        card.style.display = 'block';
        setTimeout(() => {
          card.style.opacity = '1';
          card.style.transform = 'translateY(0)';
        }, 50);
      } else {
        card.style.opacity = '0';
        card.style.transform = 'translateY(20px)';
        setTimeout(() => {
          card.style.display = 'none';
        }, 300);
      }
    });
  }

  // === HOVER FOCUS & DEEP FOCUS ===
  initHoverFocus() {
    document.addEventListener('mouseover', (e) => {
      const card = e.target.closest('.novel-card');
      if (!card) return;

      // Clear existing timer for this card
      if (this.hoverTimers.has(card)) {
        clearTimeout(this.hoverTimers.get(card));
      }

      // Set timer for deep focus
      const timer = setTimeout(() => {
        card.classList.add('deep-focus');
      }, 1500);

      this.hoverTimers.set(card, timer);
    });

    document.addEventListener('mouseout', (e) => {
      const card = e.target.closest('.novel-card');
      if (!card) return;

      // Clear deep focus timer
      if (this.hoverTimers.has(card)) {
        clearTimeout(this.hoverTimers.get(card));
        this.hoverTimers.delete(card);
      }

      // Remove deep focus
      card.classList.remove('deep-focus');
    });
  }

  // === PREVIEW PANEL ===
  initPreviewPanel() {
    const closeBtn = document.getElementById('preview-close-btn');
    const readBtn = document.getElementById('preview-read-btn');
    const bookmarkBtn = document.getElementById('preview-bookmark-btn');

    closeBtn?.addEventListener('click', () => this.closePreviewPanel());
    readBtn?.addEventListener('click', () => this.commitToRead());
    bookmarkBtn?.addEventListener('click', () => this.toggleBookmark());

    // Close on backdrop click
    this.previewPanel?.addEventListener('click', (e) => {
      if (e.target === this.previewPanel) {
        this.closePreviewPanel();
      }
    });
  }

  openPreviewPanel(novelData) {
    this.currentPreviewNovel = novelData;

    document.getElementById('preview-title').textContent = novelData.title;
    document.getElementById('preview-author').textContent = novelData.author;
    document.getElementById('preview-status').textContent = novelData.status;
    document.getElementById('preview-content').textContent = novelData.previewContent;

    this.previewPanel.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  closePreviewPanel() {
    this.previewPanel.classList.remove('open');
    document.body.style.overflow = '';
    this.currentPreviewNovel = null;
  }

  commitToRead() {
    if (!this.currentPreviewNovel) return;

    // Store novel ID before closing panel
    const novelId = this.currentPreviewNovel.id;

    // Add commit transition class
    const card = document.querySelector(`[data-novel-id="${novelId}"]`);
    if (card) {
      card.classList.add('commit-transition');
    }

    // Close preview and navigate after animation
    this.closePreviewPanel();
    setTimeout(() => {
      console.log('Navigating to:', `novel/novel-detail.html?id=${novelId}`);
      window.location.href = `novel/novel-detail.html?id=${novelId}`;
    }, 100);
  }

  toggleBookmark() {
    if (!this.currentPreviewNovel) return;

    const novelId = this.currentPreviewNovel.id;
    const card = document.querySelector(`[data-novel-id="${novelId}"]`);

    if (this.bookmarkedNovels.has(novelId)) {
      this.bookmarkedNovels.delete(novelId);
      card?.classList.remove('bookmarked');
    } else {
      this.bookmarkedNovels.add(novelId);
      card?.classList.add('bookmarked');
    }

    this.saveBookmarkedNovels();
    this.updateBookmarkButton();
  }

  updateBookmarkButton() {
    const bookmarkBtn = document.getElementById('preview-bookmark-btn');
    if (!bookmarkBtn || !this.currentPreviewNovel) return;

    const isBookmarked = this.bookmarkedNovels.has(this.currentPreviewNovel.id);
    bookmarkBtn.textContent = isBookmarked ? '❤️ Đã đánh dấu' : '📖 Đánh dấu';
  }

  // === READING MEMORY ===
  loadReadingMemory() {
    try {
      const memory = localStorage.getItem('novel-reading-memory');
      return memory ? JSON.parse(memory) : {};
    } catch (e) {
      return {};
    }
  }

  saveReadingMemory() {
    try {
      localStorage.setItem('novel-reading-memory', JSON.stringify(this.memoryData));
    } catch (e) {
      console.warn('Could not save reading memory');
    }
  }

  loadBookmarkedNovels() {
    try {
      const bookmarked = localStorage.getItem('novel-bookmarks');
      return bookmarked ? new Set(JSON.parse(bookmarked)) : new Set();
    } catch (e) {
      return new Set();
    }
  }

  saveBookmarkedNovels() {
    try {
      localStorage.setItem('novel-bookmarks', JSON.stringify([...this.bookmarkedNovels]));
    } catch (e) {
      console.warn('Could not save bookmarks');
    }
  }

  // === GENTLE EXIT ===
  initGentleExit() {
    // Save scroll position when leaving
    window.addEventListener('beforeunload', () => {
      sessionStorage.setItem('novel-list-scroll', window.scrollY.toString());
    });

    // Restore scroll position on return
    const savedScroll = sessionStorage.getItem('novel-list-scroll');
    if (savedScroll) {
      setTimeout(() => {
        window.scrollTo(0, parseInt(savedScroll));
        sessionStorage.removeItem('novel-list-scroll');
      }, 100);
    }
  }

  // === NOVEL LOADING (PRESERVED LOGIC) ===
  async loadNovels() {
    try {
      this.listContainer.innerHTML = '<p>Đang tải danh sách tiểu thuyết...</p>';
      const { supabase } = await import('../supabase/supabase.js');

      // Lấy danh sách tiểu thuyết và tác giả
      const { data: novels, error } = await supabase
        .from('novels')
        .select('id, title, summary, status, author_id')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading novels:', error);
        this.showError('Lỗi khi tải danh sách tiểu thuyết. Vui lòng thử lại sau.');
        return;
      }

      if (!novels || novels.length === 0) {
        this.listContainer.innerHTML = '<p>Chưa có tiểu thuyết nào.</p>';
        return;
      }

      // Lấy thông tin tác giả cho từng tiểu thuyết
      let authorsMap = {};
      try {
        const authorIds = [...new Set(novels.map(n => n.author_id).filter(Boolean))];
        if (authorIds.length > 0) {
          const { data: authors, error: authorsError } = await supabase
            .from('authors')
            .select('id, name')
            .in('id', authorIds);

          if (authorsError) {
            console.warn('Error loading authors:', authorsError);
          } else if (authors) {
            authorsMap = Object.fromEntries(authors.map(a => [a.id, a.name]));
          }
        }
      } catch (err) {
        console.warn('Error loading authors:', err);
        // Continue without authors mapping
      }

      this.renderNovels(novels, authorsMap);
    } catch (err) {
      console.error('Unexpected error in loadNovels:', err);
      this.showError('Đã xảy ra lỗi không mong muốn. Vui lòng thử lại sau.');
    }
  }

  renderNovels(novels, authorsMap) {
    const novelCards = novels.map(novel => this.createNovelCard(novel, authorsMap[novel.author_id]));
    this.listContainer.innerHTML = novelCards.join('');

    // Initialize scroll awareness for new cards
    document.querySelectorAll('.novel-card').forEach(card => {
      this.scrollObserver.observe(card);
    });

    // Add click handlers
    document.querySelectorAll('.novel-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (!e.target.closest('.action-btn')) {
          const novelId = card.dataset.novelId;
          const novel = novels.find(n => n.id == novelId);
          if (novel) {
            this.openPreviewPanel({
              id: novel.id,
              title: novel.title,
              author: authorsMap[novel.author_id] || 'Không rõ',
              status: novel.status || 'Đang cập nhật',
              previewContent: this.generatePreviewContent(novel.summary),
              summary: novel.summary
            });
          }
        }
      });
    });
  }

  createNovelCard(novel, authorName) {
    const memory = this.memoryData[novel.id] || {};
    const isBookmarked = this.bookmarkedNovels.has(novel.id.toString());
    const hasProgress = memory.progress > 0;

    // Generate random genre for demo (in real app, this would come from DB)
    const genres = ['fantasy', 'sci-fi', 'romance', 'mystery', 'slice-of-life'];
    const randomGenre = genres[Math.floor(Math.random() * genres.length)];

    return `
      <div class="novel-card ${hasProgress ? 'reading-memory' : ''} ${isBookmarked ? 'bookmarked' : ''}"
           data-novel-id="${novel.id}"
           data-genre="${randomGenre}">
        ${isBookmarked ? '<div class="bookmark-icon">❤️</div>' : ''}
        ${hasProgress ? `<div class="memory-indicator">Chap ${memory.lastChapter || '?'}</div>` : ''}

        <div class="novel-title">${this.escapeHtml(novel.title)}</div>

        <div class="novel-meta">
          <span>Tác giả: ${this.escapeHtml(authorName || 'Không rõ')}</span>
          <span>Trạng thái: ${novel.status || 'Đang cập nhật'}</span>
        </div>

        <div class="novel-summary">${this.escapeHtml(novel.summary || '')}</div>

        <div class="novel-tags">
          <span class="novel-tag">${randomGenre}</span>
          <span class="novel-tag">Huyền huyễn</span>
        </div>

        <div class="novel-mood-tags">
          <span class="mood-tag">🌟 Hấp dẫn</span>
          <span class="mood-tag">⚡ Nhanh节奏</span>
        </div>

        ${hasProgress ? `
          <div class="novel-progress">
            <div class="progress-bar">
              <div class="progress-fill" style="width: ${memory.progress || 0}%"></div>
            </div>
            <div class="progress-text">Đã đọc: ${memory.progress || 0}% - Chap ${memory.lastChapter || 1}</div>
          </div>
        ` : ''}

        <div class="novel-actions">
          <button class="action-btn" onclick="event.stopPropagation(); window.location.href='novel/novel-detail.html?id=${novel.id}'">
            📖 Đọc ngay
          </button>
          <button class="action-btn primary" onclick="event.stopPropagation(); /* preview logic */">
            👁️ Xem nhanh
          </button>
        </div>
      </div>
    `;
  }

  generatePreviewContent(summary) {
    // Generate preview content from summary (first 2-3 paragraphs worth)
    if (!summary) return 'Nội dung đang được cập nhật...';

    const words = summary.split(' ');
    const previewLength = Math.min(words.length, 150); // About 2-3 paragraphs worth
    return words.slice(0, previewLength).join(' ') + (words.length > previewLength ? '...' : '');
  }

  showError(message) {
    if (this.listContainer) {
      this.listContainer.innerHTML = `
        <div class="error-message">
          <p>❌ ${message}</p>
          <button onclick="location.reload()">🔄 Thử lại</button>
        </div>
      `;
    }
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}