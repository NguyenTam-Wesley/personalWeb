class NovelListPage {
  constructor() {
    this.listContainer = document.getElementById('novel-list');
    this.loadNovels();
  }

  async loadNovels() {
    this.listContainer.innerHTML = '<p>Đang tải danh sách tiểu thuyết...</p>';
    const { supabase } = await import('../supabase/supabase.js');
    // Lấy danh sách tiểu thuyết và tác giả
    const { data: novels, error } = await supabase
      .from('novels')
      .select('id, title, summary, status, author_id')
      .order('created_at', { ascending: false });
    if (error) {
      this.listContainer.innerHTML = '<p>Lỗi tải dữ liệu.</p>';
      return;
    }
    // Lấy thông tin tác giả cho từng tiểu thuyết
    let authorsMap = {};
    if (novels && novels.length > 0) {
      const authorIds = [...new Set(novels.map(n => n.author_id))];
      const { data: authors } = await supabase
        .from('authors')
        .select('id, name')
        .in('id', authorIds);
      if (authors) {
        authorsMap = Object.fromEntries(authors.map(a => [a.id, a.name]));
      }
    }
    this.listContainer.innerHTML = novels.map(novel => `
      <div class="novel-item">
        <h2><a href="novel/novel-detail.html?id=${novel.id}">${novel.title}</a></h2>
        <p>Tác giả: ${authorsMap[novel.author_id] || 'Không rõ'}</p>
        <p>${novel.summary || ''}</p>
      </div>
    `).join('');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new NovelListPage();
}); 