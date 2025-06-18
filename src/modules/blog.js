// blog.js
import { supabase } from '../supabase/supabase.js';
import { getCurrentUser } from '../supabase/auth.js';

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
    this.init();
  }

  async init() {
    // Kiểm tra user hiện tại
    this.currentUser = await getCurrentUser();
    
    // Setup UI
    this.setupEventListeners();
    this.checkAdminPermissions();
    
    // Load posts
    await this.loadPosts();
  }

  setupEventListeners() {
    // Search and filters
    const searchInput = document.getElementById('searchInput');
    const categoryFilter = document.getElementById('categoryFilter');
    const sortFilter = document.getElementById('sortFilter');

    if (searchInput) {
      searchInput.addEventListener('input', this.debounce(() => this.handleSearch(), 300));
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

    // Close modal when clicking outside
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
      prevPage.addEventListener('click', () => this.goToPage(this.currentPage - 1));
    }

    if (nextPage) {
      nextPage.addEventListener('click', () => this.goToPage(this.currentPage + 1));
    }
  }

  checkAdminPermissions() {
    const createPostBtn = document.getElementById('createPostBtn');
    if (createPostBtn) {
      if (this.currentUser && this.currentUser.role === 'admin') {
        createPostBtn.style.display = 'flex';
      } else {
        createPostBtn.style.display = 'none';
      }
    }
  }

  async loadPosts() {
    const postsContainer = document.getElementById('blogPosts');
    if (!postsContainer) return;

    try {
      // Show loading
      postsContainer.innerHTML = `
        <div class="loading-spinner">
          <div class="spinner"></div>
          <p>Đang tải bài viết...</p>
        </div>
      `;

      // Build query
      let query = supabase
        .from('blog_posts')
        .select('*, users(username)', { count: 'exact' });

      // Apply filters
      if (this.filters.search) {
        query = query.or(`title.ilike.%${this.filters.search}%,content.ilike.%${this.filters.search}%,summary.ilike.%${this.filters.search}%`);
      }

      if (this.filters.category) {
        query = query.eq('category', this.filters.category);
      }

      // Apply sorting
      switch (this.filters.sort) {
        case 'oldest':
          query = query.order('created_at', { ascending: true });
          break;
        case 'popular':
          query = query.order('view_count', { ascending: false });
          break;
        default: // newest
          query = query.order('created_at', { ascending: false });
      }

      // Apply pagination
      const from = (this.currentPage - 1) * this.postsPerPage;
      const to = from + this.postsPerPage - 1;
      query = query.range(from, to);

      const { data: posts, error, count } = await query;

      if (error) {
        console.error('Error loading posts:', error);
        this.showEmptyState('Lỗi khi tải bài viết');
        return;
      }

      this.totalPosts = count || 0;
      this.renderPosts(posts || []);
      this.renderPagination();

    } catch (error) {
      console.error('Error in loadPosts:', error);
      this.showEmptyState('Lỗi khi tải bài viết');
    }
  }

  renderPosts(posts) {
    const postsContainer = document.getElementById('blogPosts');
    if (!postsContainer) return;

    if (!posts || posts.length === 0) {
      this.showEmptyState('Chưa có bài viết nào');
      return;
    }

    const postsHTML = posts.map(post => this.createPostCard(post)).join('');
    postsContainer.innerHTML = postsHTML;

    // Add click events to post cards
    postsContainer.querySelectorAll('.post-card').forEach((card, index) => {
      card.addEventListener('click', () => this.openPostDetail(posts[index].id));
    });
  }

  createPostCard(post) {
    const createdDate = new Date(post.created_at).toLocaleDateString('vi-VN');
    const tags = post.tags ? post.tags.split(',').map(tag => tag.trim()) : [];
    
    return `
      <div class="post-card" data-post-id="${post.id}">
        <div class="post-header">
          <h3 class="post-title">${this.escapeHtml(post.title)}</h3>
          <div class="post-meta">
            <span class="post-category">${this.getCategoryName(post.category)}</span>
            <span>📅 ${createdDate}</span>
            <span>👤 ${post.users?.username || 'Unknown'}</span>
            <span>👁️ ${post.view_count || 0} lượt xem</span>
          </div>
        </div>
        ${post.summary ? `<p class="post-summary">${this.escapeHtml(post.summary)}</p>` : ''}
        ${tags.length > 0 ? `
          <div class="post-tags">
            ${tags.map(tag => `<span class="post-tag">${this.escapeHtml(tag)}</span>`).join('')}
          </div>
        ` : ''}
      </div>
    `;
  }

  showEmptyState(message) {
    const postsContainer = document.getElementById('blogPosts');
    if (!postsContainer) return;

    postsContainer.innerHTML = `
      <div class="empty-state">
        <div class="icon">📝</div>
        <h3>${message}</h3>
        <p>Hãy quay lại sau hoặc thử tìm kiếm với từ khóa khác.</p>
      </div>
    `;
  }

  renderPagination() {
    const pagination = document.getElementById('pagination');
    const pageNumbers = document.getElementById('pageNumbers');
    const prevPage = document.getElementById('prevPage');
    const nextPage = document.getElementById('nextPage');

    if (!pagination || !pageNumbers) return;

    const totalPages = Math.ceil(this.totalPosts / this.postsPerPage);

    if (totalPages <= 1) {
      pagination.style.display = 'none';
      return;
    }

    pagination.style.display = 'flex';

    // Update prev/next buttons
    if (prevPage) {
      prevPage.disabled = this.currentPage <= 1;
    }

    if (nextPage) {
      nextPage.disabled = this.currentPage >= totalPages;
    }

    // Generate page numbers
    const pages = [];
    const maxVisiblePages = 5;
    let startPage = Math.max(1, this.currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }

    pageNumbers.innerHTML = pages.map(page => `
      <button class="page-number ${page === this.currentPage ? 'active' : ''}" 
              onclick="this.dispatchEvent(new CustomEvent('pageClick', {detail: ${page}}))">
        ${page}
      </button>
    `).join('');

    // Add event listeners
    pageNumbers.querySelectorAll('.page-number').forEach((btn, index) => {
      btn.addEventListener('click', () => this.goToPage(pages[index]));
    });
  }

  goToPage(page) {
    const totalPages = Math.ceil(this.totalPosts / this.postsPerPage);
    if (page < 1 || page > totalPages) return;

    this.currentPage = page;
    this.loadPosts();
  }

  handleSearch() {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
      this.filters.search = searchInput.value.trim();
      this.currentPage = 1;
      this.loadPosts();
    }
  }

  handleFilterChange() {
    const categoryFilter = document.getElementById('categoryFilter');
    const sortFilter = document.getElementById('sortFilter');

    if (categoryFilter) {
      this.filters.category = categoryFilter.value;
    }

    if (sortFilter) {
      this.filters.sort = sortFilter.value;
    }

    this.currentPage = 1;
    this.loadPosts();
  }

  openCreateModal() {
    if (!this.currentUser || this.currentUser.role !== 'admin') {
      alert('Bạn không có quyền tạo bài viết');
      return;
    }

    const modal = document.getElementById('createPostModal');
    if (modal) {
      modal.classList.add('show');
      document.body.style.overflow = 'hidden';
    }
  }

  closeCreateModal() {
    const modal = document.getElementById('createPostModal');
    if (modal) {
      modal.classList.remove('show');
      document.body.style.overflow = '';
      
      // Reset form
      const form = document.getElementById('createPostForm');
      if (form) {
        form.reset();
      }
    }
  }

  async handleCreatePost(e) {
    e.preventDefault();

    if (!this.currentUser || this.currentUser.role !== 'admin') {
      alert('Bạn không có quyền tạo bài viết');
      return;
    }

    const form = e.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;

    try {
      submitBtn.textContent = 'Đang đăng...';
      submitBtn.disabled = true;

      const formData = new FormData(form);
      const postData = {
        title: formData.get('postTitle') || form.querySelector('#postTitle').value,
        category: formData.get('postCategory') || form.querySelector('#postCategory').value,
        summary: formData.get('postSummary') || form.querySelector('#postSummary').value,
        content: formData.get('postContent') || form.querySelector('#postContent').value,
        tags: formData.get('postTags') || form.querySelector('#postTags').value,
        author_id: this.currentUser.id,
        created_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('blog_posts')
        .insert([postData]);

      if (error) {
        console.error('Error creating post:', error);
        alert('Lỗi khi tạo bài viết');
        return;
      }

      alert('Đăng bài thành công!');
      this.closeCreateModal();
      this.loadPosts();

    } catch (error) {
      console.error('Error in handleCreatePost:', error);
      alert('Lỗi khi tạo bài viết');
    } finally {
      submitBtn.textContent = originalText;
      submitBtn.disabled = false;
    }
  }

  openPostDetail(postId) {
    // Navigate to post detail page
    const currentPath = window.location.pathname;
    const isInPages = currentPath.includes('/pages/');
    const detailPath = isInPages ? `blog-detail.html?id=${postId}` : `pages/blog-detail.html?id=${postId}`;
    
    window.location.href = detailPath;
  }

  getCategoryName(category) {
    const categories = {
      'technology': 'Công nghệ',
      'gaming': 'Gaming',
      'music': 'Âm nhạc',
      'study': 'Học tập',
      'life': 'Cuộc sống'
    };
    return categories[category] || category;
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }
} 