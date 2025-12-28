import { supabase } from '../supabase/supabase.js';

export class NovelManager {
  constructor() {
    this.authorSelect = document.getElementById('novel-author');
    this.genreSelect = document.getElementById('novel-genres');
    this.form = document.getElementById('novel-form');
    this.messageEl = document.getElementById('novel-message');
    this.addAuthorBtn = document.getElementById('add-author-btn');
    this.novelListBody = document.getElementById('novel-list-body');
    this.editingNovelId = null;
    this.init();
  }

  async init() {
    try {
      await this.loadAuthors();
      await this.loadGenres();
      await this.loadNovels();
      if (this.form) {
        this.form.onsubmit = this.addOrUpdateNovel.bind(this);
      }
      if (this.addAuthorBtn) {
        this.addAuthorBtn.onclick = this.addAuthor.bind(this);
      }
    } catch (err) {
      console.error('Error in init:', err);
      this.showError('Đã xảy ra lỗi khi khởi tạo. Vui lòng thử lại sau.');
    }
  }

  async loadAuthors() {
    try {
      if (!this.authorSelect) {
        console.error('authorSelect not found');
        return;
      }

      this.authorSelect.innerHTML = '';
      const { data: authors, error } = await supabase
        .from('authors')
        .select('id, name')
        .order('name');

      if (error) {
        console.error('Error loading authors:', error);
        return;
      }

      if (authors && authors.length) {
        authors.forEach(a => {
          const opt = document.createElement('option');
          opt.value = a.id;
          opt.textContent = a.name || '';
          this.authorSelect.appendChild(opt);
        });
      }
    } catch (err) {
      console.error('Error in loadAuthors:', err);
    }
  }

  async loadGenres() {
    try {
      if (!this.genreSelect) {
        console.error('genreSelect not found');
        return;
      }

      this.genreSelect.innerHTML = '';
      const { data: genres, error } = await supabase
        .from('genres')
        .select('id, name')
        .order('name');

      if (error) {
        console.error('Error loading genres:', error);
        return;
      }

      if (genres && genres.length) {
        genres.forEach(g => {
          const opt = document.createElement('option');
          opt.value = g.id;
          opt.textContent = g.name || '';
          this.genreSelect.appendChild(opt);
        });
      }
    } catch (err) {
      console.error('Error in loadGenres:', err);
    }
  }

  showError(message) {
    if (this.messageEl) {
      this.messageEl.textContent = message;
      this.messageEl.style.color = 'red';
    }
  }

