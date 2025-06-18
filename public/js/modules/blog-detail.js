/**
 * Blog Detail Module
 * Handles the display and interaction of individual blog posts
 */

import { Components } from '../components/components.js';
import { getCurrentUser } from '../supabase/auth.js';
import { supabase } from '../supabase/supabase.js';

class BlogDetail {
    constructor() {
        this.currentPost = null;
        this.currentUser = null;
        this.postId = this.getPostIdFromUrl();
        this.components = null;
        
        this.init();
    }

    async init() {
        try {
            // Initialize components
            this.components = Components.create();
            this.components.init();
            
            // Initialize authentication
            await this.initializeAuth();
            
            // Load post data
            if (this.postId) {
                await this.loadPost();
            } else {
                this.showError('Không tìm thấy ID bài viết');
            }
            
        } catch (error) {
            console.error('Error initializing blog detail:', error);
            this.showError('Có lỗi xảy ra khi tải trang');
        }
    }

    async initializeAuth() {
        try {
            // Get current user
            this.currentUser = await getCurrentUser();
        } catch (error) {
            console.error('Error initializing auth:', error);
        }
    }

    getPostIdFromUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('id');
    }

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

            if (error) {
                throw error;
            }

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

    displayPost() {
        try {
            // Hide loading, show content
            this.hideLoading();
            document.getElementById('blogDetail').style.display = 'block';

            // Update page title
            document.title = `${this.currentPost.title} - Blog - NTAM`;

            // Update article content
            document.getElementById('articleCategory').textContent = this.currentPost.category;
            document.getElementById('articleDate').textContent = this.formatDate(this.currentPost.created_at);
            document.getElementById('articleAuthor').textContent = this.currentPost.users?.username || 'Unknown';
            document.getElementById('articleTitle').textContent = this.currentPost.title;
            document.getElementById('articleSummary').textContent = this.currentPost.summary || '';
            document.getElementById('sidebarAuthorName').textContent = this.currentPost.users?.username || 'Unknown';

            // Display tags
            this.displayTags();

            // Display content
            this.displayContent();
            
        } catch (error) {
            console.error('Error displaying post:', error);
            this.showError('Có lỗi xảy ra khi hiển thị bài viết');
        }
    }

    displayTags() {
        const tagsContainer = document.getElementById('articleTags');
        tagsContainer.innerHTML = '';

        // Ensure tags is an array, if not convert from string or set empty array
        let tags = [];
        if (this.currentPost.tags) {
            if (typeof this.currentPost.tags === 'string') {
                try {
                    tags = JSON.parse(this.currentPost.tags);
                } catch (e) {
                    tags = this.currentPost.tags.split(',').map(tag => tag.trim());
                }
            } else if (Array.isArray(this.currentPost.tags)) {
                tags = this.currentPost.tags;
            }
        }

        if (tags.length > 0) {
            tags.forEach(tag => {
                if (tag) {  // Only create element if tag is not empty
                    const tagElement = document.createElement('span');
                    tagElement.className = 'tag';
                    tagElement.textContent = tag;
                    tagsContainer.appendChild(tagElement);
                }
            });
        }
    }

    displayContent() {
        const contentContainer = document.getElementById('articleContent');
        
        // Convert markdown-like content to HTML
        let content = this.currentPost.content;
        
        // Convert line breaks to paragraphs
        content = content.replace(/\n\n/g, '</p><p>');
        content = `<p>${content}</p>`;
        
        // Convert **text** to <strong>text</strong>
        content = content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        
        // Convert *text* to <em>text</em>
        content = content.replace(/\*(.*?)\*/g, '<em>$1</em>');
        
        // Convert `code` to <code>code</code>
        content = content.replace(/`(.*?)`/g, '<code>$1</code>');
        
        // Convert ```code block``` to <pre><code>code block</code></pre>
        content = content.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
        
        // Convert [text](url) to <a href="url">text</a>
        content = content.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
        
        // Convert # Heading to <h1>Heading</h1>
        content = content.replace(/^# (.*$)/gm, '<h1>$1</h1>');
        content = content.replace(/^## (.*$)/gm, '<h2>$1</h2>');
        content = content.replace(/^### (.*$)/gm, '<h3>$1</h3>');
        content = content.replace(/^#### (.*$)/gm, '<h4>$1</h4>');
        content = content.replace(/^##### (.*$)/gm, '<h5>$1</h5>');
        content = content.replace(/^###### (.*$)/gm, '<h6>$1</h6>');
        
        // Convert - item to <li>item</li>
        content = content.replace(/^- (.*$)/gm, '<li>$1</li>');
        
        contentContainer.innerHTML = content;
    }

    async loadRelatedPosts() {
        try {
            const { data: posts, error } = await supabase
                .from('blog_posts')
                .select('id, title, created_at')
                .neq('id', this.postId)
                .eq('category', this.currentPost.category)
                .limit(5);

            if (error) {
                throw error;
            }

            this.displayRelatedPosts(posts);
        } catch (error) {
            console.error('Error loading related posts:', error);
        }
    }

    displayRelatedPosts(posts) {
        const container = document.getElementById('relatedPosts');
        container.innerHTML = '';

        if (posts && posts.length > 0) {
            posts.forEach(post => {
                const postElement = document.createElement('a');
                postElement.href = `blog-detail.html?id=${post.id}`;
                postElement.className = 'related-post';
                
                postElement.innerHTML = `
                    <h4>${post.title}</h4>
                    <div class="post-meta">
                        <span>${this.formatDate(post.created_at)}</span>
                    </div>
                `;
                
                container.appendChild(postElement);
            });
        } else {
            container.innerHTML = '<p>Không có bài viết liên quan</p>';
        }
    }

    formatDate(dateString) {
        const options = { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        };
        return new Date(dateString).toLocaleDateString('vi-VN', options);
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

// Initialize Blog Detail
new BlogDetail(); 