import { supabase } from '../supabase/supabase.js';

export class VolumeManager {
  constructor() {
    this.urlParams = new URLSearchParams(window.location.search);
    this.novelId = this.urlParams.get('novel_id');
    this.novelTitleEl = document.getElementById('novel-title');
    this.backBtn = document.getElementById('back-btn');
    this.form = document.getElementById('volume-form');
    this.titleInput = document.getElementById('volume-title');
    this.orderInput = document.getElementById('volume-order');
    this.messageEl = document.getElementById('volume-message');
    this.listBody = document.getElementById('volume-list-body');
    this.editingVolumeId = null;
    this.init();
  }

  async init() {
    try {
      await this.loadNovel();
      await this.loadVolumes();
      if (this.form) {
        this.form.onsubmit = this.addOrUpdateVolume.bind(this);
      }
      if (this.backBtn) {
        this.backBtn.onclick = () => window.location.href = 'novel-manager.html';
      }
    } catch (err) {
      console.error('Error in init:', err);
      this.showError('Đã xảy ra lỗi khi khởi tạo. Vui lòng thử lại sau.');
    }
  }

  async loadNovel() {
    try {
      if (!this.novelId) {
        if (this.volumeTitleEl) {
          this.volumeTitleEl.textContent = 'Không tìm thấy tiểu thuyết';
        }
        if (this.form) {
          this.form.style.display = 'none';
        }
        return;
      }
      const { data: novel, error } = await supabase
        .from('novels')
        .select('title')
        .eq('id', this.novelId)
        .single();
      
      if (error) {
        console.error('Error loading novel:', error);
        if (this.novelTitleEl) {
          this.novelTitleEl.textContent = 'Lỗi khi tải thông tin tiểu thuyết';
        }
        return;
      }

      if (novel && this.novelTitleEl) {
        this.novelTitleEl.textContent = `Quản lý quyển: ${novel.title || ''}`;
      }
    } catch (err) {
      console.error('Error in loadNovel:', err);
      if (this.novelTitleEl) {
        this.novelTitleEl.textContent = 'Lỗi khi tải thông tin tiểu thuyết';
      }
    }
  }

  async loadVolumes() {
    try {
      if (!this.listBody) {
        console.error('listBody not found');
        return;
      }

      this.listBody.innerHTML = '<tr><td colspan="3">Đang tải...</td></tr>';
      const { data: volumes, error } = await supabase
        .from('volumes')
        .select('id, title, order')
        .eq('novel_id', this.novelId)
        .order('order', { ascending: true });

      if (error) {
        console.error('Error loading volumes:', error);
        this.listBody.innerHTML = '<tr><td colspan="3" style="color: red;">❌ Lỗi khi tải danh sách quyển</td></tr>';
        return;
      }

      this.listBody.innerHTML = (volumes||[]).map(v => `
        <tr>
          <td>${this.escapeHtml(v.title || '')}</td>
          <td>${v.order || ''}</td>
          <td>
            <a class="btn-secondary" href="chapter-manager.html?volume_id=${v.id}">Quản lý chương</a>
            <button class="btn-secondary" data-edit="${v.id}">Sửa</button>
            <button class="btn-secondary" data-delete="${v.id}">Xóa</button>
          </td>
        </tr>
      `).join('') || '<tr><td colspan="3">Chưa có quyển nào</td></tr>';
      
      this.listBody.querySelectorAll('[data-edit]').forEach(btn => {
        btn.onclick = () => this.editVolume(btn.dataset.edit);
      });
      this.listBody.querySelectorAll('[data-delete]').forEach(btn => {
        btn.onclick = () => this.deleteVolume(btn.dataset.delete);
      });
    } catch (err) {
      console.error('Error in loadVolumes:', err);
      if (this.listBody) {
        this.listBody.innerHTML = '<tr><td colspan="3" style="color: red;">❌ Đã xảy ra lỗi khi tải danh sách quyển</td></tr>';
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

  async addOrUpdateVolume(e) {
    e.preventDefault();
    try {
      if (!this.titleInput) {
        this.showError('Không tìm thấy trường input tiêu đề');
        return;
      }

      const title = this.titleInput.value.trim();
      const order = parseInt(this.orderInput?.value || '1', 10) || 1;
      
      if (this.messageEl) {
        this.messageEl.textContent = '';
      }

      if (!title) {
        this.showError('Vui lòng nhập tiêu đề quyển.');
        return;
      }

      let volume, error;
      if (this.editingVolumeId) {
        const result = await supabase
          .from('volumes')
          .update({ title, order })
          .eq('id', this.editingVolumeId)
          .select()
          .single();
        volume = result.data;
        error = result.error;
      } else {
        const result = await supabase
          .from('volumes')
          .insert([{ title, order, novel_id: this.novelId }])
          .select()
          .single();
        volume = result.data;
        error = result.error;
      }

      if (error || !volume) {
        console.error('Error saving volume:', error);
        this.showError('Lỗi khi lưu quyển. Vui lòng thử lại.');
        return;
      }

      if (this.messageEl) {
        this.messageEl.textContent = this.editingVolumeId ? 'Cập nhật thành công!' : 'Thêm quyển thành công!';
        this.messageEl.style.color = 'green';
      }
      if (this.form) {
        this.form.reset();
      }
      this.editingVolumeId = null;
      await this.loadVolumes();
    } catch (err) {
      console.error('Error in addOrUpdateVolume:', err);
      this.showError('Đã xảy ra lỗi không mong muốn khi lưu quyển.');
    }
  }

  async editVolume(id) {
    try {
      const { data: volume, error } = await supabase
        .from('volumes')
        .select('id, title, order')
        .eq('id', id)
        .single();

      if (error || !volume) {
        console.error('Error loading volume:', error);
        this.showError('Không tìm thấy quyển để chỉnh sửa.');
        return;
      }

      if (this.titleInput) {
        this.titleInput.value = volume.title || '';
      }
      if (this.orderInput) {
        this.orderInput.value = volume.order || 1;
      }
      this.editingVolumeId = id;
      if (this.messageEl) {
        this.messageEl.textContent = 'Đang sửa quyển, hãy lưu để cập nhật.';
        this.messageEl.style.color = '#b58900';
      }
    } catch (err) {
      console.error('Error in editVolume:', err);
      this.showError('Đã xảy ra lỗi khi tải thông tin quyển.');
    }
  }

  async deleteVolume(id) {
    try {
      if (!confirm('Bạn có chắc chắn muốn xóa quyển này?')) return;

      const { error } = await supabase
        .from('volumes')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting volume:', error);
        this.showError('Lỗi khi xóa quyển. Vui lòng thử lại.');
        return;
      }

      if (this.messageEl) {
        this.messageEl.textContent = 'Đã xóa quyển.';
        this.messageEl.style.color = 'green';
      }
      await this.loadVolumes();
    } catch (err) {
      console.error('Error in deleteVolume:', err);
      this.showError('Đã xảy ra lỗi khi xóa quyển.');
    }
  }
}