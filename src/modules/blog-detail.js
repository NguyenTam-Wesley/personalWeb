/**
 * Blog Detail Module
 * Handles the display and interaction of individual blog posts
 */

class BlogDetail {
    constructor() {
        this.currentPost = null;
        this.currentUser = null;
        this.postId = this.getPostIdFromUrl();
        
        this.init();
    }

    async init() {
        try {
            // Initialize authentication
            await this.initializeAuth();
            
            // Load post data
            if (this.postId) {
                await this.loadPost();
            } else {
                this.showError('Không tìm thấy ID bài viết');
            }
            
            // Setup event listeners
            this.setupEventListeners();
            
        } catch (error) {
            console.error('Error initializing blog detail:', error);
            this.showError('Có lỗi xảy ra khi tải trang');
        }
    }

    async initializeAuth() {
        try {
            // Get current user
            this.currentUser = await getCurrentUser();
            
            // Update UI based on auth state
            this.updateAuthUI();
            
        } catch (error) {
            console.error('Error initializing auth:', error);
        }
    }

    updateAuthUI() {
        const profileLink = document.getElementById('profileLink');
        const loginBtn = document.getElementById('loginBtn');
        const signupBtn = document.getElementById('signupBtn');
        const logoutBtn = document.getElementById('logoutBtn');

        if (this.currentUser) {
            profileLink.style.display = 'block';
            loginBtn.style.display = 'none';
            signupBtn.style.display = 'none';
            logoutBtn.style.display = 'block';
        } else {
            profileLink.style.display = 'none';
            loginBtn.style.display = 'block';
            signupBtn.style.display = 'block';
            logoutBtn.style.display = 'none';
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
        // Hide loading, show content
        this.hideLoading();
        document.getElementById('blogDetail').style.display = 'block';

        // Update page title
        document.title = `${this.currentPost.title} - Blog - NTAM`;

        // Update breadcrumb
        document.querySelector('.breadcrumb .current').textContent = this.currentPost.title;

        // Update article header
        document.getElementById('articleCategory').textContent = this.currentPost.category;
        document.getElementById('articleDate').textContent = this.formatDate(this.currentPost.created_at);
        document.getElementById('articleAuthor').textContent = this.currentPost.users?.username || 'Unknown';
        document.getElementById('articleTitle').textContent = this.currentPost.title;
        document.getElementById('articleSummary').textContent = this.currentPost.summary || '';
        
        // Update sidebar author name
        document.getElementById('sidebarAuthorName').textContent = this.currentPost.users?.username || 'Unknown';

        // Display tags
        this.displayTags();

        // Display content
        this.displayContent();

        // Update action counts
        this.updateActionCounts();
    }

    displayTags() {
        const tagsContainer = document.getElementById('articleTags');
        tagsContainer.innerHTML = '';

        if (this.currentPost.tags && this.currentPost.tags.length > 0) {
            this.currentPost.tags.forEach(tag => {
                const tagElement = document.createElement('span');
                tagElement.className = 'tag';
                tagElement.textContent = tag;
                tagsContainer.appendChild(tagElement);
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
        
        // Wrap consecutive <li> elements in <ul>
        content = content.replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>');
        
        contentContainer.innerHTML = content;
    }

    async loadRelatedPosts() {
        try {
            const { data: relatedPosts, error } = await supabase
                .from('blog_posts')
                .select('id, title, created_at, category')
                .eq('category', this.currentPost.category)
                .neq('id', this.currentPost.id)
                .order('created_at', { ascending: false })
                .limit(3);

            if (error) {
                console.error('Error loading related posts:', error);
                return;
            }

            this.displayRelatedPosts(relatedPosts || []);
            
        } catch (error) {
            console.error('Error loading related posts:', error);
        }
    }

    displayRelatedPosts(posts) {
        const container = document.getElementById('relatedPosts');
        container.innerHTML = '';

        if (posts.length === 0) {
            container.innerHTML = '<p class="no-posts">Chưa có bài viết liên quan</p>';
            return;
        }

        posts.forEach(post => {
            const postElement = document.createElement('div');
            postElement.className = 'related-post';
            postElement.innerHTML = `
                <h4>${post.title}</h4>
                <div class="post-meta">
                    <span>${this.formatDate(post.created_at)}</span>
                    <span>•</span>
                    <span>${post.category}</span>
                </div>
            `;
            
            postElement.addEventListener('click', () => {
                window.location.href = `blog-detail.html?id=${post.id}`;
            });
            
            container.appendChild(postElement);
        });
    }

    updateActionCounts() {
        // For now, we'll use placeholder data
        // In a real app, these would come from the database
        document.getElementById('likeCount').textContent = Math.floor(Math.random() * 50);
        document.getElementById('commentCount').textContent = Math.floor(Math.random() * 20);
    }

    setupEventListeners() {
        // Like button
        document.getElementById('likeBtn').addEventListener('click', () => {
            this.handleLike();
        });

        // Comment button
        document.getElementById('commentBtn').addEventListener('click', () => {
            this.toggleComments();
        });

        // Bookmark button
        document.getElementById('bookmarkBtn').addEventListener('click', () => {
            this.handleBookmark();
        });

        // Submit comment
        document.getElementById('submitComment').addEventListener('click', () => {
            this.submitComment();
        });

        // Cancel comment
        document.getElementById('cancelComment').addEventListener('click', () => {
            this.hideCommentForm();
        });

        // Auth buttons
        document.getElementById('loginBtn').addEventListener('click', () => {
            window.location.href = 'login.html';
        });

        document.getElementById('signupBtn').addEventListener('click', () => {
            window.location.href = 'signup.html';
        });

        document.getElementById('logoutBtn').addEventListener('click', () => {
            this.handleLogout();
        });
    }

    handleLike() {
        if (!this.currentUser) {
            alert('Vui lòng đăng nhập để thích bài viết');
            return;
        }

        const likeBtn = document.getElementById('likeBtn');
        const likeCount = document.getElementById('likeCount');
        
        if (likeBtn.classList.contains('active')) {
            likeBtn.classList.remove('active');
            likeCount.textContent = parseInt(likeCount.textContent) - 1;
        } else {
            likeBtn.classList.add('active');
            likeCount.textContent = parseInt(likeCount.textContent) + 1;
        }
    }

    toggleComments() {
        const commentsSection = document.getElementById('commentsSection');
        const commentForm = document.getElementById('commentForm');
        
        if (commentsSection.style.display === 'none') {
            commentsSection.style.display = 'block';
            if (!this.currentUser) {
                commentForm.style.display = 'none';
            } else {
                commentForm.style.display = 'block';
            }
        } else {
            commentsSection.style.display = 'none';
        }
    }

    hideCommentForm() {
        document.getElementById('commentForm').style.display = 'none';
        document.getElementById('commentText').value = '';
    }

    handleBookmark() {
        if (!this.currentUser) {
            alert('Vui lòng đăng nhập để lưu bài viết');
            return;
        }

        const bookmarkBtn = document.getElementById('bookmarkBtn');
        bookmarkBtn.classList.toggle('active');
        
        if (bookmarkBtn.classList.contains('active')) {
            bookmarkBtn.querySelector('.action-text').textContent = 'Đã lưu';
        } else {
            bookmarkBtn.querySelector('.action-text').textContent = 'Lưu';
        }
    }

    async submitComment() {
        if (!this.currentUser) {
            alert('Vui lòng đăng nhập để bình luận');
            return;
        }

        const commentText = document.getElementById('commentText').value.trim();
        
        if (!commentText) {
            alert('Vui lòng nhập nội dung bình luận');
            return;
        }

        try {
            // In a real app, you would save the comment to the database
            // For now, we'll just add it to the UI
            this.addCommentToUI({
                author: this.currentUser.username,
                content: commentText,
                created_at: new Date().toISOString()
            });

            // Clear form
            document.getElementById('commentText').value = '';
            
            // Update comment count
            const commentCount = document.getElementById('commentCount');
            commentCount.textContent = parseInt(commentCount.textContent) + 1;
            
        } catch (error) {
            console.error('Error submitting comment:', error);
            alert('Có lỗi xảy ra khi gửi bình luận');
        }
    }

    addCommentToUI(comment) {
        const commentsList = document.getElementById('commentsList');
        
        const commentElement = document.createElement('div');
        commentElement.className = 'comment';
        commentElement.innerHTML = `
            <div class="comment-header">
                <span class="comment-author">${comment.author}</span>
                <span class="comment-date">${this.formatDate(comment.created_at)}</span>
            </div>
            <div class="comment-content">${comment.content}</div>
        `;
        
        commentsList.insertBefore(commentElement, commentsList.firstChild);
    }

    async handleLogout() {
        try {
            await logout();
            window.location.reload();
        } catch (error) {
            console.error('Error logging out:', error);
        }
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('vi-VN', {
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
        this.hideLoading();
        document.getElementById('errorState').style.display = 'block';
        document.getElementById('blogDetail').style.display = 'none';
        
        const errorMessage = document.querySelector('#errorState h2');
        if (errorMessage) {
            errorMessage.textContent = message;
        }
    }
}

// Share functions
function shareOnFacebook() {
    const url = encodeURIComponent(window.location.href);
    const title = encodeURIComponent(document.title);
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`, '_blank');
}

function shareOnTwitter() {
    const url = encodeURIComponent(window.location.href);
    const title = encodeURIComponent(document.title);
    window.open(`https://twitter.com/intent/tweet?url=${url}&text=${title}`, '_blank');
}

function shareOnLinkedIn() {
    const url = encodeURIComponent(window.location.href);
    const title = encodeURIComponent(document.title);
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${url}`, '_blank');
}

function copyLink() {
    navigator.clipboard.writeText(window.location.href).then(() => {
        alert('Đã sao chép link vào clipboard!');
    }).catch(() => {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = window.location.href;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        alert('Đã sao chép link vào clipboard!');
    });
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BlogDetail;
} 