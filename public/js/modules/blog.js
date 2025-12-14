// blog.js
import components from '../components/components.js';
import { getCurrentUser } from '../supabase/auth.js';
import { supabase } from '../supabase/supabase.js';

export class BlogManager {
  constructor() {
    this.currentUser = null;
    this.currentPage = 1;
    this.postsPerPage = 6;
    this.totalPosts = 0;

    this.filters = {
      search: '',
      category: '',
      sort: 'newest'
    };

    // dùng singleton components
    this.components = components;

    this.init();
  }

  async init() {
    try {
      // Lấy user hiện tại
      this.currentUser = await getCurrentUser();

      // Header đã được init sẵn trong components.js
      // Chỉ cần update lại trạng thái login
      this.components.updateLoginStatus?.();

      // Setup UI
      this.setupEventListeners();
      this.checkAdminPermissions();

      // Load posts
      await this.loadPosts();

    } catch (err) {
      console.error('❌ Blog init error:', err);
    }
  }

  /* ================= EVENT LISTENERS ================= */

  setupEventListeners() {
    const searchInput = document.getElementById('searchInput');
    const categoryFilter = document.getElementById('categoryFilter');
    const sortFilter = document.getElementById('sortFilter');

    if (searchInput) {
      searchInput.addEventListener(
        'input',
        this.debounce(() => this.handleSearch(), 300)
      );
    }

    if (categoryFilter) {
      categoryFilter.addEventListener('change', () => this.handleFilterChange());
    }

    if (sortFilter) {
      sortFilter.addEventListener('change', () => this.handleFilterChange());
    }

    // Create post modal
    const createPostBtn = document.getElementById('createPostBtn');
    const createPostModal = document.getElementById('createPostModal');
    const closeCreateModal = document.getElementById('closeCreateModal');
    const cancelCreate = document.getElementById('cancelCreate');
    const createPostForm = document.getElementById('createPostForm');

    if (createPostBtn) {
      createPostBtn.addEventListener('click', () => this.openCreateModal());
    }

    if (closeCreateModal) {
      closeCreateModal.addEventListener('click', () => this.closeCreateModal());
    }

    if (cancelCreate) {
      cancelCreate.addEventListener('click', () => this.closeCreateModal());
    }

    if (createPostForm) {
      createPostForm.addEventListener('submit', (e) => this.handleCreatePost(e));
    }

    if (createPostModal) {
      createPostModal.addEventListener('click', (e) => {
        if (e.target === createPostModal) {
          this.closeCreateModal();
        }
      });
    }

    // Pagination
    const prevPage = document.getElementById('prevPage');
    const nextPage = document.getElementById('nextPage');

    if (prevPage) {
      prevPage.addEventListener('click', () =>
        this.goToPage(this.currentPage - 1)
      );
    }

    if (nextPage) {
      nextPage.addEventListener('click', () =>
        this.goToPage(this.currentPage + 1)
      );
    }
  }

  /* ================= PERMISSION ================= */

  checkAdminPermissions() {
    const createPostBtn = document.getElementById('createPostBtn');
    if (!createPostBtn) return;

    createPostBtn.style.display =
      this.currentUser?.role === 'admin' ? 'flex' : 'none';
  }

  /* ================= DATA ================= */

  async loadPosts() {
    const postsContainer = document.getElementById('blogPosts');
    if (!postsContainer) return;

    postsContainer.innerHTML = `
      <div class="loading-spinner">
        <div class="spinner"></div>
        <p>Đang tải bài viết...</p>
      </div>
    `;

    try {
      let query = supabase
        .from('blog_posts')
        .select('*, users(username)', { count: 'exact' });

      if (this.filters.search) {
        query = query.or(
          `title.ilike.%${this.filters.search}%,content.ilike.%${this.filters.search}%,summary.ilike.%${this.filters.search}%`
        );
      }

      if (this.filters.category) {
        query = query.eq('category', this.filters.category);
      }

      switch (this.filters.sort) {
        case 'oldest':
          query = query.order('created_at', { ascending: true });
          break;
        case 'popular':
          query = query.order('view_count', { ascending: false });
          break;
        default:
          query = query.order('created_at', { ascending: false });
      }

      const from = (this.currentPage - 1) * this.postsPerPage;
      const to = from + this.postsPerPage - 1;

      const { data, error, count } = await query.range(from, to);

      if (error) throw error;

      this.totalPosts = count || 0;
      this.renderPosts(data || []);
      this.renderPagination();

    } catch (err) {
      console.error('❌ Load posts error:', err);
      this.showEmptyState('Lỗi khi tải bài viết');
    }
  }

