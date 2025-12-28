import { supabase } from '../supabase/supabase.js';

export class ChapterPage {
  constructor() {
    this.init(); // Gọi thẳng luôn
  }

  async init() {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const chapterId = urlParams.get('id');
      const titleEl = document.getElementById('chapter-title');
      const contentEl = document.getElementById('chapter-content');
      const prevBtn = document.getElementById('prev-chapter');
      const nextBtn = document.getElementById('next-chapter');

      if (!titleEl || !contentEl) {
        console.error('Không tìm thấy các elements cần thiết');
        return;
      }

      if (!chapterId) {
        this.showError('Không tìm thấy ID chương');
        return;
      }

      // Lấy thông tin chương hiện tại
      const { data: chapter, error } = await supabase
        .from('chapters')
        .select('id, title, content, volume_id, "order"')
        .eq('id', chapterId)
        .single();

      if (error || !chapter) {
        console.error('Error loading chapter:', error);
        this.showError('Không tìm thấy chương hoặc đã xảy ra lỗi.');
        return;
      }

      titleEl.textContent = chapter.title || 'Không có tiêu đề';
      contentEl.innerHTML = chapter.content ? this.escapeHtml(chapter.content).replace(/\n/g, '<br>') : '<p>Chưa có nội dung.</p>';

      // Lấy danh sách chương trong cùng volume, sắp xếp theo order
      try {
        const { data: chapters, error: chaptersError } = await supabase
          .from('chapters')
          .select('id, title, "order"')
          .eq('volume_id', chapter.volume_id)
          .order('order', { ascending: true });

        if (chaptersError) {
          console.error('Error loading chapters list:', chaptersError);
          return;
        }

        if (chapters && chapters.length > 1 && prevBtn && nextBtn) {
          const idx = chapters.findIndex(c => c.id === chapter.id);
          if (idx > 0) {
            prevBtn.style.display = '';
            prevBtn.onclick = () => {
              window.location.href = `chapter.html?id=${chapters[idx - 1].id}`;
            };
          }
          if (idx < chapters.length - 1) {
            nextBtn.style.display = '';
            nextBtn.onclick = () => {
              window.location.href = `chapter.html?id=${chapters[idx + 1].id}`;
            };
          }
        }
      } catch (err) {
        console.error('Error loading chapters list:', err);
      }
    } catch (err) {
      console.error('Unexpected error in init:', err);
      this.showError('Đã xảy ra lỗi không mong muốn. Vui lòng thử lại sau.');
    }
  }

  showError(message) {
    const titleEl = document.getElementById('chapter-title');
    const contentEl = document.getElementById('chapter-content');
    if (titleEl) {
      titleEl.textContent = 'Lỗi';
    }
    if (contentEl) {
      contentEl.innerHTML = `<p style="color: red;">❌ ${message}</p>`;
    }
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}