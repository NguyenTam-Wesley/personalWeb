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
    await this.loadNovel();
    await this.loadVolumes();
    this.form.onsubmit = this.addOrUpdateVolume.bind(this);
    this.backBtn.onclick = () => window.location.href = 'novel-manager.html';
  }

  async loadNovel() {
    if (!this.novelId) {
      this.novelTitleEl.textContent = 'Không tìm thấy tiểu thuyết';
      this.form.style.display = 'none';
      return;
    }
    const { data: novel } = await supabase.from('novels').select('title').eq('id', this.novelId).single();
    if (novel) {
      this.novelTitleEl.textContent = `Quản lý quyển: ${novel.title}`;
    }
  }

  async loadVolumes() {
    this.listBody.innerHTML = '<tr><td colspan="3">Đang tải...</td></tr>';
    const { data: volumes } = await supabase.from('volumes').select('id, title, order').eq('novel_id', this.novelId).order('order', { ascending: true });
    this.listBody.innerHTML = (volumes||[]).map(v => `
      <tr>
        <td>${v.title}</td>
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
  }

  async addOrUpdateVolume(e) {
    e.preventDefault();
    const title = this.titleInput.value.trim();
    const order = parseInt(this.orderInput.value, 10) || 1;
    this.messageEl.textContent = '';
    if (!title) {
      this.messageEl.textContent = 'Vui lòng nhập tiêu đề quyển.';
      this.messageEl.style.color = 'red';
      return;
    }
    let volume, error;
    if (this.editingVolumeId) {
      ({ data: volume, error } = await supabase.from('volumes').update({ title, order }).eq('id', this.editingVolumeId).select().single());
    } else {
      ({ data: volume, error } = await supabase.from('volumes').insert([
        { title, order, novel_id: this.novelId }
      ]).select().single());
    }
    if (error || !volume) {
      this.messageEl.textContent = 'Lỗi khi lưu quyển.';
      this.messageEl.style.color = 'red';
      return;
    }
    this.messageEl.textContent = this.editingVolumeId ? 'Cập nhật thành công!' : 'Thêm quyển thành công!';
    this.messageEl.style.color = 'green';
    this.form.reset();
    this.editingVolumeId = null;
    await this.loadVolumes();
  }

  async editVolume(id) {
    const { data: volume } = await supabase.from('volumes').select('id, title, order').eq('id', id).single();
    this.titleInput.value = volume.title;
    this.orderInput.value = volume.order || 1;
    this.editingVolumeId = id;
    this.messageEl.textContent = 'Đang sửa quyển, hãy lưu để cập nhật.';
    this.messageEl.style.color = '#b58900';
  }

  async deleteVolume(id) {
    if (!confirm('Bạn có chắc chắn muốn xóa quyển này?')) return;
    await supabase.from('volumes').delete().eq('id', id);
    this.messageEl.textContent = 'Đã xóa quyển.';
    this.messageEl.style.color = 'green';
    await this.loadVolumes();
  }
}