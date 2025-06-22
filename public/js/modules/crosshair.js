import { supabase } from '../supabase/supabase.js';

export class CrosshairManager {
    constructor() {
        this.crosshairs = [];
        this.filters = {
            category: '',
            difficulty: '',
            search: ''
        };
        this.currentPage = 1;
        this.itemsPerPage = 12;
        this.init();
    }

    async init() {
        await this.loadCrosshairs();
        this.setupFilters();
        this.setupEventListeners();
    }

    async loadCrosshairs() {
        try {
            // Show loading
            this.showLoading();

            // Build query
            let query = supabase
                .from('crosshairs')
                .select('*', { count: 'exact' })
                .eq('is_active', true);

            // Apply filters
            if (this.filters.search) {
                query = query.or(`name.ilike.%${this.filters.search}%,player_name.ilike.%${this.filters.search}%,team_name.ilike.%${this.filters.search}%`);
            }

            if (this.filters.category) {
                query = query.eq('category', this.filters.category);
            }

            if (this.filters.difficulty) {
                query = query.eq('difficulty', this.filters.difficulty);
            }

            // Apply sorting (most popular first)
            query = query.order('view_count', { ascending: false });

            // Apply pagination
            const from = (this.currentPage - 1) * this.itemsPerPage;
            const to = from + this.itemsPerPage - 1;
            query = query.range(from, to);

            const { data: crosshairs, error, count } = await query;

            if (error) {
                console.error('Error loading crosshairs:', error);
                this.showError('Lỗi khi tải danh sách crosshair');
                return;
            }

            this.crosshairs = crosshairs || [];
            this.totalItems = count || 0;
            this.renderCrosshairs();
            this.renderPagination();

        } catch (error) {
            console.error('Error in loadCrosshairs:', error);
            this.showError('Lỗi khi tải danh sách crosshair');
        }
    }

    renderCrosshairs() {
        const crosshairGrid = document.querySelector('.crosshair-grid');
        if (!crosshairGrid) return;

        if (!this.crosshairs || this.crosshairs.length === 0) {
            crosshairGrid.innerHTML = `
                <div class="no-crosshairs">
                    <p>Không tìm thấy crosshair nào</p>
                </div>
            `;
            return;
        }

        const crosshairsHTML = this.crosshairs.map(crosshair => this.createCrosshairCard(crosshair)).join('');
        crosshairGrid.innerHTML = crosshairsHTML;

        // Add event listeners for copy buttons
        crosshairGrid.querySelectorAll('.copy-button').forEach((button, index) => {
            button.addEventListener('click', () => this.copyCode(button, this.crosshairs[index].id));
        });
    }

    createCrosshairCard(crosshair) {
        const difficultyColor = this.getDifficultyColor(crosshair.difficulty);
        const categoryIcon = this.getCategoryIcon(crosshair.category);
        
        return `
            <div class="crosshair-card" data-crosshair-id="${crosshair.id}">
                <div class="crosshair-info">
                    <div class="crosshair-header">
                        <h3>${this.escapeHtml(crosshair.name)}</h3>
                        <div class="crosshair-badges">
                            <span class="badge category-badge">${categoryIcon} ${crosshair.category}</span>
                            <span class="badge difficulty-badge" style="background-color: ${difficultyColor}">${crosshair.difficulty}</span>
                        </div>
                    </div>
                    <p class="crosshair-description">${this.escapeHtml(crosshair.description)}</p>
                    <div class="crosshair-meta">
                        <span class="player-info">👤 ${this.escapeHtml(crosshair.player_name || 'Unknown')}</span>
                        ${crosshair.team_name ? `<span class="team-info">🏆 ${this.escapeHtml(crosshair.team_name)}</span>` : ''}
                    </div>
                </div>
                <div class="crosshair-code">
                    <code>${this.escapeHtml(crosshair.code)}</code>
                    <button class="copy-button">Copy</button>
                </div>
            </div>
        `;
    }

    async copyCode(button, crosshairId) {
        try {
            const code = button.parentElement.querySelector('code').textContent;
            await navigator.clipboard.writeText(code);
            
            // Hiệu ứng copy thành công
            const originalText = button.textContent;
            button.textContent = 'Copied!';
            button.style.backgroundColor = '#28a745';
            
            // Hiển thị thông báo
            this.showNotification('Crosshair code đã được copy!', 'success');
            
            // Reset button sau 2 giây
            setTimeout(() => {
                button.textContent = originalText;
                button.style.backgroundColor = '';
            }, 2000);
        } catch (error) {
            console.error('Lỗi khi copy code:', error);
            this.showNotification('Không thể copy code. Vui lòng thử lại!', 'error');
        }
    }

