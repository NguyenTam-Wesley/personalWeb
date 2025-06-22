import { supabase } from '../supabase/supabase.js';
import { getCurrentUser } from '../supabase/auth.js';

export class CrosshairAdminManager {
    constructor() {
        this.currentUser = null;
        this.crosshairs = [];
        this.filters = {
            search: '',
            category: '',
            status: ''
        };
        this.currentPage = 1;
        this.itemsPerPage = 20;
        this.editingCrosshair = null;
        this.init();
    }

    async init() {
        // Kiểm tra quyền admin
        this.currentUser = await getCurrentUser();
        if (!this.currentUser || this.currentUser.role !== 'admin') {
            this.redirectToLogin();
            return;
        }

        await this.loadCrosshairs();
        this.setupEventListeners();
    }

    async loadCrosshairs() {
        try {
            this.showLoading();

            // Build query
            let query = supabase
                .from('crosshairs')
                .select('*', { count: 'exact' });

            // Apply filters
            if (this.filters.search) {
                query = query.or(`name.ilike.%${this.filters.search}%,player_name.ilike.%${this.filters.search}%,team_name.ilike.%${this.filters.search}%`);
            }

            if (this.filters.category) {
                query = query.eq('category', this.filters.category);
            }

            if (this.filters.status !== '') {
                query = query.eq('is_active', this.filters.status === 'true');
            }

            // Apply sorting (newest first)
            query = query.order('created_at', { ascending: false });

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
            this.renderTable();
            this.renderPagination();

        } catch (error) {
            console.error('Error in loadCrosshairs:', error);
            this.showError('Lỗi khi tải danh sách crosshair');
        }
    }

