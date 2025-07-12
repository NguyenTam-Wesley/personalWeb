import { supabase } from '../supabase/supabase.js';

class ChapterPage {
  constructor() {
    this.init(); // Gọi thẳng luôn
  }

  async init() {
    const urlParams = new URLSearchParams(window.location.search);
    const chapterId = urlParams.get('id');
    const titleEl = document.getElementById('chapter-title');
    const contentEl = document.getElementById('chapter-content');
    const prevBtn = document.getElementById('prev-chapter');
    const nextBtn = document.getElementById('next-chapter');

    // Lấy thông tin chương hiện tại
    const { data: chapter, error } = await supabase
      .from('chapters')
      .select('id, title, content, volume_id, "order"')
      .eq('id', chapterId)
      .single();

    if (error || !chapter) {
      titleEl.textContent = 'Không tìm thấy chương';
      contentEl.textContent = '';
      return;
    }

    titleEl.textContent = chapter.title;
    contentEl.innerHTML = chapter.content ? chapter.content.replace(/\n/g, '<br>') : '';

    // Lấy danh sách chương trong cùng volume, sắp xếp theo order
    const { data: chapters } = await supabase
      .from('chapters')
      .select('id, title, "order"')
      .eq('volume_id', chapter.volume_id)
      .order('order', { ascending: true });

    if (chapters && chapters.length > 1) {
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
  }
}

new ChapterPage(); 