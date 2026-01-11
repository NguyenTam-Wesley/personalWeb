// test-blog.js
import components from '../public/js/components/components.js';
import { getCurrentUserWithRetry } from '../public/js/supabase/auth.js';
import { supabase } from '../public/js/supabase/supabase.js';

export class BlogTestManager {
  constructor() {
    this.currentUser = null;
    this.testPosts = [];
    this.isInitialized = false;

    // DOM elements
    this.totalPostsEl = document.getElementById('totalPosts');
    this.currentUserEl = document.getElementById('currentUser');
    this.systemStatusEl = document.getElementById('systemStatus');
    this.testBlogPostsEl = document.getElementById('testBlogPosts');
    this.consoleOutputEl = document.getElementById('consoleOutput');
    this.testModal = document.getElementById('testModal');
    this.testModalContent = document.getElementById('testModalContent');

    // Buttons
    this.loadPostsBtn = document.getElementById('testLoadPostsBtn');
    this.createPostBtn = document.getElementById('testCreatePostBtn');
    this.clearBtn = document.getElementById('testClearBtn');
    this.closeModalBtn = document.getElementById('closeTestModal');

    // dùng singleton components
    this.components = components;

    this.log('🚀 BlogTestManager constructor called');
    this.init();
  }

  async init() {
    try {
      this.log('🔄 Initializing BlogTestManager...');
      this.updateStatus('Initializing...');

      // Test components initialization
      this.log('📦 Testing components availability...');
      if (this.components && typeof this.components.init === 'function') {
        this.log('✅ Components module available');
      } else {
        this.log('❌ Components module not available');
      }

      // Test user authentication
      this.log('👤 Testing user authentication...');
      const userData = await getCurrentUserWithRetry();
      this.currentUser = userData?.profile;

      if (this.currentUser) {
        this.log(`✅ User authenticated: ${this.currentUser.username} (${this.currentUser.role})`);
        this.updateCurrentUser(`${this.currentUser.username} (${this.currentUser.role})`);
      } else {
        this.log('⚠️  No user authenticated');
        this.updateCurrentUser('Not logged in');
      }

      // Test Supabase connection
      this.log('🗄️  Testing Supabase connection...');
      if (supabase) {
        this.log('✅ Supabase client available');
        // Test basic connection
        try {
          const { data, error } = await supabase.from('blog_posts').select('count').limit(1);
          if (error) {
            this.log(`❌ Supabase query error: ${error.message}`);
          } else {
            this.log('✅ Supabase connection successful');
          }
        } catch (err) {
          this.log(`❌ Supabase test failed: ${err.message}`);
        }
      } else {
        this.log('❌ Supabase client not available');
      }

      // Setup event listeners
      this.setupEventListeners();

      this.isInitialized = true;
      this.updateStatus('Ready');
      this.log('✅ BlogTestManager initialized successfully!');

      // Generate some test posts
      this.generateTestPosts();

    } catch (err) {
      this.log(`❌ BlogTestManager init error: ${err.message}`);
      this.updateStatus('Error');
      console.error('BlogTestManager init error:', err);
    }
  }

  setupEventListeners() {
    this.log('🎧 Setting up event listeners...');

    if (this.loadPostsBtn) {
      this.loadPostsBtn.addEventListener('click', () => this.handleLoadPosts());
      this.log('✅ Load Posts button listener added');
    }

    if (this.createPostBtn) {
      this.createPostBtn.addEventListener('click', () => this.handleCreatePost());
      this.log('✅ Create Post button listener added');
    }

    if (this.clearBtn) {
      this.clearBtn.addEventListener('click', () => this.handleClear());
      this.log('✅ Clear button listener added');
    }

    if (this.closeModalBtn) {
      this.closeModalBtn.addEventListener('click', () => this.closeModal());
      this.log('✅ Close modal button listener added');
    }

    // Close modal when clicking outside
    if (this.testModal) {
      this.testModal.addEventListener('click', (e) => {
        if (e.target === this.testModal) {
          this.closeModal();
        }
      });
    }
  }

  async handleLoadPosts() {
    this.log('📥 Load Posts button clicked');
    this.updateStatus('Loading posts...');

    try {
      // Test loading from database
      const { data: posts, error } = await supabase
        .from('blog_posts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        this.log(`❌ Database error: ${error.message}`);
        this.showModal('Database Error', `Failed to load posts: ${error.message}`);
        return;
      }

      this.log(`✅ Loaded ${posts.length} posts from database`);
      this.testPosts = posts;
      this.updateTotalPosts(posts.length);
      this.renderPosts(posts);
      this.updateStatus('Posts loaded');

    } catch (err) {
      this.log(`❌ Load posts error: ${err.message}`);
      this.showModal('Error', `Failed to load posts: ${err.message}`);
      this.updateStatus('Error');
    }
  }