    setupFilters() {
        // Add filter UI if not exists
        const crosshairContainer = document.querySelector('.crosshair-container');
        if (!crosshairContainer) return;

        const existingFilters = crosshairContainer.querySelector('.crosshair-filters');
        if (existingFilters) return;

        const filtersHTML = `
            <div class="crosshair-filters">
                <div class="search-box">
                    <input type="text" id="crosshairSearch" placeholder="Tìm kiếm crosshair..." />
                    <span class="search-icon">🔍</span>
                </div>
                <div class="filter-options">
                    <select id="categoryFilter">
                        <option value="">Tất cả danh mục</option>
                        <option value="pro">Pro Players</option>
                        <option value="streamer">Streamers</option>
                        <option value="custom">Custom</option>
                    </select>
                    <select id="difficultyFilter">
                        <option value="">Tất cả độ khó</option>
                        <option value="easy">Dễ</option>
                        <option value="medium">Trung bình</option>
                        <option value="hard">Khó</option>
                    </select>
                </div>
            </div>
        `;

        const crosshairHeader = crosshairContainer.querySelector('.crosshair-header');
        if (crosshairHeader) {
            crosshairHeader.insertAdjacentHTML('afterend', filtersHTML);
        }
    }

    setupEventListeners() {
        // Search functionality
        const searchInput = document.getElementById('crosshairSearch');
        if (searchInput) {
            searchInput.addEventListener('input', this.debounce(() => this.handleSearch(), 300));
        }

        // Filter functionality
        const categoryFilter = document.getElementById('categoryFilter');
        const difficultyFilter = document.getElementById('difficultyFilter');

        if (categoryFilter) {
            categoryFilter.addEventListener('change', () => this.handleFilterChange());
        }

        if (difficultyFilter) {
            difficultyFilter.addEventListener('change', () => this.handleFilterChange());
        }
    }

    handleSearch() {
        const searchInput = document.getElementById('crosshairSearch');
        if (searchInput) {
            this.filters.search = searchInput.value.trim();
            this.currentPage = 1;
            this.loadCrosshairs();
        }
    }

    handleFilterChange() {
        const categoryFilter = document.getElementById('categoryFilter');
        const difficultyFilter = document.getElementById('difficultyFilter');

        if (categoryFilter) {
            this.filters.category = categoryFilter.value;
        }

        if (difficultyFilter) {
            this.filters.difficulty = difficultyFilter.value;
        }

        this.currentPage = 1;
        this.loadCrosshairs();
    }

    renderPagination() {
        const paginationContainer = document.querySelector('.crosshair-pagination');
        if (!paginationContainer) return;

        const totalPages = Math.ceil(this.totalItems / this.itemsPerPage);
        
        if (totalPages <= 1) {
            paginationContainer.style.display = 'none';
            return;
        }

        paginationContainer.style.display = 'flex';
        
        const prevBtn = paginationContainer.querySelector('#prevPage');
        const nextBtn = paginationContainer.querySelector('#nextPage');
        const pageNumbers = paginationContainer.querySelector('#pageNumbers');

        if (prevBtn) {
            prevBtn.disabled = this.currentPage <= 1;
            prevBtn.onclick = () => this.goToPage(this.currentPage - 1);
        }

        if (nextBtn) {
            nextBtn.disabled = this.currentPage >= totalPages;
            nextBtn.onclick = () => this.goToPage(this.currentPage + 1);
        }

        if (pageNumbers) {
            pageNumbers.innerHTML = this.generatePageNumbers(totalPages);
        }
    }

    generatePageNumbers(totalPages) {
        const pages = [];
        const maxVisible = 5;
        
        let start = Math.max(1, this.currentPage - Math.floor(maxVisible / 2));
        let end = Math.min(totalPages, start + maxVisible - 1);
        
        if (end - start + 1 < maxVisible) {
            start = Math.max(1, end - maxVisible + 1);
        }

        for (let i = start; i <= end; i++) {
            pages.push(`
                <button class="page-number ${i === this.currentPage ? 'active' : ''}" 
                        onclick="window.crosshairManager.goToPage(${i})">${i}</button>
            `);
        }

        return pages.join('');
    }

