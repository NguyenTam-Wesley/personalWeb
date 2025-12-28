export class NovelListPage {
  constructor() {
    this.listContainer = document.getElementById('novel-list');
    if (!this.listContainer) {
      console.error('Không tìm thấy element #novel-list');
      return;
    }
    this.loadNovels();
  }

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

      this.listContainer.innerHTML = novels.map(novel => `
        <div class="novel-item">
          <h2><a href="novel/novel-detail.html?id=${novel.id}">${this.escapeHtml(novel.title)}</a></h2>
          <p>Tác giả: ${this.escapeHtml(authorsMap[novel.author_id] || 'Không rõ')}</p>
          <p>${this.escapeHtml(novel.summary || '')}</p>
        </div>
      `).join('');
    } catch (err) {
      console.error('Unexpected error in loadNovels:', err);
      this.showError('Đã xảy ra lỗi không mong muốn. Vui lòng thử lại sau.');
    }
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