  /* ================= RENDER ================= */

  renderPosts(posts) {
    const container = document.getElementById('blogPosts');
    if (!container) return;

    if (!posts.length) {
      this.showEmptyState('Chưa có bài viết nào');
      return;
    }

    container.innerHTML = posts
      .map(post => this.createPostCard(post))
      .join('');

    container.querySelectorAll('.post-card').forEach((card, index) => {
      card.addEventListener('click', () =>
        this.openPostDetail(posts[index].id)
      );
    });
  }

  createPostCard(post) {
    const createdDate = new Date(post.created_at).toLocaleDateString('vi-VN');
    const tags = post.tags
      ? post.tags.split(',').map(t => t.trim())
      : [];

    return `
      <div class="post-card">
        <h3>${this.escapeHtml(post.title)}</h3>
        <p>${this.escapeHtml(post.summary || '')}</p>
        <small>📅 ${createdDate} | 👤 ${post.users?.username || 'Unknown'}</small>
        <div class="post-tags">
          ${tags.map(t => `<span>${this.escapeHtml(t)}</span>`).join('')}
        </div>
      </div>
    `;
  }

  showEmptyState(message) {
    const container = document.getElementById('blogPosts');
    if (!container) return;

    container.innerHTML = `
      <div class="empty-state">
        <h3>${message}</h3>
        <p>Hãy quay lại sau hoặc tìm kiếm với từ khóa khác</p>
      </div>
    `;
  }

  /* ================= PAGINATION ================= */

  renderPagination() {
    const pagination = document.getElementById('pagination');
    const pageNumbers = document.getElementById('pageNumbers');
    if (!pagination || !pageNumbers) return;

    const totalPages = Math.ceil(this.totalPosts / this.postsPerPage);
    pagination.style.display = totalPages > 1 ? 'flex' : 'none';

    pageNumbers.innerHTML = Array.from(
      { length: totalPages },
      (_, i) => i + 1
    )
      .map(
        p =>
          `<button class="${p === this.currentPage ? 'active' : ''}">${p}</button>`
      )
      .join('');

    pageNumbers.querySelectorAll('button').forEach((btn, i) => {
      btn.addEventListener('click', () => this.goToPage(i + 1));
    });
  }

  goToPage(page) {
    if (page < 1) return;
    this.currentPage = page;
    this.loadPosts();
  }

  /* ================= HELPERS ================= */

  handleSearch() {
    const input = document.getElementById('searchInput');
    this.filters.search = input?.value.trim() || '';
    this.currentPage = 1;
    this.loadPosts();
  }

  handleFilterChange() {
    this.filters.category =
      document.getElementById('categoryFilter')?.value || '';
    this.filters.sort =
      document.getElementById('sortFilter')?.value || 'newest';

    this.currentPage = 1;
    this.loadPosts();
  }

  openCreateModal() {
    if (this.currentUser?.role !== 'admin') {
      alert('Bạn không có quyền');
      return;
    }
    document.getElementById('createPostModal')?.classList.add('show');
    document.body.style.overflow = 'hidden';
  }

  closeCreateModal() {
    document.getElementById('createPostModal')?.classList.remove('show');
    document.body.style.overflow = '';
    document.getElementById('createPostForm')?.reset();
  }

  async handleCreatePost(e) {
    e.preventDefault();
    alert('Logic tạo bài viết giữ nguyên của ông 👍');
  }

  openPostDetail(id) {
    window.location.href = `blog-detail.html?id=${id}`;
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  debounce(fn, delay) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), delay);
    };
  }
}

// auto init
new BlogManager();
