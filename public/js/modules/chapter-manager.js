import { supabase } from '../supabase/supabase.js';

export class ChapterManager {
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
    try {
      await this.loadVolume();
      await this.loadChapters();
      if (this.form) {
        this.form.onsubmit = this.addOrUpdateChapter.bind(this);
      }
      if (this.backBtn) {
        this.backBtn.onclick = () => window.location.href = 'volume-manager.html?novel_id=' + (this.volumeNovelId || '');
      }
    } catch (err) {
      console.error('Error in init:', err);
      this.showError('Đã xảy ra lỗi khi khởi tạo. Vui lòng thử lại sau.');
    }
  }

  async loadVolume() {
    try {
      if (!this.volumeId) {
        if (this.volumeTitleEl) {
          this.volumeTitleEl.textContent = 'Không tìm thấy quyển';
        }
        if (this.form) {
          this.form.style.display = 'none';
        }
        return;
      }
      const { data: volume, error } = await supabase
        .from('volumes')
        .select('id, title, novel_id')
        .eq('id', this.volumeId)
        .single();
      
      if (error) {
        console.error('Error loading volume:', error);
        if (this.volumeTitleEl) {
          this.volumeTitleEl.textContent = 'Lỗi khi tải thông tin quyển';
        }
        return;
      }

      if (volume && this.volumeTitleEl) {
        this.volumeTitleEl.textContent = `Quản lý chương: ${volume.title}`;
        this.volumeNovelId = volume.novel_id;
      }
    } catch (err) {
      console.error('Error in loadVolume:', err);
      if (this.volumeTitleEl) {
        this.volumeTitleEl.textContent = 'Lỗi khi tải thông tin quyển';
      }
    }
  }

  async loadChapters() {
    try {
      if (!this.listBody) {
        console.error('listBody not found');
        return;
      }

      this.listBody.innerHTML = '<tr><td colspan="3">Đang tải...</td></tr>';
      const { data: chapters, error } = await supabase
        .from('chapters')
        .select('id, title, order')
        .eq('volume_id', this.volumeId)
        .order('order', { ascending: true });

      if (error) {
        console.error('Error loading chapters:', error);
        this.listBody.innerHTML = '<tr><td colspan="3" style="color: red;">❌ Lỗi khi tải danh sách chương</td></tr>';
        return;
      }

      this.listBody.innerHTML = (chapters||[]).map(c => `
        <tr>
          <td>${this.escapeHtml(c.title || '')}</td>
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
    } catch (err) {
      console.error('Error in loadChapters:', err);
      if (this.listBody) {
        this.listBody.innerHTML = '<tr><td colspan="3" style="color: red;">❌ Đã xảy ra lỗi khi tải danh sách chương</td></tr>';
      }
    }
  }

  showError(message) {
    if (this.messageEl) {
      this.messageEl.textContent = message;
      this.messageEl.style.color = 'red';
    }
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  async addOrUpdateChapter(e) {
    e.preventDefault();
    try {
      if (!this.titleInput || !this.contentInput) {
        this.showError('Không tìm thấy các trường input cần thiết');
        return;
      }

      const title = this.titleInput.value.trim();
      const order = parseInt(this.orderInput?.value || '1', 10) || 1;
      const content = this.contentInput.value.trim();
      
      if (this.messageEl) {
        this.messageEl.textContent = '';
      }

      if (!title || !content) {
        this.showError('Vui lòng nhập tiêu đề và nội dung chương.');
        return;
      }

      let chapter, error;
      if (this.editingChapterId) {
        const result = await supabase
          .from('chapters')
          .update({ title, order, content })
          .eq('id', this.editingChapterId)
          .select()
          .single();
        chapter = result.data;
        error = result.error;
      } else {
        const result = await supabase
          .from('chapters')
          .insert([{ title, order, content, volume_id: this.volumeId }])
          .select()
          .single();
        chapter = result.data;
        error = result.error;
      }

      if (error || !chapter) {
        console.error('Error saving chapter:', error);
        this.showError('Lỗi khi lưu chương. Vui lòng thử lại.');
        return;
      }

      if (this.messageEl) {
        this.messageEl.textContent = this.editingChapterId ? 'Cập nhật thành công!' : 'Thêm chương thành công!';
        this.messageEl.style.color = 'green';
      }
      if (this.form) {
        this.form.reset();
      }
      this.editingChapterId = null;
      await this.loadChapters();
    } catch (err) {
      console.error('Error in addOrUpdateChapter:', err);
      this.showError('Đã xảy ra lỗi không mong muốn khi lưu chương.');
    }
  }

  async editChapter(id) {
    try {
      const { data: chapter, error } = await supabase
        .from('chapters')
        .select('id, title, order, content')
        .eq('id', id)
        .single();

      if (error || !chapter) {
        console.error('Error loading chapter:', error);
        this.showError('Không tìm thấy chương để chỉnh sửa.');
        return;
      }

      if (this.titleInput) {
        this.titleInput.value = chapter.title || '';
      }
      if (this.orderInput) {
        this.orderInput.value = chapter.order || 1;
      }
      if (this.contentInput) {
        this.contentInput.value = chapter.content || '';
      }
      this.editingChapterId = id;
      if (this.messageEl) {
        this.messageEl.textContent = 'Đang sửa chương, hãy lưu để cập nhật.';
        this.messageEl.style.color = '#b58900';
      }
    } catch (err) {
      console.error('Error in editChapter:', err);
      this.showError('Đã xảy ra lỗi khi tải thông tin chương.');
    }
  }

  async deleteChapter(id) {
    try {
      if (!confirm('Bạn có chắc chắn muốn xóa chương này?')) return;

      const { error } = await supabase
        .from('chapters')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting chapter:', error);
        this.showError('Lỗi khi xóa chương. Vui lòng thử lại.');
        return;
      }

      if (this.messageEl) {
        this.messageEl.textContent = 'Đã xóa chương.';
        this.messageEl.style.color = 'green';
      }
      await this.loadChapters();
    } catch (err) {
      console.error('Error in deleteChapter:', err);
      this.showError('Đã xảy ra lỗi khi xóa chương.');
    }
  }
}