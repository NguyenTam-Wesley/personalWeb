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
    await this.loadAuthors();
    await this.loadGenres();
    await this.loadNovels();
    this.form.onsubmit = this.addOrUpdateNovel.bind(this);
    this.addAuthorBtn.onclick = this.addAuthor.bind(this);
  }

  async loadAuthors() {
    this.authorSelect.innerHTML = '';
    const { data: authors } = await supabase.from('authors').select('id, name').order('name');
    if (authors && authors.length) {
      authors.forEach(a => {
        const opt = document.createElement('option');
        opt.value = a.id;
        opt.textContent = a.name;
        this.authorSelect.appendChild(opt);
      });
    }
  }

  async loadGenres() {
    this.genreSelect.innerHTML = '';
    const { data: genres } = await supabase.from('genres').select('id, name').order('name');
    if (genres && genres.length) {
      genres.forEach(g => {
        const opt = document.createElement('option');
        opt.value = g.id;
        opt.textContent = g.name;
        this.genreSelect.appendChild(opt);
      });
    }
  }

  async loadNovels() {
    this.novelListBody.innerHTML = '<tr><td colspan="5">Đang tải...</td></tr>';
    // Lấy novels, authors, genres
    const { data: novels } = await supabase.from('novels').select('id, title, author_id, status, summary');
    const { data: authors } = await supabase.from('authors').select('id, name');
    const { data: genres } = await supabase.from('genres').select('id, name');
    const { data: novelGenres } = await supabase.from('novel_genres').select('novel_id, genre_id');
    // Map authors, genres
    const authorsMap = Object.fromEntries((authors||[]).map(a => [a.id, a.name]));
    const genresMap = Object.fromEntries((genres||[]).map(g => [g.id, g.name]));
    // Render
    this.novelListBody.innerHTML = (novels||[]).map(novel => {
      const gIds = (novelGenres||[]).filter(ng => ng.novel_id === novel.id).map(ng => ng.genre_id);
      const gNames = gIds.map(id => genresMap[id]).filter(Boolean).join(', ');
      return `<tr>
        <td>${novel.title}</td>
        <td>${authorsMap[novel.author_id]||'Không rõ'}</td>
        <td>${novel.status}</td>
        <td>${gNames}</td>
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
  }

  async addOrUpdateNovel(e) {
    e.preventDefault();
    const title = document.getElementById('novel-title').value.trim();
    const author_id = this.authorSelect.value;
    const status = document.getElementById('novel-status').value;
    const summary = document.getElementById('novel-summary').value.trim();
    const genre_ids = Array.from(this.genreSelect.selectedOptions).map(opt => opt.value);
    this.messageEl.textContent = '';
    if (!title || !author_id || !status) {
      this.messageEl.textContent = 'Vui lòng nhập đầy đủ thông tin bắt buộc.';
      this.messageEl.style.color = 'red';
      return;
    }
    let novel, error;
    if (this.editingNovelId) {
      // Update
      ({ data: novel, error } = await supabase.from('novels').update({ title, author_id, status, summary }).eq('id', this.editingNovelId).select().single());
      // Xóa hết novel_genres cũ, thêm lại
      await supabase.from('novel_genres').delete().eq('novel_id', this.editingNovelId);
      if (genre_ids.length) {
        const rows = genre_ids.map(genre_id => ({ novel_id: this.editingNovelId, genre_id }));
        await supabase.from('novel_genres').insert(rows);
      }
    } else {
      // Thêm mới
      ({ data: novel, error } = await supabase.from('novels').insert([
        { title, author_id, status, summary }
      ]).select().single());
      if (novel && genre_ids.length) {
        const rows = genre_ids.map(genre_id => ({ novel_id: novel.id, genre_id }));
        await supabase.from('novel_genres').insert(rows);
      }
    }
    if (error || !novel) {
      this.messageEl.textContent = 'Lỗi khi lưu tiểu thuyết.';
      this.messageEl.style.color = 'red';
      return;
    }
    this.messageEl.textContent = this.editingNovelId ? 'Cập nhật thành công!' : 'Thêm tiểu thuyết thành công!';
    this.messageEl.style.color = 'green';
    this.form.reset();
    this.editingNovelId = null;
    await this.loadNovels();
  }

  async editNovel(id) {
    // Lấy dữ liệu tiểu thuyết
    const { data: novel } = await supabase.from('novels').select('id, title, author_id, status, summary').eq('id', id).single();
    const { data: novelGenres } = await supabase.from('novel_genres').select('genre_id').eq('novel_id', id);
    // Đổ dữ liệu vào form
    document.getElementById('novel-title').value = novel.title;
    this.authorSelect.value = novel.author_id;
    document.getElementById('novel-status').value = novel.status;
    document.getElementById('novel-summary').value = novel.summary || '';
    // Chọn thể loại
    const genreIds = (novelGenres||[]).map(g => g.genre_id);
    Array.from(this.genreSelect.options).forEach(opt => {
      opt.selected = genreIds.includes(opt.value);
    });
    this.editingNovelId = id;
    this.messageEl.textContent = 'Đang sửa tiểu thuyết, hãy lưu để cập nhật.';
    this.messageEl.style.color = '#b58900';
  }

  async deleteNovel(id) {
    if (!confirm('Bạn có chắc chắn muốn xóa tiểu thuyết này?')) return;
    await supabase.from('novel_genres').delete().eq('novel_id', id);
    await supabase.from('novels').delete().eq('id', id);
    this.messageEl.textContent = 'Đã xóa tiểu thuyết.';
    this.messageEl.style.color = 'green';
    await this.loadNovels();
  }

  async addAuthor() {
    const name = prompt('Nhập tên tác giả mới:');
    if (name && name.trim()) {
      await supabase.from('authors').insert([{ name: name.trim() }]);
      this.loadAuthors();
    }
  }
}