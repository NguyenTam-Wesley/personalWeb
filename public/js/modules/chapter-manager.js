import { supabase } from '../supabase/supabase.js';

class ChapterManager {
  constructor() {
    this.urlParams = new URLSearchParams(window.location.search);
    this.volumeId = this.urlParams.get('volume_id');
    this.volumeTitleEl = document.getElementById('volume-title');
    this.backBtn = document.getElementById('back-btn');
    this.form = document.getElementById('chapter-form');
    this.titleInput = document.getElementById('chapter-title');
    this.orderInput = document.getElementById('chapter-order');
    this.contentInput = document.getElementById('chapter-content');
    this.messageEl = document.getElementById('chapter-message');
    this.listBody = document.getElementById('chapter-list-body');
    this.editingChapterId = null;
    this.init();
  }

  async init() {
    await this.loadVolume();
    await this.loadChapters();
    this.form.onsubmit = this.addOrUpdateChapter.bind(this);
    this.backBtn.onclick = () => window.location.href = 'volume-manager.html?novel_id=' + (this.volumeNovelId || '');
  }

  async loadVolume() {
    if (!this.volumeId) {
      this.volumeTitleEl.textContent = 'Không tìm thấy quyển';
      this.form.style.display = 'none';
      return;
    }
    const { data: volume } = await supabase.from('volumes').select('id, title, novel_id').eq('id', this.volumeId).single();
    if (volume) {
      this.volumeTitleEl.textContent = `Quản lý chương: ${volume.title}`;
      this.volumeNovelId = volume.novel_id;
    }
  }

  async loadChapters() {
    this.listBody.innerHTML = '<tr><td colspan="3">Đang tải...</td></tr>';
    const { data: chapters } = await supabase.from('chapters').select('id, title, order').eq('volume_id', this.volumeId).order('order', { ascending: true });
    this.listBody.innerHTML = (chapters||[]).map(c => `
      <tr>
        <td>${c.title}</td>
        <td>${c.order || ''}</td>
        <td>
          <button class="btn-secondary" data-edit="${c.id}">Sửa</button>
          <button class="btn-secondary" data-delete="${c.id}">Xóa</button>
        </td>
      </tr>
    `).join('') || '<tr><td colspan="3">Chưa có chương nào</td></tr>';
    this.listBody.querySelectorAll('[data-edit]').forEach(btn => {
      btn.onclick = () => this.editChapter(btn.dataset.edit);
    });
    this.listBody.querySelectorAll('[data-delete]').forEach(btn => {
      btn.onclick = () => this.deleteChapter(btn.dataset.delete);
    });
  }

  async addOrUpdateChapter(e) {
    e.preventDefault();
    const title = this.titleInput.value.trim();
    const order = parseInt(this.orderInput.value, 10) || 1;
    const content = this.contentInput.value.trim();
    this.messageEl.textContent = '';
    if (!title || !content) {
      this.messageEl.textContent = 'Vui lòng nhập tiêu đề và nội dung chương.';
      this.messageEl.style.color = 'red';
      return;
    }
    let chapter, error;
    if (this.editingChapterId) {
      ({ data: chapter, error } = await supabase.from('chapters').update({ title, order, content }).eq('id', this.editingChapterId).select().single());
    } else {
      ({ data: chapter, error } = await supabase.from('chapters').insert([
        { title, order, content, volume_id: this.volumeId }
      ]).select().single());
    }
    if (error || !chapter) {
      this.messageEl.textContent = 'Lỗi khi lưu chương.';
      this.messageEl.style.color = 'red';
      return;
    }
    this.messageEl.textContent = this.editingChapterId ? 'Cập nhật thành công!' : 'Thêm chương thành công!';
    this.messageEl.style.color = 'green';
    this.form.reset();
    this.editingChapterId = null;
    await this.loadChapters();
  }

  async editChapter(id) {
    const { data: chapter } = await supabase.from('chapters').select('id, title, order, content').eq('id', id).single();
    this.titleInput.value = chapter.title;
    this.orderInput.value = chapter.order || 1;
    this.contentInput.value = chapter.content || '';
    this.editingChapterId = id;
    this.messageEl.textContent = 'Đang sửa chương, hãy lưu để cập nhật.';
    this.messageEl.style.color = '#b58900';
  }

  async deleteChapter(id) {
    if (!confirm('Bạn có chắc chắn muốn xóa chương này?')) return;
    await supabase.from('chapters').delete().eq('id', id);
    this.messageEl.textContent = 'Đã xóa chương.';
    this.messageEl.style.color = 'green';
    await this.loadChapters();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new ChapterManager();
}); 