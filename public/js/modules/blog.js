// blog.js
import components from '../components/components.js';
import { getCurrentUserWithRetry } from '../supabase/auth.js';
import { supabase } from '../supabase/supabase.js';

export class BlogManager {
  constructor() {
    this.currentUser = null;
    this.currentPage = 1;
    this.postsPerPage = 6;
    this.totalPosts = 0;

    this.filters = {
      search: '',
      topic: '',
      tags: [],
      sort: 'newest'
    };

    // Cache for topics and tags
    this.topics = [];
    this.allTags = [];

    // dùng singleton components
    this.components = components;

    this.init();
  }

  async init() {
    try {
      console.log('📝 Blog module initializing...');

      // Get current user with retry logic
      const userData = await getCurrentUserWithRetry();
      this.currentUser = userData?.profile;

      console.log(`📝 Blog module: User=${this.currentUser?.username}, Role=${this.currentUser?.role}`);

      // Load topics and tags
      await this.loadTopicsAndTags();

      // Setup UI
      this.setupEventListeners();
      this.checkAdminPermissions();

      // Render filters
      this.renderFilters();

      // Setup form enhancements
      this.setupFormEnhancements();

      // Load posts
      await this.loadPosts();

      console.log('✅ Blog module initialized successfully!');

    } catch (err) {
      console.error('❌ Blog init error:', err);
    }
  }

  /* ================= DATA ================= */

  async loadTopicsAndTags() {
    try {
      // Load topics
      const { data: topicsData, error: topicsError } = await supabase
        .from('topics')
        .select('id, name, description')
        .order('name');

      if (topicsError) throw topicsError;
      this.topics = topicsData || [];

      // Load tags
      const { data: tagsData, error: tagsError } = await supabase
        .from('tags')
        .select('id, name')
        .order('name');

      if (tagsError) throw tagsError;
      this.allTags = tagsData || [];

      console.log('📝 Loaded topics and tags:', { topics: this.topics.length, tags: this.allTags.length });

    } catch (err) {
      console.error('❌ Load topics/tags error:', err);
    }
  }

  /* ================= EVENT LISTENERS ================= */

  setupEventListeners() {

    // Search input
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
      searchInput.addEventListener('input', this.debounce(() => this.handleSearch(), 300));
    }

    // Topic filter
    const topicFilter = document.getElementById('topicFilter');
    if (topicFilter) {
      topicFilter.addEventListener('change', () => this.handleFilterChange());
    }

    // Tag filters
    const tagFilters = document.getElementById('tagFilters');
    if (tagFilters) {
      tagFilters.addEventListener('change', (e) => {
        if (e.target.type === 'checkbox') {
          this.handleTagFilterChange();
        }
      });
    }