    goToPage(page) {
        this.currentPage = page;
        this.loadCrosshairs();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    showLoading() {
        const crosshairGrid = document.querySelector('.crosshair-grid');
        if (crosshairGrid) {
            crosshairGrid.innerHTML = `
                <div class="loading-spinner">
                    <div class="spinner"></div>
                    <p>Đang tải crosshairs...</p>
                </div>
            `;
        }
    }

    showError(message) {
        const crosshairGrid = document.querySelector('.crosshair-grid');
        if (crosshairGrid) {
            crosshairGrid.innerHTML = `
                <div class="error-message">
                    <p>❌ ${message}</p>
                    <button onclick="location.reload()">Thử lại</button>
                </div>
            `;
        }
    }

    showNotification(message, type = 'success') {
        // Tạo element thông báo
        const notification = document.createElement('div');
        notification.className = `crosshair-notification ${type}`;
        notification.textContent = message;
        
        // Thêm vào body
        document.body.appendChild(notification);
        
        // Hiệu ứng fade in
        setTimeout(() => notification.classList.add('show'), 100);
        
        // Tự động ẩn sau 3 giây
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    getDifficultyColor(difficulty) {
        switch (difficulty) {
            case 'easy': return '#28a745';
            case 'medium': return '#ffc107';
            case 'hard': return '#dc3545';
            default: return '#6c757d';
        }
    }

    getCategoryIcon(category) {
        switch (category) {
            case 'pro': return '🏆';
            case 'streamer': return '📺';
            case 'custom': return '⚙️';
            default: return '🎯';
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    debounce(func, wait) {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }

    static init() {
        // Thêm style cho notification và loading
        const style = document.createElement('style');
        style.textContent = `
            .crosshair-notification {
                position: fixed;
                bottom: 20px;
                right: 20px;
                padding: 12px 24px;
                border-radius: 4px;
                color: white;
                font-weight: 500;
                opacity: 0;
                transform: translateY(20px);
                transition: all 0.3s ease;
                z-index: 1000;
            }
            .crosshair-notification.show {
                opacity: 1;
                transform: translateY(0);
            }
            .crosshair-notification.success {
                background-color: #28a745;
            }
            .crosshair-notification.error {
                background-color: #dc3545;
            }
            
            .crosshair-filters {
                margin: 20px 0;
                padding: 20px;
                background: var(--card-bg);
                border-radius: var(--border-radius-md);
                border: 1px solid var(--border-dark);
            }
            
            .crosshair-filters .search-box {
                position: relative;
                margin-bottom: 15px;
            }
            
            .crosshair-filters .search-box input {
                width: 100%;
                padding: 10px 40px 10px 15px;
                border: 1px solid var(--border-dark);
                border-radius: var(--border-radius-sm);
                background: var(--primary-bg);
                color: var(--text-dark);
            }
            
            .crosshair-filters .search-icon {
                position: absolute;
                right: 15px;
                top: 50%;
                transform: translateY(-50%);
                color: var(--text-light);
            }
            
            .crosshair-filters .filter-options {
                display: flex;
                gap: 15px;
            }
            
            .crosshair-filters select {
                padding: 8px 12px;
                border: 1px solid var(--border-dark);
                border-radius: var(--border-radius-sm);
                background: var(--primary-bg);
                color: var(--text-dark);
            }
            
            .crosshair-badges {
                display: flex;
                gap: 8px;
                margin-top: 8px;
            }
            
            .badge {
                padding: 4px 8px;
                border-radius: 12px;
                font-size: 0.75rem;
                font-weight: 500;
                color: white;
            }
            
            .category-badge {
                background-color: var(--accent-primary);
            }
            
            .difficulty-badge {
                color: white;
            }
            
            .crosshair-meta {
                display: flex;
                gap: 15px;
                margin-top: 10px;
                font-size: 0.875rem;
                color: var(--text-light);
            }
            
            .loading-spinner {
                text-align: center;
                padding: 40px;
            }
            
            .spinner {
                border: 4px solid var(--border-light);
                border-top: 4px solid var(--accent-primary);
                border-radius: 50%;
                width: 40px;
                height: 40px;
                animation: spin 1s linear infinite;
                margin: 0 auto 20px;
            }
            
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            
            .error-message {
                text-align: center;
                padding: 40px;
                color: var(--text-light);
            }
            
            .error-message button {
                margin-top: 15px;
                padding: 8px 16px;
                background: var(--accent-primary);
                color: white;
                border: none;
                border-radius: var(--border-radius-sm);
                cursor: pointer;
            }
            
            .no-crosshairs {
                text-align: center;
                padding: 40px;
                color: var(--text-light);
            }
            
            .crosshair-pagination {
                display: flex;
                justify-content: center;
                align-items: center;
                gap: 10px;
                margin-top: 30px;
            }
            
            .pagination-btn {
                padding: 8px 16px;
                border: 1px solid var(--border-dark);
                background: var(--card-bg);
                color: var(--text-dark);
                border-radius: var(--border-radius-sm);
                cursor: pointer;
                transition: all var(--transition-normal);
            }
            
            .pagination-btn:hover:not(:disabled) {
                background: var(--accent-primary);
                color: white;
            }
            
            .pagination-btn:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }
            
            .page-numbers {
                display: flex;
                gap: 5px;
            }
            
            .page-number {
                padding: 8px 12px;
                border: 1px solid var(--border-dark);
                background: var(--card-bg);
                color: var(--text-dark);
                border-radius: var(--border-radius-sm);
                cursor: pointer;
                transition: all var(--transition-normal);
            }
            
            .page-number:hover {
                background: var(--accent-primary);
                color: white;
            }
            
            .page-number.active {
                background: var(--accent-primary);
                color: white;
            }
        `;
        document.head.appendChild(style);

        // Initialize the crosshair manager and make it globally accessible
        const manager = new CrosshairManager();
        window.crosshairManager = manager;
        return manager;
    }
} 