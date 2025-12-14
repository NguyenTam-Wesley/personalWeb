/**
 * Blog Detail Module
 * Handles the display and interaction of individual blog posts
 */

import components from '../components/components.js';
import { getCurrentUser } from '../supabase/auth.js';
import { supabase } from '../supabase/supabase.js';

class BlogDetail {
  constructor() {
    this.currentPost = null;
    this.currentUser = null;
    this.postId = this.getPostIdFromUrl();

    // dùng singleton components
    this.components = components;

    this.init();
  }

  async init() {
    try {
      // Header / footer đã init sẵn
      // chỉ sync lại trạng thái login
      this.components.updateLoginStatus?.();

      // Init auth
      await this.initializeAuth();

      // Load post
      if (!this.postId) {
        this.showError('Không tìm thấy ID bài viết');
        return;
      }

      await this.loadPost();

    } catch (error) {
      console.error('Error initializing blog detail:', error);
      this.showError('Có lỗi xảy ra khi tải trang');
    }
  }

  /* ================= AUTH ================= */

  async initializeAuth() {
    try {
      this.currentUser = await getCurrentUser();
    } catch (error) {
      console.error('Error initializing auth:', error);
    }
  }

  /* ================= URL ================= */

  getPostIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('id');
  }

  /* ================= DATA ================= */

  async loadPost() {
    try {
      this.showLoading();

      const { data: post, error } = await supabase
        .from('blog_posts')
        .select(`
          *,
          users!blog_posts_author_id_fkey (
            username,
            email
          )
        `)
        .eq('id', this.postId)
        .single();

      if (error) throw error;
      if (!post) {
        this.showError('Không tìm thấy bài viết');
        return;
      }

      this.currentPost = post;
      this.displayPost();
      await this.loadRelatedPosts();

    } catch (error) {
      console.error('Error loading post:', error);
      this.showError('Có lỗi xảy ra khi tải bài viết');
    }
  }

  /* ================= RENDER ================= */

  displayPost() {
    try {
      this.hideLoading();
      document.getElementById('blogDetail').style.display = 'block';

      document.title = `${this.currentPost.title} - Blog - NTAM`;

      document.getElementById('articleCategory').textContent =
        this.currentPost.category;

      document.getElementById('articleDate').textContent =
        this.formatDate(this.currentPost.created_at);

      document.getElementById('articleAuthor').textContent =
        this.currentPost.users?.username || 'Unknown';

      document.getElementById('articleTitle').textContent =
        this.currentPost.title;

      document.getElementById('articleSummary').textContent =
        this.currentPost.summary || '';

      document.getElementById('sidebarAuthorName').textContent =
        this.currentPost.users?.username || 'Unknown';

      this.displayTags();
      this.displayContent();

    } catch (error) {
      console.error('Error displaying post:', error);
      this.showError('Có lỗi xảy ra khi hiển thị bài viết');
    }
  }

  displayTags() {
    const container = document.getElementById('articleTags');
    container.innerHTML = '';

    let tags = [];

    if (this.currentPost.tags) {
      if (Array.isArray(this.currentPost.tags)) {
        tags = this.currentPost.tags;
      } else if (typeof this.currentPost.tags === 'string') {
        try {
          tags = JSON.parse(this.currentPost.tags);
        } catch {
          tags = this.currentPost.tags.split(',').map(t => t.trim());
        }
      }
    }

    tags.filter(Boolean).forEach(tag => {
      const el = document.createElement('span');
      el.className = 'tag';
      el.textContent = tag;
      container.appendChild(el);
    });
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
  }

  /* ================= RELATED ================= */

  async loadRelatedPosts() {
    try {
      const { data, error } = await supabase
        .from('blog_posts')
        .select('id, title, created_at')
        .neq('id', this.postId)
        .eq('category', this.currentPost.category)
        .limit(5);

      if (error) throw error;
      this.displayRelatedPosts(data || []);

    } catch (error) {
      console.error('Error loading related posts:', error);
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
        <h4>${post.title}</h4>
        <div class="post-meta">
          <span>${this.formatDate(post.created_at)}</span>
        </div>
      `;
      container.appendChild(el);
    });
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

// auto init
new BlogDetail();