    // Sort filter
    const sortFilter = document.getElementById('sortFilter');
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
      prevPage.addEventListener('click', () => this.goToPage(this.currentPage - 1));
    }

    if (nextPage) {
      nextPage.addEventListener('click', () => this.goToPage(this.currentPage + 1));
    }
  }

  /* ================= PERMISSION ================= */

  checkAdminPermissions() {
    const createPostBtn = document.getElementById('createPostBtn');
    if (!createPostBtn) return;

    createPostBtn.style.display = this.currentUser?.role === 'admin' ? 'flex' : 'none';
  }

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
        .from('posts')
        .select(`
          id,
          title,
          content,
          topic_id,
          author_id,
          slug,
          views_count,
          likes_count,
          created_at,
          updated_at,
          status
        `, { count: 'exact' })
        .eq('status', 'published');

      // Apply search filter (using full-text search)
      if (this.filters.search) {
        query = query.or(
          `title.ilike.%${this.filters.search}%,content.ilike.%${this.filters.search}%`
        );
      }

      // Apply topic filter
      if (this.filters.topic) {
        query = query.eq('topic_id', this.filters.topic);
      }

      // Apply tag filters - client-side for now
      let tagFilteredPostIds = null;
      if (this.filters.tags.length > 0) {
        const { data: tagPosts } = await supabase
          .from('post_tags')
          .select('post_id')
          .in('tag_id', this.filters.tags);

        tagFilteredPostIds = tagPosts?.map(tp => tp.post_id) || [];
        if (tagFilteredPostIds.length > 0) {
          query = query.in('id', tagFilteredPostIds);
        } else {
          // No posts match the tag filter
          this.totalPosts = 0;
          await this.renderPosts([]);
          this.renderPagination();
          return;
        }
      }

      // Apply sort
      switch (this.filters.sort) {
        case 'oldest':
          query = query.order('created_at', { ascending: true });
          break;
        case 'popular':
          query = query.order('views_count', { ascending: false });
          break;
        case 'most_liked':
          query = query.order('likes_count', { ascending: false });
          break;
        default:
          query = query.order('created_at', { ascending: false });
      }

      // Pagination
      const from = (this.currentPage - 1) * this.postsPerPage;
      const to = from + this.postsPerPage - 1;

      const { data: postsData, error, count } = await query.range(from, to);

      if (error) throw error;

      // Get additional data separately
      const posts = await this.enrichPostsWithMetadata(postsData || []);

      this.totalPosts = count || 0;
      await this.renderPosts(posts);
      this.renderPagination();

    } catch (err) {
      console.error('❌ Load posts error:', err);
      this.showEmptyState('Lỗi khi tải bài viết');
    }
  }

  async enrichPostsWithMetadata(posts) {
    if (!posts.length) return posts;

    try {
      // Get unique author IDs and topic IDs
      const authorIds = [...new Set(posts.map(p => p.author_id))];
      const topicIds = [...new Set(posts.map(p => p.topic_id))];
      const postIds = posts.map(p => p.id);

      // Query users (authors)
      const { data: users } = await supabase
        .from('users')
        .select('id, username')
        .in('id', authorIds);

      // Query topics
      const { data: topics } = await supabase
        .from('topics')
        .select('id, name, description')
        .in('id', topicIds);

      // Query post_tags
      const { data: postTags } = await supabase
        .from('post_tags')
        .select(`
          post_id,
          tags(id, name)
        `)
        .in('post_id', postIds);

      // Create lookup maps
      const usersMap = new Map(users?.map(u => [u.id, u]) || []);
      const topicsMap = new Map(topics?.map(t => [t.id, t]) || []);
      const tagsMap = new Map();

      // Group tags by post_id
      postTags?.forEach(pt => {
        if (!tagsMap.has(pt.post_id)) {
          tagsMap.set(pt.post_id, []);
        }
        tagsMap.get(pt.post_id).push(pt.tags);
      });

      // Enrich posts with metadata
      return posts.map(post => ({
        ...post,
        users: usersMap.get(post.author_id),
        topics: topicsMap.get(post.topic_id),
        post_tags: tagsMap.get(post.id)?.map(tag => ({ tags: tag })) || []
      }));

    } catch (err) {
      console.error('❌ Enrich posts error:', err);
      return posts; // Return original posts if enrichment fails
    }
  }

  /* ================= RENDER ================= */

  async renderPosts(posts) {
    const container = document.getElementById('blogPosts');
    if (!container) return;

    if (!posts.length) {
      this.showEmptyState('Chưa có bài viết nào');
      return;
    }

    // Create post cards with async like checking
    const postCards = await Promise.all(
      posts.map(post => this.createPostCard(post))
    );

    container.innerHTML = postCards.join('');

    // Add click listeners to post cards
    container.querySelectorAll('.post-card').forEach((card, index) => {
      const postId = posts[index].id;

      // Click on card (but not on buttons)
      card.addEventListener('click', (e) => {
        if (!e.target.closest('.like-btn') && !e.target.closest('.read-more-btn')) {
          this.openPostDetail(postId);
        }
      });

      // Like button
      const likeBtn = card.querySelector('.like-btn');
      if (likeBtn) {
        likeBtn.addEventListener('click', () => this.handleLikeToggle(postId));
      }

      // Read more button
      const readMoreBtn = card.querySelector('.read-more-btn');
      if (readMoreBtn) {
        readMoreBtn.addEventListener('click', () => this.openPostDetail(postId));
      }
    });
  }

  async createPostCard(post) {
    const createdDate = new Date(post.created_at).toLocaleDateString('vi-VN');
    const tags = post.post_tags?.map(pt => pt.tags?.name).filter(Boolean) || [];
    const isLiked = this.currentUser ? await this.checkIfPostLiked(post.id) : false;

    return `
      <div class="post-card" data-post-id="${post.id}">
        <div class="post-header">
          <div class="post-meta">
            <span class="post-topic">${this.escapeHtml(post.topics?.name || 'Uncategorized')}</span>
            <span class="post-date">📅 ${createdDate}</span>
          </div>
          <div class="post-author">👤 ${this.escapeHtml(post.users?.username || 'Unknown')}</div>
        </div>

        <h3>${this.escapeHtml(post.title)}</h3>
        <p class="post-excerpt">${this.escapeHtml(post.content?.substring(0, 150) || '')}...</p>

        <div class="post-stats">
          <div class="stat-item">
            <span class="stat-icon">👁️</span>
            <span class="stat-count">${post.views_count || 0}</span>
          </div>
          <div class="stat-item">
            <button class="like-btn ${isLiked ? 'liked' : ''}" data-post-id="${post.id}">
              <span class="like-icon">${isLiked ? '❤️' : '🤍'}</span>
              <span class="like-count">${post.likes_count || 0}</span>
            </button>
          </div>
          <div class="stat-item">
            <span class="stat-icon">💬</span>
            <span class="stat-count">${post.comments_count || 0}</span>
          </div>
        </div>

        <div class="post-tags">
          ${tags.map(t => `<span class="tag">${this.escapeHtml(t)}</span>`).join('')}
        </div>

        <button class="read-more-btn" data-post-id="${post.id}">Đọc thêm →</button>
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
    this.filters.topic = document.getElementById('topicFilter')?.value || '';
    this.filters.sort = document.getElementById('sortFilter')?.value || 'newest';
    this.currentPage = 1;
    this.loadPosts();
  }

  handleTagFilterChange() {
    const checkedTags = Array.from(document.querySelectorAll('#tagFilters input:checked'))
      .map(cb => cb.value);
    this.filters.tags = checkedTags;
    this.currentPage = 1;
    this.loadPosts();
  }


  /* ================= LIKE FUNCTIONALITY ================= */

  async checkIfPostLiked(postId) {
    try {
      // Get auth user ID for RLS policy
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        return false;
      }

      const authUserId = user.id; // ✅ auth.users.id for RLS

      const { data, error } = await supabase
        .from('post_likes')
        .select('id')
        .eq('post_id', postId)
        .eq('user_id', authUserId) // ✅ auth.users.id for RLS
        .maybeSingle();

      return !error && !!data;
    } catch (error) {
      console.error('Error checking like status:', error);
      return false;
    }
  }

  async handleLikeToggle(postId) {
    if (!this.currentUser) {
      alert('Vui lòng đăng nhập để thích bài viết');
      return;
    }

    try {
      // Get auth user ID for RLS policy
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        alert('Không thể xác định thông tin người dùng. Vui lòng đăng nhập lại.');
        return;
      }

      const authUserId = user.id; // ✅ auth.users.id for RLS

      // Check if already liked
      const { data: existingLike, error: checkError } = await supabase
        .from('post_likes')
        .select('id')
        .eq('post_id', postId)
        .eq('user_id', authUserId) // ✅ auth.users.id for RLS
        .maybeSingle();

      if (checkError) throw checkError;

      let newLikeCount;
      const likeBtn = document.querySelector(`.like-btn[data-post-id="${postId}"]`);
      const likeIcon = likeBtn?.querySelector('.like-icon');
      const likeCount = likeBtn?.querySelector('.like-count');

      if (existingLike) {
        // Unlike - chỉ delete record, trigger DB sẽ update counter
        const { error: deleteError } = await supabase
          .from('post_likes')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', authUserId); // ✅ auth.users.id for RLS

        if (deleteError) throw deleteError;

        newLikeCount = (parseInt(likeCount?.textContent || '0') - 1);
        likeBtn?.classList.remove('liked');
        likeIcon.textContent = '🤍';
      } else {
        // Like - chỉ insert record, trigger DB sẽ update counter
        const { error: insertError } = await supabase
          .from('post_likes')
          .insert({
            post_id: postId,
            user_id: authUserId // ✅ auth.users.id for RLS
          });

        if (insertError) throw insertError;

        newLikeCount = (parseInt(likeCount?.textContent || '0') + 1);
        likeBtn?.classList.add('liked');
        likeIcon.textContent = '❤️';
      }

      // Update UI
      if (likeCount) {
        likeCount.textContent = newLikeCount;
      }

    } catch (err) {
      console.error('❌ Like toggle error:', err);
      alert('Có lỗi xảy ra khi thích bài viết');
    }
  }

  openCreateModal() {
    if (this.currentUser?.role !== 'admin') {
      alert('Bạn không có quyền tạo bài viết');
      return;
    }

    // Reset form first
    this.closeCreateModal();

    // Then open modal
    document.getElementById('createPostModal')?.classList.add('show');
    document.body.classList.add('modal-open');

    // Focus on title input
    setTimeout(() => {
      document.getElementById('postTitle')?.focus();
    }, 100);
  }

  closeCreateModal() {
    document.getElementById('createPostModal')?.classList.remove('show');
    document.body.classList.remove('modal-open');

    const form = document.getElementById('createPostForm');
    if (form) {
      form.reset();

      // Reset textarea height
      const textarea = form.querySelector('#postContent');
      if (textarea) {
        textarea.style.height = 'auto';
      }

      // Reset status to default
      const statusSelect = form.querySelector('#postStatus');
      if (statusSelect) {
        statusSelect.value = 'published';
      }

      // Clear custom validity
      const inputs = form.querySelectorAll('input, textarea, select');
      inputs.forEach(input => input.setCustomValidity(''));
    }
  }

  async handleCreatePost(e) {
    e.preventDefault();

    const formData = new FormData(e.target);
    const title = formData.get('postTitle')?.trim();
    const topicId = formData.get('postTopic');
    const content = formData.get('postContent')?.trim();
    const tagInput = formData.get('postTags')?.trim();
    const status = formData.get('postStatus') || 'published';

    // Validation
    if (!title || title.length < 5) {
      alert('Tiêu đề phải có ít nhất 5 ký tự');
      return;
    }
    if (title.length > 200) {
      alert('Tiêu đề không được vượt quá 200 ký tự');
      return;
    }
    if (!topicId) {
      alert('Vui lòng chọn chủ đề cho bài viết');
      return;
    }
    if (!content || content.length < 50) {
      alert('Nội dung bài viết phải có ít nhất 50 ký tự');
      return;
    }

    try {
      // Get auth user ID for RLS policy
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        alert('Không thể xác định thông tin người dùng. Vui lòng đăng nhập lại.');
        return;
      }

      const authUserId = user.id; // ✅ auth.users.id for RLS

      // Generate unique slug from title
      let slug = this.generateSlug(title);
      let slugExists = true;
      let counter = 0;
      let finalSlug = slug;

      // Check for slug uniqueness
      while (slugExists) {
        const { data: existingPost } = await supabase
          .from('posts')
          .select('id')
          .eq('slug', finalSlug)
          .maybeSingle();

        if (!existingPost) {
          slugExists = false;
        } else {
          counter++;
          finalSlug = `${slug}-${counter}`;
        }
      }

      // Create post
      const postData = {
        title,
        content,
        topic_id: parseInt(topicId),
        slug: finalSlug,
        author_id: authUserId, // ✅ auth.users.id for RLS policy
        status
      };

      const { data: post, error: postError } = await supabase
        .from('posts')
        .insert([postData])
        .select(`
          id,
          title,
          content,
          topic_id,
          author_id,
          slug,
          views_count,
          likes_count,
          created_at,
          updated_at,
          status
        `)
        .maybeSingle();

      if (postError) throw postError;

      // Handle tags
      if (tagInput) {
        const tagNames = tagInput.split(',')
          .map(t => t.trim().toLowerCase())
          .filter(Boolean)
          .filter((tag, index, arr) => arr.indexOf(tag) === index); // Remove duplicates

        for (const tagName of tagNames) {
          if (tagName.length < 2 || tagName.length > 50) {
            console.warn(`Skipping invalid tag: ${tagName}`);
            continue;
          }

          // Find or create tag
          let { data: tag, error: tagError } = await supabase
            .from('tags')
            .select('id')
            .eq('name', tagName)
            .maybeSingle();

          if (tagError) {
            console.error(`Error checking tag ${tagName}:`, tagError);
            continue;
          }

          if (!tag) {
            // Tag doesn't exist, create it
            const { data: newTag, error: createTagError } = await supabase
              .from('tags')
              .insert([{ name: tagName }])
              .select('id')
              .maybeSingle();

            if (createTagError) {
              console.error(`Failed to create tag ${tagName}:`, createTagError);
              continue;
            }
            tag = newTag;
          }

          // Associate tag with post
          const { error: postTagError } = await supabase
            .from('post_tags')
            .insert({
              post_id: post.id,
              tag_id: tag.id
            });

          if (postTagError) {
            console.error(`Failed to associate tag ${tagName} with post:`, postTagError);
          }
        }
      }

      const statusText = status === 'published' ? 'được đăng công khai' : 'được lưu dưới dạng bản nháp';
      alert(`Bài viết "${post.title}" đã ${statusText}!`);

      this.closeCreateModal();
      this.loadPosts(); // Reload posts

    } catch (err) {
      console.error('Create post error:', err);
      alert('Có lỗi xảy ra khi tạo bài viết: ' + err.message);
    }
  }

  generateSlug(title) {
    return title
      .toLowerCase()
      .normalize('NFD') // Normalize Unicode characters
      .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
      .replace(/[^\w\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single
      .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
      .trim();
  }

  /* ================= FORM ENHANCEMENTS ================= */

  setupFormEnhancements() {
    // Character counter for title
    const titleInput = document.getElementById('postTitle');
    const titleLabel = document.querySelector('label[for="postTitle"]');

    if (titleInput && titleLabel) {
      const updateCounter = () => {
        const length = titleInput.value.length;
        const maxLength = titleInput.getAttribute('maxlength') || 200;
        titleLabel.innerHTML = `Tiêu đề bài viết * <span style="font-weight: normal; font-size: 0.8rem;">(${length}/${maxLength})</span>`;
      };

      titleInput.addEventListener('input', updateCounter);
      updateCounter(); // Initial call
    }

    // Auto-resize textarea
    const contentTextarea = document.getElementById('postContent');
    if (contentTextarea) {
      contentTextarea.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = this.scrollHeight + 'px';
      });
    }

    // Tag input validation
    const tagsInput = document.getElementById('postTags');
    if (tagsInput) {
      tagsInput.addEventListener('input', function() {
        const tags = this.value.split(',').map(t => t.trim()).filter(Boolean);
        const invalidTags = tags.filter(tag => tag.length > 50);
        if (invalidTags.length > 0) {
          this.setCustomValidity('Mỗi tag không được vượt quá 50 ký tự');
        } else {
          this.setCustomValidity('');
        }
      });
    }
  }

  openPostDetail(id) {
    window.location.href = `blog-detail.html?id=${id}`;
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }


  /* ================= FILTER RENDERING ================= */

  renderFilters() {
    // Populate topic filter
    const topicFilter = document.getElementById('topicFilter');
    if (topicFilter) {
      topicFilter.innerHTML = '<option value="">Tất cả chủ đề</option>' +
        this.topics.map(topic =>
          `<option value="${topic.id}">${this.escapeHtml(topic.name)}</option>`
        ).join('');
    }

    // Populate create post topic filter
    const postTopicFilter = document.getElementById('postTopic');
    if (postTopicFilter) {
      postTopicFilter.innerHTML = '<option value="">Chọn chủ đề</option>' +
        this.topics.map(topic =>
          `<option value="${topic.id}">${this.escapeHtml(topic.name)}</option>`
        ).join('');
    }

    // Populate tag filters
    const tagFilters = document.getElementById('tagFilters');
    if (tagFilters) {
      tagFilters.innerHTML = this.allTags.map(tag => `
        <label class="tag-filter-item">
          <input type="checkbox" value="${tag.id}" />
          <span>${this.escapeHtml(tag.name)}</span>
        </label>
      `).join('');
    }
  }

  debounce(fn, delay) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), delay);
    };
  }
}