  async handleCreatePost() {
    this.log('✏️ Create Post button clicked');

    if (!this.currentUser) {
      this.showModal('Authentication Required', 'You must be logged in to create posts.');
      return;
    }

    // Create a test post
    const testPost = {
      title: `Test Post ${Date.now()}`,
      content: `This is a test post created at ${new Date().toLocaleString()}.`,
      summary: 'A test post for debugging purposes.',
      category: 'technology',
      tags: ['test', 'debug'],
      author_id: this.currentUser.id,
      status: 'published'
    };

    try {
      this.updateStatus('Creating post...');
      const { data, error } = await supabase
        .from('blog_posts')
        .insert([testPost])
        .select()
        .single();

      if (error) {
        this.log(`❌ Create post error: ${error.message}`);
        this.showModal('Error', `Failed to create post: ${error.message}`);
        return;
      }

      this.log(`✅ Test post created: ${data.title}`);
      this.showModal('Success', `Post "${data.title}" created successfully!`);
      this.testPosts.unshift(data);
      this.updateTotalPosts(this.testPosts.length);
      this.renderPosts(this.testPosts);
      this.updateStatus('Post created');

    } catch (err) {
      this.log(`❌ Create post exception: ${err.message}`);
      this.showModal('Error', `Exception occurred: ${err.message}`);
      this.updateStatus('Error');
    }
  }

  handleClear() {
    this.log('🧹 Clear button clicked');
    this.testPosts = [];
    this.updateTotalPosts(0);
    this.renderPosts([]);
    this.clearConsole();
    this.updateStatus('Cleared');
    this.log('🧹 All data cleared');
  }

  generateTestPosts() {
    this.log('🎭 Generating test posts...');
    this.testPosts = [
      {
        id: 'test-1',
        title: 'Test Post 1',
        summary: 'This is the first test post',
        category: 'technology',
        created_at: new Date().toISOString(),
        author_username: 'Test User'
      },
      {
        id: 'test-2',
        title: 'Test Post 2',
        summary: 'This is the second test post',
        category: 'gaming',
        created_at: new Date(Date.now() - 86400000).toISOString(),
        author_username: 'Test User'
      }
    ];
    this.updateTotalPosts(this.testPosts.length);
    this.renderPosts(this.testPosts);
    this.log(`✅ Generated ${this.testPosts.length} test posts`);
  }

  renderPosts(posts) {
    if (!this.testBlogPostsEl) return;

    if (posts.length === 0) {
      this.testBlogPostsEl.innerHTML = `
        <div class="test-loading">
          <p>No posts to display</p>
        </div>
      `;
      return;
    }

    const postsHtml = posts.map(post => `
      <div class="test-post-card" style="border: 1px solid #ddd; padding: 15px; margin: 10px 0; border-radius: 8px; background: #fafafa;">
        <h3 style="margin: 0 0 8px 0; color: #333;">${post.title}</h3>
        <p style="margin: 0 0 8px 0; color: #666; font-size: 14px;">${post.summary || 'No summary'}</p>
        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: #888;">
          <span>Category: ${post.category || 'Uncategorized'}</span>
          <span>By: ${post.author_username || 'Unknown'} • ${new Date(post.created_at).toLocaleDateString()}</span>
        </div>
      </div>
    `).join('');

    this.testBlogPostsEl.innerHTML = postsHtml;
  }

  showModal(title, content) {
    if (!this.testModal || !this.testModalContent) return;

    this.testModalContent.innerHTML = `
      <h3 style="margin: 0 0 15px 0; color: #333;">${title}</h3>
      <p style="margin: 0; line-height: 1.5;">${content}</p>
    `;
    this.testModal.style.display = 'block';
  }

  closeModal() {
    if (this.testModal) {
      this.testModal.style.display = 'none';
    }
  }

  updateTotalPosts(count) {
    if (this.totalPostsEl) {
      this.totalPostsEl.textContent = count;
    }
  }

  updateCurrentUser(userInfo) {
    if (this.currentUserEl) {
      this.currentUserEl.textContent = userInfo;
    }
  }

  updateStatus(status) {
    if (this.systemStatusEl) {
      this.systemStatusEl.textContent = status;
    }
  }

  log(message) {
    console.log(message);
    if (this.consoleOutputEl) {
      const timestamp = new Date().toLocaleTimeString();
      const logEntry = document.createElement('div');
      logEntry.style.marginBottom = '5px';
      logEntry.style.padding = '2px 0';
      logEntry.innerHTML = `<span style="color: #666; font-size: 12px;">[${timestamp}]</span> ${message}`;
      this.consoleOutputEl.appendChild(logEntry);
      this.consoleOutputEl.scrollTop = this.consoleOutputEl.scrollHeight;
    }
  }

  clearConsole() {
    if (this.consoleOutputEl) {
      this.consoleOutputEl.innerHTML = '';
    }
  }
}