    renderTable() {
        const tableBody = document.getElementById('crosshairTableBody');
        if (!tableBody) return;

        if (!this.crosshairs || this.crosshairs.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="8" class="no-data">Không có crosshair nào</td>
                </tr>
            `;
            return;
        }

        const rowsHTML = this.crosshairs.map(crosshair => this.createTableRow(crosshair)).join('');
        tableBody.innerHTML = rowsHTML;

        // Add event listeners for action buttons
        tableBody.querySelectorAll('.edit-btn').forEach((btn, index) => {
            btn.addEventListener('click', () => this.editCrosshair(this.crosshairs[index]));
        });

        tableBody.querySelectorAll('.delete-btn').forEach((btn, index) => {
            btn.addEventListener('click', () => this.showDeleteModal(this.crosshairs[index]));
        });

        tableBody.querySelectorAll('.toggle-status').forEach((toggle, index) => {
            toggle.addEventListener('change', () => this.toggleStatus(this.crosshairs[index].id, toggle.checked));
        });
    }

    createTableRow(crosshair) {
        const statusBadge = crosshair.is_active 
            ? '<span class="badge success">Đang hiển thị</span>'
            : '<span class="badge danger">Đã ẩn</span>';

        const categoryIcon = this.getCategoryIcon(crosshair.category);
        const difficultyColor = this.getDifficultyColor(crosshair.difficulty);

        return `
            <tr data-crosshair-id="${crosshair.id}">
                <td>
                    <div class="crosshair-info-cell">
                        <strong>${this.escapeHtml(crosshair.name)}</strong>
                        <small>${this.escapeHtml(crosshair.description || '')}</small>
                    </div>
                </td>
                <td>${this.escapeHtml(crosshair.player_name || '-')}</td>
                <td>${this.escapeHtml(crosshair.team_name || '-')}</td>
                <td>
                    <span class="badge category-badge">
                        ${categoryIcon} ${crosshair.category}
                    </span>
                </td>
                <td>
                    <span class="badge difficulty-badge" style="background-color: ${difficultyColor}">
                        ${crosshair.difficulty}
                    </span>
                </td>
                <td>
                    <label class="toggle-switch">
                        <input type="checkbox" class="toggle-status" ${crosshair.is_active ? 'checked' : ''} />
                        <span class="toggle-slider"></span>
                    </label>
                    ${statusBadge}
                </td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-icon edit-btn" title="Chỉnh sửa">
                            ✏️
                        </button>
                        <button class="btn-icon delete-btn" title="Xóa">
                            🗑️
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }

    setupEventListeners() {
        // Search and filters
        const searchInput = document.getElementById('adminSearch');
        const categoryFilter = document.getElementById('adminCategoryFilter');
        const statusFilter = document.getElementById('adminStatusFilter');

        if (searchInput) {
            searchInput.addEventListener('input', this.debounce(() => this.handleSearch(), 300));
        }

        if (categoryFilter) {
            categoryFilter.addEventListener('change', () => this.handleFilterChange());
        }

        if (statusFilter) {
            statusFilter.addEventListener('change', () => this.handleFilterChange());
        }

        // Add crosshair button
        const addBtn = document.getElementById('addCrosshairBtn');
        if (addBtn) {
            addBtn.addEventListener('click', () => this.showAddModal());
        }

        // Modal events
        const modal = document.getElementById('crosshairModal');
        const closeModal = document.getElementById('closeModal');
        const cancelBtn = document.getElementById('cancelBtn');
        const form = document.getElementById('crosshairForm');

        if (closeModal) {
            closeModal.addEventListener('click', () => this.closeModal());
        }

        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this.closeModal());
        }

        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) this.closeModal();
            });
        }

        if (form) {
            form.addEventListener('submit', (e) => this.handleSave(e));
        }

        // Delete modal events
        const deleteModal = document.getElementById('deleteModal');
        const closeDeleteModal = document.getElementById('closeDeleteModal');
        const cancelDelete = document.getElementById('cancelDelete');
        const confirmDelete = document.getElementById('confirmDelete');

        if (closeDeleteModal) {
            closeDeleteModal.addEventListener('click', () => this.closeDeleteModal());
        }

        if (cancelDelete) {
            cancelDelete.addEventListener('click', () => this.closeDeleteModal());
        }

        if (deleteModal) {
            deleteModal.addEventListener('click', (e) => {
                if (e.target === deleteModal) this.closeDeleteModal();
            });
        }

        if (confirmDelete) {
            confirmDelete.addEventListener('click', () => this.deleteCrosshair());
        }

        // Pagination
        const prevPage = document.getElementById('adminPrevPage');
        const nextPage = document.getElementById('adminNextPage');

        if (prevPage) {
            prevPage.addEventListener('click', () => this.goToPage(this.currentPage - 1));
        }

        if (nextPage) {
            nextPage.addEventListener('click', () => this.goToPage(this.currentPage + 1));
        }
    }

    handleSearch() {
        const searchInput = document.getElementById('adminSearch');
        if (searchInput) {
            this.filters.search = searchInput.value.trim();
            this.currentPage = 1;
            this.loadCrosshairs();
        }
    }

    handleFilterChange() {
        const categoryFilter = document.getElementById('adminCategoryFilter');
        const statusFilter = document.getElementById('adminStatusFilter');

        if (categoryFilter) {
            this.filters.category = categoryFilter.value;
        }

        if (statusFilter) {
            this.filters.status = statusFilter.value;
        }

        this.currentPage = 1;
        this.loadCrosshairs();
    }

    showAddModal() {
        this.editingCrosshair = null;
        this.resetForm();
        document.getElementById('modalTitle').textContent = 'Thêm Crosshair Mới';
        document.getElementById('crosshairModal').classList.add('show');
    }

    editCrosshair(crosshair) {
        this.editingCrosshair = crosshair;
        this.fillForm(crosshair);
        document.getElementById('modalTitle').textContent = 'Chỉnh sửa Crosshair';
        document.getElementById('crosshairModal').classList.add('show');
    }

    fillForm(crosshair) {
        document.getElementById('crosshairId').value = crosshair.id;
        document.getElementById('crosshairName').value = crosshair.name || '';
        document.getElementById('crosshairDescription').value = crosshair.description || '';
        document.getElementById('crosshairCode').value = crosshair.code || '';
        document.getElementById('crosshairPlayer').value = crosshair.player_name || '';
        document.getElementById('crosshairTeam').value = crosshair.team_name || '';
        document.getElementById('crosshairCategory').value = crosshair.category || '';
        document.getElementById('crosshairDifficulty').value = crosshair.difficulty || 'medium';
        document.getElementById('crosshairColor').value = crosshair.color || '';
        document.getElementById('crosshairStyle').value = crosshair.style || '';
        document.getElementById('crosshairActive').checked = crosshair.is_active !== false;
    }

    resetForm() {
        document.getElementById('crosshairForm').reset();
        document.getElementById('crosshairId').value = '';
        document.getElementById('crosshairActive').checked = true;
    }

    async handleSave(e) {
        e.preventDefault();

        const saveBtn = document.getElementById('saveBtn');
        const originalText = saveBtn.textContent;
        
        try {
            saveBtn.textContent = 'Đang lưu...';
            saveBtn.disabled = true;

            const formData = this.getFormData();
            
            if (this.editingCrosshair) {
                await this.updateCrosshair(formData);
            } else {
                await this.createCrosshair(formData);
            }

            this.closeModal();
            this.loadCrosshairs();
            this.showNotification('Lưu crosshair thành công!', 'success');

        } catch (error) {
            console.error('Error saving crosshair:', error);
            this.showNotification('Lỗi khi lưu crosshair', 'error');
        } finally {
            saveBtn.textContent = originalText;
            saveBtn.disabled = false;
        }
    }

    getFormData() {
        return {
            name: document.getElementById('crosshairName').value.trim(),
            description: document.getElementById('crosshairDescription').value.trim(),
            code: document.getElementById('crosshairCode').value.trim(),
            player_name: document.getElementById('crosshairPlayer').value.trim(),
            team_name: document.getElementById('crosshairTeam').value.trim(),
            category: document.getElementById('crosshairCategory').value,
            difficulty: document.getElementById('crosshairDifficulty').value,
            color: document.getElementById('crosshairColor').value.trim(),
            style: document.getElementById('crosshairStyle').value.trim(),
            is_active: document.getElementById('crosshairActive').checked
        };
    }

    async createCrosshair(data) {
        const { error } = await supabase
            .from('crosshairs')
            .insert([data]);

        if (error) throw error;
    }

    async updateCrosshair(data) {
        const { error } = await supabase
            .from('crosshairs')
            .update(data)
            .eq('id', this.editingCrosshair.id);

        if (error) throw error;
    }

    async toggleStatus(crosshairId, isActive) {
        try {
            const { error } = await supabase
                .from('crosshairs')
                .update({ is_active: isActive })
                .eq('id', crosshairId);

            if (error) throw error;

            this.showNotification(`Đã ${isActive ? 'hiển thị' : 'ẩn'} crosshair`, 'success');
        } catch (error) {
            console.error('Error toggling status:', error);
            this.showNotification('Lỗi khi thay đổi trạng thái', 'error');
            // Reload to reset the toggle
            this.loadCrosshairs();
        }
    }

    showDeleteModal(crosshair) {
        this.editingCrosshair = crosshair;
        document.getElementById('deleteCrosshairName').textContent = crosshair.name;
        document.getElementById('deleteModal').style.display = 'flex';
    }

    async deleteCrosshair() {
        if (!this.editingCrosshair) return;

        try {
            const { error } = await supabase
                .from('crosshairs')
                .delete()
                .eq('id', this.editingCrosshair.id);

            if (error) throw error;

            this.closeDeleteModal();
            this.loadCrosshairs();
            this.showNotification('Đã xóa crosshair thành công!', 'success');

        } catch (error) {
            console.error('Error deleting crosshair:', error);
            this.showNotification('Lỗi khi xóa crosshair', 'error');
        }
    }

    closeModal() {
        document.getElementById('crosshairModal').classList.remove('show');
        this.editingCrosshair = null;
    }

    closeDeleteModal() {
        document.getElementById('deleteModal').style.display = 'none';
        this.editingCrosshair = null;
    }

    renderPagination() {
        const paginationContainer = document.getElementById('adminPagination');
        if (!paginationContainer) return;

        const totalPages = Math.ceil(this.totalItems / this.itemsPerPage);
        
        if (totalPages <= 1) {
            paginationContainer.style.display = 'none';
            return;
        }

        paginationContainer.style.display = 'flex';
        
        const prevBtn = paginationContainer.querySelector('#adminPrevPage');
        const nextBtn = paginationContainer.querySelector('#adminNextPage');
        const pageNumbers = paginationContainer.querySelector('#adminPageNumbers');

        if (prevBtn) {
            prevBtn.disabled = this.currentPage <= 1;
        }

        if (nextBtn) {
            nextBtn.disabled = this.currentPage >= totalPages;
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
                        onclick="this.goToPage(${i})">${i}</button>
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
        const tableBody = document.getElementById('crosshairTableBody');
        if (tableBody) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="8" class="loading">
                        <div class="loading-spinner">
                            <div class="spinner"></div>
                            <p>Đang tải...</p>
                        </div>
                    </td>
                </tr>
            `;
        }
    }

    showError(message) {
        const tableBody = document.getElementById('crosshairTableBody');
        if (tableBody) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="8" class="error">
                        <p>❌ ${message}</p>
                        <button onclick="location.reload()">Thử lại</button>
                    </td>
                </tr>
            `;
        }
    }

    showNotification(message, type = 'success') {
        const notification = document.createElement('div');
        notification.className = `admin-notification ${type}`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => notification.classList.add('show'), 100);
        
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    getCategoryIcon(category) {
        switch (category) {
            case 'pro': return '🏆';
            case 'streamer': return '📺';
            case 'custom': return '⚙️';
            default: return '🎯';
        }
    }

    getDifficultyColor(difficulty) {
        switch (difficulty) {
            case 'easy': return '#28a745';
            case 'medium': return '#ffc107';
            case 'hard': return '#dc3545';
            default: return '#6c757d';
        }
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

    redirectToLogin() {
        window.location.href = '../../pages/login.html';
    }
} 