  async loadNovels() {
    try {
      if (!this.novelListBody) {
        console.error('novelListBody not found');
        return;
      }

      this.novelListBody.innerHTML = '<tr><td colspan="5">Đang tải...</td></tr>';
      
      // Lấy novels, authors, genres
      const [novelsResult, authorsResult, genresResult, novelGenresResult] = await Promise.all([
        supabase.from('novels').select('id, title, author_id, status, summary'),
        supabase.from('authors').select('id, name'),
        supabase.from('genres').select('id, name'),
        supabase.from('novel_genres').select('novel_id, genre_id')
      ]);

      if (novelsResult.error) {
        console.error('Error loading novels:', novelsResult.error);
        this.novelListBody.innerHTML = '<tr><td colspan="5" style="color: red;">❌ Lỗi khi tải danh sách tiểu thuyết</td></tr>';
        return;
      }

      const novels = novelsResult.data || [];
      const authors = authorsResult.data || [];
      const genres = genresResult.data || [];
      const novelGenres = novelGenresResult.data || [];

      // Map authors, genres
      const authorsMap = Object.fromEntries(authors.map(a => [a.id, a.name || '']));
      const genresMap = Object.fromEntries(genres.map(g => [g.id, g.name || '']));
      
      // Render
      this.novelListBody.innerHTML = novels.map(novel => {
        const gIds = novelGenres.filter(ng => ng.novel_id === novel.id).map(ng => ng.genre_id);
        const gNames = gIds.map(id => genresMap[id]).filter(Boolean).join(', ');
        return `<tr>
          <td>${this.escapeHtml(novel.title || '')}</td>
          <td>${this.escapeHtml(authorsMap[novel.author_id] || 'Không rõ')}</td>
          <td>${novel.status || ''}</td>
          <td>${this.escapeHtml(gNames)}</td>
          <td>
            <a class="btn-secondary" href="volume-manager.html?novel_id=${novel.id}">Quản lý quyển</a>
            <button class="btn-secondary" data-edit="${novel.id}">Sửa</button>
            <button class="btn-secondary" data-delete="${novel.id}">Xóa</button>
          </td>
        </tr>`;
      }).join('') || '<tr><td colspan="5">Chưa có tiểu thuyết nào</td></tr>';
      
      // Gắn event
      this.novelListBody.querySelectorAll('[data-edit]').forEach(btn => {
        btn.onclick = () => this.editNovel(btn.dataset.edit);
      });
      this.novelListBody.querySelectorAll('[data-delete]').forEach(btn => {
        btn.onclick = () => this.deleteNovel(btn.dataset.delete);
      });
    } catch (err) {
      console.error('Error in loadNovels:', err);
      if (this.novelListBody) {
        this.novelListBody.innerHTML = '<tr><td colspan="5" style="color: red;">❌ Đã xảy ra lỗi khi tải danh sách tiểu thuyết</td></tr>';
      }
    }
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  async addOrUpdateNovel(e) {
    e.preventDefault();
    try {
      const titleInput = document.getElementById('novel-title');
      const statusInput = document.getElementById('novel-status');
      const summaryInput = document.getElementById('novel-summary');

      if (!titleInput || !statusInput || !this.authorSelect || !this.genreSelect) {
        this.showError('Không tìm thấy các trường input cần thiết');
        return;
      }

      const title = titleInput.value.trim();
      const author_id = this.authorSelect.value;
      const status = statusInput.value;
      const summary = (summaryInput?.value || '').trim();
      const genre_ids = Array.from(this.genreSelect.selectedOptions).map(opt => opt.value);

      if (this.messageEl) {
        this.messageEl.textContent = '';
      }

      if (!title || !author_id || !status) {
        this.showError('Vui lòng nhập đầy đủ thông tin bắt buộc.');
        return;
      }

      let novel, error;
      if (this.editingNovelId) {
        // Update
        const result = await supabase
          .from('novels')
          .update({ title, author_id, status, summary })
          .eq('id', this.editingNovelId)
          .select()
          .single();
        novel = result.data;
        error = result.error;

        if (!error) {
          // Xóa hết novel_genres cũ, thêm lại
          const deleteResult = await supabase
            .from('novel_genres')
            .delete()
            .eq('novel_id', this.editingNovelId);
          
          if (deleteResult.error) {
            console.warn('Error deleting old genres:', deleteResult.error);
          }

          if (genre_ids.length) {
            const rows = genre_ids.map(genre_id => ({ novel_id: this.editingNovelId, genre_id }));
            const insertResult = await supabase.from('novel_genres').insert(rows);
            if (insertResult.error) {
              console.warn('Error inserting genres:', insertResult.error);
            }
          }
        }
      } else {
        // Thêm mới
        const result = await supabase
          .from('novels')
          .insert([{ title, author_id, status, summary }])
          .select()
          .single();
        novel = result.data;
        error = result.error;

        if (!error && novel && genre_ids.length) {
          const rows = genre_ids.map(genre_id => ({ novel_id: novel.id, genre_id }));
          const insertResult = await supabase.from('novel_genres').insert(rows);
          if (insertResult.error) {
            console.warn('Error inserting genres:', insertResult.error);
          }
        }
      }

      if (error || !novel) {
        console.error('Error saving novel:', error);
        this.showError('Lỗi khi lưu tiểu thuyết. Vui lòng thử lại.');
        return;
      }

      if (this.messageEl) {
        this.messageEl.textContent = this.editingNovelId ? 'Cập nhật thành công!' : 'Thêm tiểu thuyết thành công!';
        this.messageEl.style.color = 'green';
      }
      if (this.form) {
        this.form.reset();
      }
      this.editingNovelId = null;
      await this.loadNovels();
    } catch (err) {
      console.error('Error in addOrUpdateNovel:', err);
      this.showError('Đã xảy ra lỗi không mong muốn khi lưu tiểu thuyết.');
    }
  }

  async editNovel(id) {
    try {
      const [novelResult, genresResult] = await Promise.all([
        supabase.from('novels').select('id, title, author_id, status, summary').eq('id', id).single(),
        supabase.from('novel_genres').select('genre_id').eq('novel_id', id)
      ]);

      const { data: novel, error: novelError } = novelResult;
      const { data: novelGenres, error: genresError } = genresResult;

      if (novelError || !novel) {
        console.error('Error loading novel:', novelError);
        this.showError('Không tìm thấy tiểu thuyết để chỉnh sửa.');
        return;
      }

      if (genresError) {
        console.warn('Error loading genres:', genresError);
      }

      // Đổ dữ liệu vào form
      const titleInput = document.getElementById('novel-title');
      const statusInput = document.getElementById('novel-status');
      const summaryInput = document.getElementById('novel-summary');

      if (titleInput) titleInput.value = novel.title || '';
      if (this.authorSelect) this.authorSelect.value = novel.author_id || '';
      if (statusInput) statusInput.value = novel.status || '';
      if (summaryInput) summaryInput.value = novel.summary || '';

      // Chọn thể loại
      if (this.genreSelect) {
        const genreIds = (novelGenres || []).map(g => g.genre_id);
        Array.from(this.genreSelect.options).forEach(opt => {
          opt.selected = genreIds.includes(opt.value);
        });
      }

      this.editingNovelId = id;
      if (this.messageEl) {
        this.messageEl.textContent = 'Đang sửa tiểu thuyết, hãy lưu để cập nhật.';
        this.messageEl.style.color = '#b58900';
      }
    } catch (err) {
      console.error('Error in editNovel:', err);
      this.showError('Đã xảy ra lỗi khi tải thông tin tiểu thuyết.');
    }
  }

  async deleteNovel(id) {
    try {
      if (!confirm('Bạn có chắc chắn muốn xóa tiểu thuyết này?')) return;

      const [deleteGenresResult, deleteNovelResult] = await Promise.all([
        supabase.from('novel_genres').delete().eq('novel_id', id),
        supabase.from('novels').delete().eq('id', id)
      ]);

      if (deleteGenresResult.error) {
        console.warn('Error deleting genres:', deleteGenresResult.error);
      }

      if (deleteNovelResult.error) {
        console.error('Error deleting novel:', deleteNovelResult.error);
        this.showError('Lỗi khi xóa tiểu thuyết. Vui lòng thử lại.');
        return;
      }

      if (this.messageEl) {
        this.messageEl.textContent = 'Đã xóa tiểu thuyết.';
        this.messageEl.style.color = 'green';
      }
      await this.loadNovels();
    } catch (err) {
      console.error('Error in deleteNovel:', err);
      this.showError('Đã xảy ra lỗi khi xóa tiểu thuyết.');
    }
  }

  async addAuthor() {
    try {
      const name = prompt('Nhập tên tác giả mới:');
      if (name && name.trim()) {
        const { error } = await supabase
          .from('authors')
          .insert([{ name: name.trim() }]);

        if (error) {
          console.error('Error adding author:', error);
          alert('Lỗi khi thêm tác giả. Vui lòng thử lại.');
          return;
        }

        await this.loadAuthors();
      }
    } catch (err) {
      console.error('Error in addAuthor:', err);
      alert('Đã xảy ra lỗi khi thêm tác giả.');
    }
  }
}