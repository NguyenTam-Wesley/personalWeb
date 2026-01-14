import components from '../components/components.js';
import { getCurrentUserWithRetry } from '../supabase/auth.js';
import { supabase } from '../supabase/supabase.js';
import { themeToggle } from '../components/themeToggle.js';

export class BlogDetailManager {
  constructor() {
    this.currentPost = null;
    this.currentUser = null;
    this.postId = this.getPostIdFromUrl();
    this.postSlug = this.getPostSlugFromUrl();
    this.comments = [];
    this.isLiked = false;

    // dùng singleton components
    this.components = components;

    this.init();
  }

  async init() {
    try {
      // Header / footer đã init sẵn
      // chỉ sync lại trạng thái login
      this.components.updateLoginStatus?.();

      // Init theme toggle
      themeToggle.initialize();

      // Init auth
      await this.initializeAuth();

      // Load post
      if (!this.postId) {
        this.showError('Không tìm thấy ID bài viết');
        return;
      }

      await this.loadPost();

      // Init reading progress
      this.initReadingProgress();

    } catch (error) {
      console.error('Error initializing blog detail:', error);
      this.showError('Có lỗi xảy ra khi tải trang');
    }
  }

  /* ================= AUTH ================= */

  async initializeAuth() {
    try {
      const userData = await getCurrentUserWithRetry();
      this.currentUser = userData?.profile;

      console.log(`📖 Blog detail: User=${this.currentUser?.username}, App Role=${this.currentUser?.role}`);
    } catch (error) {
      console.error('Error initializing auth:', error);
    }
  }

  /* ================= URL ================= */

  getPostIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('id');
  }

  getPostSlugFromUrl() {
    const path = window.location.pathname;
    const slugMatch = path.match(/\/blog\/(.+)/);
    return slugMatch ? slugMatch[1] : null;
  }

  /* ================= DATA ================= */

  async loadPost() {
    try {
      this.showLoading();

      // Load post with explicit field selection
      const { data: post, error } = await supabase
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
        `)
        .eq('status', 'published')
        .or(`id.eq.${this.postId}${this.postSlug ? `,slug.eq.${this.postSlug}` : ''}`)
        .maybeSingle();

      if (error) throw error;
      if (!post) {
        this.showError('Không tìm thấy bài viết');
        return;
      }

      // Enrich post with related data
      this.currentPost = await this.enrichPostWithMetadata(post);
      this.postId = post.id; // Update ID if loaded by slug

      // Track view
      await this.trackView();

      // Check if user liked this post
      if (this.currentUser) {
        await this.checkLikeStatus();
      }

      this.displayPost();
      await this.loadRelatedPosts();
      await this.loadComments();

    } catch (error) {
      console.error('Error loading post:', error);
      this.showError('Có lỗi xảy ra khi tải bài viết');
    }
  }

  async enrichPostWithMetadata(post) {
    try {
      // Get author info
      const { data: author } = await supabase
        .from('users')
        .select('id, username, email')
        .eq('id', post.author_id)
        .maybeSingle();

      // Get topic info
      const { data: topic } = await supabase
        .from('topics')
        .select('id, name, description')
        .eq('id', post.topic_id)
        .maybeSingle();

      // Get tags
      const { data: postTags } = await supabase
        .from('post_tags')
        .select(`
          post_id,
          tags(id, name)
        `)
        .eq('post_id', post.id);

      return {
        ...post,
        users: author,
        topics: topic,
        post_tags: postTags || []
      };

    } catch (err) {
      console.error('❌ Enrich post error:', err);
      return post; // Return original post if enrichment fails
    }
  }

  async trackView() {
    try {
      // Only track view for non-authors and guests
      const userId = this.currentUser?.id;

      // Avoid duplicate views from same user in short time
      const recentViewKey = `view_${this.postId}_${userId || 'guest'}`;
      const lastView = localStorage.getItem(recentViewKey);
      const now = Date.now();

      if (lastView && (now - parseInt(lastView)) < 300000) { // 5 minutes
        return; // Don't track if viewed recently
      }

      localStorage.setItem(recentViewKey, now.toString());

      // Record view in database
      await supabase
        .from('post_views')
        .insert({
          post_id: this.postId,
          user_id: userId || null,
          viewed_at: new Date().toISOString()
        });

      // Update view count
      await supabase
        .from('posts')
        .update({ views_count: supabase.sql`views_count + 1` })
        .eq('id', this.postId);

    } catch (error) {
      console.error('Error tracking view:', error);
      // Don't show error to user for view tracking failures
    }
  }

  async checkLikeStatus() {
    try {
      // Get auth user ID for RLS policy
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        this.isLiked = false;
        return;
      }

      const authUserId = user.id; // ✅ auth.users.id for RLS

      const { data, error } = await supabase
        .from('post_likes')
        .select('id')
        .eq('post_id', this.postId)
        .eq('user_id', authUserId) // ✅ auth.users.id for RLS
        .maybeSingle();

      this.isLiked = !error && !!data;
    } catch (error) {
      this.isLiked = false;
    }
  }

  /* ================= RENDER ================= */

  displayPost() {
    try {
      this.hideLoading();
      document.getElementById('blogDetail').style.display = 'block';

      document.title = `${this.currentPost.title} - Blog - NTAM`;

      document.getElementById('articleCategory').textContent =
        this.currentPost.topics?.name || 'Uncategorized';

      document.getElementById('articleDate').textContent =
        this.formatDate(this.currentPost.created_at);

      document.getElementById('articleAuthor').textContent =
        this.currentPost.users?.username || 'Unknown';

      document.getElementById('articleTitle').textContent =
        this.currentPost.title;

      // Handle summary (optional)
      const summaryEl = document.getElementById('articleSummary');
      if (summaryEl) {
        if (this.currentPost.summary) {
          summaryEl.textContent = this.currentPost.summary;
          summaryEl.style.display = 'block';
        } else {
          summaryEl.style.display = 'none';
        }
      }

      document.getElementById('sidebarAuthorName').textContent =
        this.currentPost.users?.username || 'Unknown';

      this.displayTags();
      this.displayContent();
      this.displayPostStats();

    } catch (error) {
      console.error('Error displaying post:', error);
      this.showError('Có lỗi xảy ra khi hiển thị bài viết');
    }
  }

  displayTags() {
    const container = document.getElementById('articleTags');
    container.innerHTML = '';

    const tags = this.currentPost.post_tags?.map(pt => pt.tags?.name).filter(Boolean) || [];

    tags.forEach(tag => {
      const el = document.createElement('span');
      el.className = 'tag';
      el.textContent = tag;
      container.appendChild(el);
    });
  }

  displayPostStats() {
    // Add like and view stats to the article meta or create a new section
    const articleMeta = document.querySelector('.article-meta');

    // Create stats section
    let statsSection = document.querySelector('.article-stats');
    if (!statsSection) {
      statsSection = document.createElement('div');
      statsSection.className = 'article-stats';
      articleMeta.appendChild(statsSection);
    }

    statsSection.innerHTML = `
      <div class="stat-item">
        <button class="like-btn ${this.isLiked ? 'liked' : ''}" id="postLikeBtn">
          <span class="like-icon">${this.isLiked ? '❤️' : '🤍'}</span>
          <span class="like-count">${this.currentPost.likes_count || 0}</span>
        </button>
      </div>
      <div class="stat-item">
        <span class="stat-icon">👁️</span>
        <span class="stat-count">${this.currentPost.views_count || 0}</span>
      </div>
    `;

    // Add event listener for like button
    const likeBtn = document.getElementById('postLikeBtn');
    if (likeBtn) {
      likeBtn.addEventListener('click', () => this.handleLikeToggle());
    }
  }

  displayContent() {
    const container = document.getElementById('articleContent');
    let content = this.currentPost.content || '';

    content = content.replace(/\n\n/g, '</p><p>');
    content = `<p>${content}</p>`;
    content = content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    content = content.replace(/\*(.*?)\*/g, '<em>$1</em>');
    content = content.replace(/`(.*?)`/g, '<code>$1</code>');
    content = content.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
    content = content.replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2" target="_blank">$1</a>'
    );

    content = content.replace(/^###### (.*$)/gm, '<h6>$1</h6>');
    content = content.replace(/^##### (.*$)/gm, '<h5>$1</h5>');
    content = content.replace(/^#### (.*$)/gm, '<h4>$1</h4>');
    content = content.replace(/^### (.*$)/gm, '<h3>$1</h3>');
    content = content.replace(/^## (.*$)/gm, '<h2>$1</h2>');
    content = content.replace(/^# (.*$)/gm, '<h1>$1</h1>');

    content = content.replace(/^- (.*$)/gm, '<li>$1</li>');

    container.innerHTML = content;

    // Generate TOC if content is long (>1500 chars) and has headings
    const contentLength = this.currentPost.content?.length || 0;
    const headings = container.querySelectorAll('h2, h3');
    if (contentLength > 1500 && headings.length > 0) {
      this.generateTOC(headings);
    }

    // Add IDs to headings for TOC links
    this.addHeadingIds(container);
  }

  addHeadingIds(container) {
    const headings = container.querySelectorAll('h1, h2, h3, h4, h5, h6');
    headings.forEach((heading, index) => {
      if (!heading.id) {
        const text = heading.textContent.trim().toLowerCase()
          .replace(/[^\w\s-]/g, '')
          .replace(/\s+/g, '-');
        heading.id = `heading-${index}-${text}`;
      }
    });
  }

  generateTOC(headings) {
    const contentWrapper = document.querySelector('.content-wrapper');
    if (!contentWrapper) return;

    const tocContainer = document.createElement('div');
    tocContainer.className = 'toc-container';
    tocContainer.innerHTML = '<div class="toc-title">Mục lục</div><ul class="toc-list" id="tocList"></ul>';

    const tocList = tocContainer.querySelector('#tocList');
    let tocLevel = 0;

    headings.forEach((heading, index) => {
      const level = parseInt(heading.tagName.charAt(1));
      const text = heading.textContent.trim();
      
      if (!heading.id) {
        heading.id = `heading-${index}-${text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-')}`;
      }

      const li = document.createElement('li');
      li.className = `toc-level-${level}`;
      
      const a = document.createElement('a');
      a.href = `#${heading.id}`;
      a.textContent = text;
      a.addEventListener('click', (e) => {
        e.preventDefault();
        heading.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });

      li.appendChild(a);
      tocList.appendChild(li);
    });

    // Insert TOC before article content
    const articleContent = document.getElementById('articleContent');
    if (articleContent && articleContent.parentNode) {
      articleContent.parentNode.insertBefore(tocContainer, articleContent);
    }

    // Highlight active TOC item on scroll
    this.initTOCScrollHighlight();
  }

  initTOCScrollHighlight() {
    const tocLinks = document.querySelectorAll('.toc-list a');
    if (tocLinks.length === 0) return;

    const observerOptions = {
      root: null,
      rootMargin: '-20% 0px -70% 0px',
      threshold: 0
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          tocLinks.forEach(link => link.classList.remove('active'));
          const activeLink = document.querySelector(`.toc-list a[href="#${entry.target.id}"]`);
          if (activeLink) {
            activeLink.classList.add('active');
          }
        }
      });
    }, observerOptions);

    const headings = document.querySelectorAll('#articleContent h2, #articleContent h3');
    headings.forEach(heading => observer.observe(heading));
  }

  initReadingProgress() {
    const progressBar = document.getElementById('readingProgress');
    if (!progressBar) return;

    const updateProgress = () => {
      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const scrollPercent = (scrollTop / (documentHeight - windowHeight)) * 100;
      progressBar.style.width = Math.min(100, Math.max(0, scrollPercent)) + '%';
    };

    window.addEventListener('scroll', updateProgress, { passive: true });
    updateProgress();
  }

  /* ================= RELATED ================= */

  async loadRelatedPosts() {
    try {
      const { data: posts, error } = await supabase
        .from('posts')
        .select('id, title, author_id, created_at, slug')
        .neq('id', this.postId)
        .eq('topic_id', this.currentPost.topic_id)
        .eq('status', 'published')
        .limit(5);

      if (error) throw error;

      // Enrich with author info
      const enrichedPosts = await this.enrichRelatedPostsWithAuthors(posts || []);
      this.displayRelatedPosts(enrichedPosts);

    } catch (error) {
      console.error('Error loading related posts:', error);
    }
  }

  async enrichRelatedPostsWithAuthors(posts) {
    if (!posts.length) return posts;

    try {
      const authorIds = [...new Set(posts.map(p => p.author_id))];

      const { data: authors } = await supabase
        .from('users')
        .select('id, username')
        .in('id', authorIds);

      const authorsMap = new Map(authors?.map(a => [a.id, a]) || []);

      return posts.map(post => ({
        ...post,
        users: authorsMap.get(post.author_id)
      }));

    } catch (err) {
      console.error('❌ Enrich related posts error:', err);
      return posts;
    }
  }

  displayRelatedPosts(posts) {
    const container = document.getElementById('relatedPosts');
    container.innerHTML = '';

    if (!posts.length) {
      container.innerHTML = '<p>Không có bài viết liên quan</p>';
      return;
    }

    posts.forEach(post => {
      const el = document.createElement('a');
      el.href = `blog-detail.html?id=${post.id}`;
      el.className = 'related-post';
      el.innerHTML = `
        <h4>${this.escapeHtml(post.title)}</h4>
        <div class="post-meta">
          <span>${this.formatDate(post.created_at)}</span>
        </div>
      `;
      container.appendChild(el);
    });
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }


  /* ================= COMMENTS ================= */

  async loadComments() {
    try {
      // Load main comments (no parent)
      const { data: mainComments, error } = await supabase
        .from('post_comments')
        .select(`
          id,
          post_id,
          user_id,
          parent_id,
          content,
          created_at,
          updated_at
        `)
        .eq('post_id', this.postId)
        .is('parent_id', null)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Load all comments for this post to get replies
      const { data: allComments, error: allError } = await supabase
        .from('post_comments')
        .select(`
          id,
          post_id,
          user_id,
          parent_id,
          content,
          created_at,
          updated_at
        `)
        .eq('post_id', this.postId)
        .order('created_at', { ascending: true });

      if (allError) throw allError;

      // Enrich comments with user data
      this.comments = await this.enrichCommentsWithUsers(mainComments || [], allComments || []);
      this.displayComments();

    } catch (error) {
      console.error('Error loading comments:', error);
    }
  }

  async enrichCommentsWithUsers(mainComments, allComments) {
    if (!allComments.length) return [];

    try {
      const userIds = [...new Set(allComments.map(c => c.user_id))];

      const { data: users } = await supabase
        .from('users')
        .select('id, username')
        .in('id', userIds);

      const usersMap = new Map(users?.map(u => [u.id, u]) || []);

      // Create replies map
      const repliesMap = new Map();
      allComments.forEach(comment => {
        if (comment.parent_id) {
          if (!repliesMap.has(comment.parent_id)) {
            repliesMap.set(comment.parent_id, []);
          }
          repliesMap.get(comment.parent_id).push({
            ...comment,
            users: usersMap.get(comment.user_id)
          });
        }
      });

      // Enrich main comments with user data and replies
      return mainComments.map(comment => ({
        ...comment,
        users: usersMap.get(comment.user_id),
        replies: repliesMap.get(comment.id) || []
      }));

    } catch (err) {
      console.error('❌ Enrich comments error:', err);
      return mainComments; // Return original comments if enrichment fails
    }
  }

  displayComments() {
    let commentsSection = document.querySelector('.comments-section');
    if (!commentsSection) {
      commentsSection = document.createElement('section');
      commentsSection.className = 'comments-section';
      document.querySelector('.blog-detail-container').appendChild(commentsSection);
    }

    commentsSection.innerHTML = `
      <h2>💬 Bình luận (${this.comments.length})</h2>

      ${this.currentUser ? this.createCommentForm() : this.createLoginPrompt()}

      <div class="comments-list" id="commentsList">
        ${this.comments.map(comment => this.createCommentHTML(comment)).join('')}
      </div>
    `;

    // Add event listeners for comment interactions
    this.setupCommentEventListeners();
  }

  createCommentForm(parentId = null) {
    const formId = parentId ? `reply-form-${parentId}` : 'main-comment-form';
    const placeholder = parentId ? 'Viết phản hồi...' : 'Viết bình luận của bạn...';

    return `
      <form class="comment-form" id="${formId}" data-parent-id="${parentId || ''}">
        <div class="comment-form-group">
          <textarea
            name="commentContent"
            placeholder="${placeholder}"
            required
            rows="3"
          ></textarea>
        </div>
        <div class="comment-form-actions">
          ${parentId ? '<button type="button" class="btn-cancel-reply">Hủy</button>' : ''}
          <button type="submit" class="btn-comment">Đăng bình luận</button>
        </div>
      </form>
    `;
  }

  createLoginPrompt() {
    return `
      <div class="login-prompt">
        <p>Đăng nhập để tham gia bình luận</p>
        <button class="btn-login" onclick="window.location.href='../pages/login.html'">Đăng nhập</button>
      </div>
    `;
  }

  createCommentHTML(comment, isReply = false) {
    const repliesHTML = comment.replies?.map(reply => this.createCommentHTML(reply, true)).join('') || '';
    const isOwner = this.currentUser && this.currentUser.id === comment.user_id;

    return `
      <div class="comment ${isReply ? 'reply' : ''}" data-comment-id="${comment.id}">
        <div class="comment-header">
          <div class="comment-author">
            <span class="author-avatar">👤</span>
            <span class="author-name">${this.escapeHtml(comment.users?.username || 'Unknown')}</span>
          </div>
          <div class="comment-meta">
            <span class="comment-date">${this.formatDate(comment.created_at)}</span>
            ${isOwner ? `
              <div class="comment-actions-meta">
                <button class="btn-edit-comment" data-comment-id="${comment.id}" title="Chỉnh sửa">✏️</button>
                <button class="btn-delete-comment" data-comment-id="${comment.id}" title="Xóa">🗑️</button>
              </div>
            ` : ''}
          </div>
        </div>
        <div class="comment-content" data-comment-id="${comment.id}">
          ${this.formatCommentContent(comment.content)}
        </div>
        ${!isReply ? `
          <div class="comment-actions">
            ${this.currentUser ? `<button class="btn-reply" data-comment-id="${comment.id}">Phản hồi</button>` : ''}
          </div>
        ` : ''}
        ${repliesHTML ? `<div class="replies">${repliesHTML}</div>` : ''}
      </div>
    `;
  }

  setupCommentEventListeners() {
    // Main comment form
    const mainForm = document.getElementById('main-comment-form');
    if (mainForm) {
      mainForm.addEventListener('submit', (e) => this.handleCommentSubmit(e));
    }

    // Reply buttons
    document.querySelectorAll('.btn-reply').forEach(btn => {
      btn.addEventListener('click', (e) => this.showReplyForm(e));
    });

    // Cancel reply buttons
    document.querySelectorAll('.btn-cancel-reply').forEach(btn => {
      btn.addEventListener('click', (e) => this.hideReplyForm(e));
    });

    // Edit comment buttons
    document.querySelectorAll('.btn-edit-comment').forEach(btn => {
      btn.addEventListener('click', (e) => this.showEditCommentForm(e));
    });

    // Delete comment buttons
    document.querySelectorAll('.btn-delete-comment').forEach(btn => {
      btn.addEventListener('click', (e) => this.handleDeleteComment(e));
    });
  }

  async handleCommentSubmit(e) {
    e.preventDefault();

    if (!this.currentUser) {
      alert('Vui lòng đăng nhập để bình luận');
      return;
    }

    const form = e.target;
    const formData = new FormData(form);
    const content = formData.get('commentContent')?.trim();
    const parentId = form.dataset.parentId || null;

    if (!content) {
      alert('Vui lòng nhập nội dung bình luận');
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

      // Insert comment - trigger DB sẽ update comments_count
      const { data, error } = await supabase
        .from('post_comments')
        .insert({
          post_id: this.postId,
          user_id: authUserId, // ✅ auth.users.id for RLS
          content,
          parent_id: parentId
        })
        .select(`
          id,
          post_id,
          user_id,
          parent_id,
          content,
          created_at,
          updated_at
        `)
        .maybeSingle();

      if (error) throw error;

      // Reload comments
      await this.loadComments();

      // Clear form
      form.reset();

    } catch (error) {
      console.error('Error submitting comment:', error);
      alert('Có lỗi xảy ra khi đăng bình luận');
    }
  }

  showReplyForm(e) {
    const commentId = e.target.dataset.commentId;
    const commentEl = e.target.closest('.comment');

    // Remove any existing reply forms
    document.querySelectorAll('.reply-form-container, .edit-form-container').forEach(form => form.remove());

    // Add reply form
    const replyContainer = document.createElement('div');
    replyContainer.className = 'reply-form-container';
    replyContainer.innerHTML = this.createCommentForm(commentId);

    commentEl.appendChild(replyContainer);

    // Setup event listeners for the new form
    const replyForm = replyContainer.querySelector('.comment-form');
    replyForm.addEventListener('submit', (e) => this.handleCommentSubmit(e));

    const cancelBtn = replyContainer.querySelector('.btn-cancel-reply');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => replyContainer.remove());
    }
  }

  showEditCommentForm(e) {
    const commentId = e.target.dataset.commentId;
    const commentEl = e.target.closest('.comment');
    const commentContent = commentEl.querySelector('.comment-content');

    // Remove any existing forms
    document.querySelectorAll('.reply-form-container, .edit-form-container').forEach(form => form.remove());

    // Get current content
    const currentContent = commentContent.textContent.trim();

    // Create edit form
    const editContainer = document.createElement('div');
    editContainer.className = 'edit-form-container';
    editContainer.innerHTML = `
      <form class="edit-comment-form" data-comment-id="${commentId}">
        <div class="edit-form-group">
          <textarea name="editContent" required rows="3">${this.escapeHtml(currentContent)}</textarea>
        </div>
        <div class="edit-form-actions">
          <button type="button" class="btn-cancel-edit">Hủy</button>
          <button type="submit" class="btn-save-edit">Lưu</button>
        </div>
      </form>
    `;

    // Replace content with edit form
    commentContent.innerHTML = '';
    commentContent.appendChild(editContainer);

    // Setup event listeners
    const editForm = editContainer.querySelector('.edit-comment-form');
    editForm.addEventListener('submit', (e) => this.handleEditCommentSubmit(e));

    const cancelBtn = editContainer.querySelector('.btn-cancel-edit');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => this.cancelEditComment(commentId));
    }

    // Focus on textarea
    const textarea = editForm.querySelector('textarea');
    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
  }

  hideReplyForm(e) {
    const replyContainer = e.target.closest('.reply-form-container');
    if (replyContainer) {
      replyContainer.remove();
    }
  }

  async handleDeleteComment(e) {
    const commentId = e.target.dataset.commentId;

    if (!confirm('Bạn có chắc muốn xóa bình luận này?')) {
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

      // Delete comment - CASCADE sẽ tự động xóa replies, trigger update count
      const { error } = await supabase
        .from('post_comments')
        .delete()
        .eq('id', commentId)
        .eq('user_id', authUserId); // ✅ Ensure RLS allows deletion

      if (error) throw error;

      await this.loadComments();

    } catch (error) {
      console.error('Error deleting comment:', error);
      alert('Có lỗi xảy ra khi xóa bình luận');
    }
  }

  async handleEditCommentSubmit(e) {
    e.preventDefault();

    const form = e.target;
    const commentId = form.dataset.commentId;
    const formData = new FormData(form);
    const newContent = formData.get('editContent')?.trim();

    if (!newContent) {
      alert('Nội dung bình luận không được để trống');
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

      // Update comment content - không đụng đến count
      const { error } = await supabase
        .from('post_comments')
        .update({
          content: newContent,
          updated_at: new Date().toISOString()
        })
        .eq('id', commentId)
        .eq('user_id', authUserId); // ✅ Ensure RLS allows update

      if (error) throw error;

      await this.loadComments();

    } catch (error) {
      console.error('Error updating comment:', error);
      alert('Có lỗi xảy ra khi cập nhật bình luận');
    }
  }

  cancelEditComment(commentId) {
    // Reload comments to restore original content
    this.loadComments();
  }

  async handleUpdateComment(commentId, newContent) {
    // Legacy method - giữ lại cho compatibility
    return this.handleEditCommentSubmit({
      preventDefault: () => {},
      target: { dataset: { commentId }, querySelector: () => ({ value: newContent }) }
    });
  }

  formatCommentContent(content) {
    // Basic formatting for comments
    return content
      .replace(/\n/g, '<br>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>');
  }

  /* ================= LIKE FUNCTIONALITY ================= */

  async handleLikeToggle() {
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

      const likeBtn = document.getElementById('postLikeBtn');
      const likeIcon = likeBtn?.querySelector('.like-icon');
      const likeCount = likeBtn?.querySelector('.like-count');

      if (this.isLiked) {
        // Unlike - chỉ delete record, trigger DB sẽ update counter
        const { error } = await supabase
          .from('post_likes')
          .delete()
          .eq('post_id', this.postId)
          .eq('user_id', authUserId); // ✅ auth.users.id for RLS

        if (error) throw error;

        this.isLiked = false;
        likeBtn?.classList.remove('liked');
        likeIcon.textContent = '🤍';
        likeCount.textContent = parseInt(likeCount.textContent) - 1;
      } else {
        // Like - chỉ insert record, trigger DB sẽ update counter
        const { error } = await supabase
          .from('post_likes')
          .insert({
            post_id: this.postId,
            user_id: authUserId // ✅ auth.users.id for RLS
          });

        if (error) throw error;

        this.isLiked = true;
        likeBtn?.classList.add('liked');
        likeIcon.textContent = '❤️';
        likeCount.textContent = parseInt(likeCount.textContent) + 1;
      }

    } catch (error) {
      console.error('Error toggling like:', error);
      alert('Có lỗi xảy ra khi thích bài viết');
    }
  }

  /* ================= UI ================= */

  formatDate(date) {
    return new Date(date).toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }


  showLoading() {
    document.getElementById('loadingState').style.display = 'block';
    document.getElementById('errorState').style.display = 'none';
    document.getElementById('blogDetail').style.display = 'none';
  }

  hideLoading() {
    document.getElementById('loadingState').style.display = 'none';
  }

  showError(message) {
    document.getElementById('loadingState').style.display = 'none';
    document.getElementById('blogDetail').style.display = 'none';

    const errorState = document.getElementById('errorState');
    errorState.style.display = 'block';
    errorState.querySelector('p').textContent = message;
  }
}

// Have to be exported for entry point
